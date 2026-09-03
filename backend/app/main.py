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
        print(f"alembic upgrade failed ({proc.returncode}): {stderr.decode().strip()}")
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
    if settings.is_production and settings.jwt_secret_key == settings.DEV_JWT_SECRET:
        raise RuntimeError("JWT_SECRET_KEY must be set to a secure value in production")
    await run_migrations()
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

from app.routes import auth, progress  # noqa: E402 — после создания app

app.include_router(auth.router, prefix="/api", tags=["auth"])
app.include_router(progress.router, prefix="/api", tags=["progress"])


@app.get("/api/health")
async def health():
    return {"ok": True}
