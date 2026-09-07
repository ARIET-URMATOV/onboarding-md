import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi import Request as _Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse as _JSONResponse
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

import app.models  # noqa: F401 — регистрация моделей на Base.metadata
from app.config import settings
from app.database import Base, engine
from app.limiter import limiter, rate_limit_handler


async def _run_alembic_upgrade() -> bool:
    """Run `alembic upgrade head` via subprocess (avoids loop-conflict with async env.py)."""
    try:
        proc = await asyncio.create_subprocess_exec(
            "alembic", "upgrade", "head",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()
        if proc.returncode == 0:
            print("alembic upgrade head ok")
            if stdout:
                print(stdout.decode().strip())
            return True
        err = stderr.decode().strip()
        # Tables already created via previous fallback create_all without alembic_version
        # → "already exists" is not fatal; stamp head so next boot is clean.
        if "already exists" in err or "DuplicateTableError" in err:
            print(f"alembic upgrade: tables already exist — stamping head ({err[:200]})")
            try:
                proc2 = await asyncio.create_subprocess_exec(
                    "alembic", "stamp", "head",
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                stdout2, stderr2 = await proc2.communicate()
                if proc2.returncode == 0:
                    print("alembic stamp head ok")
                    if stdout2:
                        print(stdout2.decode().strip())
                    return True
                print(f"alembic stamp failed ({proc2.returncode}): {stderr2.decode().strip()}")
            except Exception as e2:
                print(f"alembic stamp error: {e2}")
            # Even if stamp failed, tables exist → treat as ok, avoid noisy fallback
            return True
        # Safe hotfix for missing column (e.g. progress.completed_at on old prod DB):
        # alembic failed because DB is behind 003 — add column idempotently, then retry.
        if "does not exist" in err or "UndefinedColumnError" in err:
            print(f"alembic upgrade: missing column detected — applying safe hotfix ({err[:200]})")
            try:
                # IF NOT EXISTS is safe — no data loss, no drop
                import sqlalchemy as sa

                async with engine.begin() as conn:
                    await conn.execute(sa.text("ALTER TABLE progress ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ"))
                    await conn.execute(sa.text("ALTER TABLE progress ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now()"))
                print("hotfix: progress columns ensured")
                # retry upgrade now that columns exist (003 will be applied or stamped)
                proc3 = await asyncio.create_subprocess_exec(
                    "alembic", "upgrade", "head",
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                stdout3, stderr3 = await proc3.communicate()
                if proc3.returncode == 0:
                    print("alembic upgrade head ok (after hotfix)")
                    if stdout3:
                        print(stdout3.decode().strip())
                    return True
                print(f"alembic upgrade after hotfix failed ({proc3.returncode}): {stderr3.decode().strip()}")
                return True  # columns added, treat as ok even if upgrade still warns
            except Exception as e2:
                print(f"hotfix error: {e2}")
                return False
        print(f"alembic upgrade failed ({proc.returncode}): {err}")
        return False
    except FileNotFoundError:
        print("alembic not found — falling back to create_all")
        return False
    except Exception as e:
        print(f"alembic upgrade error: {e}")
        return False


async def run_migrations():
    """Alembic upgrade with retry; fallback to create_all for test/SQLite."""
    is_sqlite_memory = "sqlite" in settings.database_url and ":memory:" in settings.database_url
    for attempt in range(5):
        try:
            if is_sqlite_memory:
                async with engine.begin() as conn:
                    await conn.run_sync(Base.metadata.create_all)
                print("migrations ok (sqlite memory — create_all)")
            else:
                ok = await _run_alembic_upgrade()
                if not ok:
                    # Fallback: create_all keeps fresh DB bootable even if alembic misconfigured
                    async with engine.begin() as conn:
                        await conn.run_sync(Base.metadata.create_all)
                    print("migrations ok (fallback create_all)")
            break
        except Exception as e:
            print(f"migration retry {attempt + 1}/5: {e}")
            if attempt == 4:
                print("migration failed after retries — continuing")
                break
            await asyncio.sleep(2)


@asynccontextmanager
async def lifespan(_: FastAPI):
    if settings.is_production and not settings.raw_database_url:
        print("FATAL: DATABASE_URL not set — set External URL (oregon-postgres.render.com) in Render Environment")
        raise RuntimeError("DATABASE_URL not set in production — set External Database URL in Render Dashboard")
    if settings.is_production and settings.jwt_secret_key == settings.DEV_JWT_SECRET:
        print("FATAL: JWT_SECRET_KEY is default 'dev-secret...' but APP_ENV=production — set random 32+ chars in Render Environment")
        raise RuntimeError("JWT_SECRET_KEY must be set to a secure value in production — set env var JWT_SECRET_KEY in Render Dashboard (openssl rand -hex 32)")
    await run_migrations()
    try:
        from app.stages_data import warm_stages_cache

        await warm_stages_cache()
    except Exception as e:
        print(f"stages warmup: {e}")
    yield


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    lifespan=lifespan,
    debug=settings.app_debug,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_handler)  # type: ignore[arg-type]
app.add_middleware(SlowAPIMiddleware)

# Trust X-Forwarded-For from Render/Vercel proxy for correct IP in rate-limit
try:
    from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

    app.add_middleware(ProxyHeadersMiddleware, trusted_hosts="*")
except ImportError:
    pass

# CSRF: Origin check for state-changing authed requests (SameSite=None needs it)


@app.middleware("http")
async def csrf_origin_check(request: _Request, call_next):
    if request.method in ("POST", "PATCH", "PUT", "DELETE") and request.url.path.startswith("/api/"):
        # skip public auth endpoints and health
        public = ("/api/register", "/api/login", "/api/demo/login", "/api/health", "/api/logout")
        if not any(request.url.path.startswith(p) for p in public):
            origin = request.headers.get("origin")
            if origin and origin not in settings.cors_origins:
                # allow same-origin (no Origin) for direct curl/mobile, block cross-site not in whitelist
                referer_ok = any(o in (request.headers.get("referer") or "") for o in settings.cors_origins)
                if not referer_ok:
                    return _JSONResponse(status_code=403, content={"detail": "CSRF: Origin not allowed"})
    return await call_next(request)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.routes import auth, progress, stages  # noqa: E402 — после создания app

app.include_router(auth.router, prefix="/api", tags=["auth"])
app.include_router(progress.router, prefix="/api", tags=["progress"])
app.include_router(stages.router, prefix="/api", tags=["stages"])


@app.get("/api/health")
async def health():
    return {"ok": True}
