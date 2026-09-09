from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi import Request as _Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse as _JSONResponse
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.config import settings
from app.limiter import limiter, rate_limit_handler


@asynccontextmanager
async def lifespan(_: FastAPI):
    if settings.is_production and not settings.raw_database_url:
        print("FATAL: DATABASE_URL not set — set External URL (oregon-postgres.render.com) in Render Environment")
        raise RuntimeError("DATABASE_URL not set in production — set External Database URL in Render Dashboard")
    if settings.is_production and settings.jwt_secret_key == settings.DEV_JWT_SECRET:
        print("FATAL: JWT_SECRET_KEY is default 'dev-secret...' but APP_ENV=production — set random 32+ chars in Render Environment")
        raise RuntimeError("JWT_SECRET_KEY must be set to a secure value in production — set env var JWT_SECRET_KEY in Render Dashboard (openssl rand -hex 32)")
    # Миграции теперь в entrypoint.sh (alembic upgrade head до старта)
    try:
        from app.stages_data import warm_stages_cache

        await warm_stages_cache()
    except Exception as e:
        print(f"stages warmup: {e}")
    # SLA-мониторинг Stage 1 (фон, 24ч; первая проверка через 30с)
    import asyncio

    from app.sla import sla_loop

    sla_task = asyncio.create_task(sla_loop())
    try:
        yield
    finally:
        sla_task.cancel()


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

from app.routes import admin, auth, integrations, progress, stages  # noqa: E402 — после создания app

app.include_router(auth.router, prefix="/api", tags=["auth"])
app.include_router(progress.router, prefix="/api", tags=["progress"])
app.include_router(stages.router, prefix="/api", tags=["stages"])
app.include_router(admin.router, prefix="/api", tags=["admin"])
app.include_router(integrations.router, prefix="/api", tags=["integrations"])


@app.get("/api/health")
async def health():
    return {"ok": True}
