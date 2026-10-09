from contextlib import asynccontextmanager

from fastapi import FastAPI, Request as _Request, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse as _JSONResponse
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from sqlalchemy.exc import OperationalError, DisconnectionError

from app.config import settings
from app.limiter import limiter, rate_limit_handler

import logging

logger = logging.getLogger(__name__)


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
    # HOTFIX-страховка на время, пока на проде не накатилась миграция 026/027.
    # Каждая правка в отдельной транзакции и с проверкой таблицы —
    # отсутствие одной таблицы не срывает остальные правки.
    try:
        from sqlalchemy import text as _text

        from app.database import engine

        async def _table_exists(conn, table: str) -> bool:
            dialect = conn.engine.dialect.name
            if dialect == "postgresql":
                cur = await conn.execute(_text("SELECT to_regclass(:t)"), {"t": table})
                row = cur.first()
                return row is not None and row[0] is not None
            cur = await conn.execute(
                _text("SELECT name FROM sqlite_master WHERE type = 'table' AND name = :t"),
                {"t": table},
            )
            return cur.first() is not None

        # HOTFIX-1: telegram_contacts.user_id (миграция 026, part 1)
        try:
            async with engine.begin() as conn:
                if await _table_exists(conn, "telegram_contacts"):
                    import sqlalchemy as _sa

                    def _cols(sync_conn) -> list[str]:
                        return [c["name"] for c in _sa.inspect(sync_conn).get_columns("telegram_contacts")]

                    cols = await conn.run_sync(_cols)
                    if "user_id" not in cols:
                        await conn.execute(_text("ALTER TABLE telegram_contacts ADD COLUMN user_id INTEGER"))
                    await conn.execute(_text("CREATE INDEX IF NOT EXISTS ix_telegram_contacts_user_id ON telegram_contacts(user_id)"))
        except Exception as e:
            print(f"HOTFIX-1 (telegram_contacts.user_id) failed: {e}")

        # HOTFIX-2: stage_tasks verification_type=info_read (миграция 026, part 2).
        # Без этого /progress/info-read отвечает 400 на проде, где alembic не накатился.
        # Документы (1-dogovor/nda/pdp/ip/sn) — manual_hr: их подтверждает HR по запросу.
        try:
            async with engine.begin() as conn:
                if await _table_exists(conn, "stage_tasks"):
                    await conn.execute(_text(
                        "UPDATE stage_tasks SET verification_type = 'manual_hr' WHERE id IN ("
                        "'1-dogovor','1-nda','1-pdp','1-ip','1-sn')"
                    ))
                    await conn.execute(_text(
                        "UPDATE stage_tasks SET verification_type = 'info_read' WHERE id IN ("
                        "'1-mbusiness','1-accountant','1-wifi','1-proxy',"
                        "'1-jira','1-figma','1-gitlab',"
                        "'1-mpulse','1-mpulse-schedule','1-mpulse-checkin','1-mpulse-code','1-mpulse-news')"
                    ))
        except Exception as e:
            print(f"HOTFIX-2 (stage_tasks info_read) failed: {e}")

        # HOTFIX-3: telegram_contacts.tg_user_id INTEGER -> BIGINT (миграция 027).
        # TG id 5506243702 > int32 max -> asyncpg DataError в webhook. Только PostgreSQL.
        try:
            if engine.dialect.name == "postgresql":
                async with engine.begin() as conn:
                    if await _table_exists(conn, "telegram_contacts"):
                        cur = await conn.execute(_text(
                            "SELECT data_type FROM information_schema.columns "
                            "WHERE table_name = 'telegram_contacts' AND column_name = 'tg_user_id'"
                        ))
                        row = cur.first()
                        if row is not None and row[0] != "bigint":
                            await conn.execute(_text("ALTER TABLE telegram_contacts ALTER COLUMN tg_user_id TYPE BIGINT"))
                            print("HOTFIX-3: telegram_contacts.tg_user_id converted to BIGINT")
        except Exception as e:
            print(f"HOTFIX-3 (tg_user_id BIGINT) failed: {e}")

        print("HOTFIX checks completed")
    except Exception as e:
        print(f"HOTFIX failed: {e}")

    # Telegram webhook auto-registration (best-effort)
    if settings.telegram_bot_token and settings.telegram_webhook_secret and settings.public_base_url:
        import httpx as _httpx

        wh_url = f"{settings.public_base_url.rstrip('/')}/api/integrations/telegram-webhook"
        try:
            async with _httpx.AsyncClient(timeout=10) as _cl:
                _resp = await _cl.post(
                    f"https://api.telegram.org/bot{settings.telegram_bot_token}/setWebhook",
                    json={
                        "url": wh_url,
                        "secret_token": settings.telegram_webhook_secret,
                        "allowed_updates": ["message", "edited_message", "my_chat_member"],
                    },
                )
                _data = _resp.json()
                if _data.get("ok"):
                    print(f"TG webhook registered → {wh_url}")
                else:
                    print(f"TG webhook register failed: {_data.get('description', _resp.status_code)}")
        except Exception as e:
            print(f"TG webhook register error (non-fatal): {e}")

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

# Global exception handler to ensure CORS headers on all error responses
@app.exception_handler(Exception)
async def global_exception_handler(request: _Request, exc: Exception):
    """Ensure CORS headers are present on all error responses."""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    
    origin = request.headers.get("origin")
    cors_headers = {}
    if origin and origin in settings.cors_origins:
        cors_headers = {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "*",
        }
    
    return _JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
        headers=cors_headers
    )

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
        public = ("/api/register", "/api/login", "/api/demo/login", "/api/health", "/api/logout", "/api/auth/oidc/callback")
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

from app.routes import admin, auth, integrations, notifications, progress, services, stages, stages_admin  # noqa: E402
from app.routes.v2 import applications as v2_applications, public as v2_public, admin_applications as v2_admin_applications
from app.routes.v2 import admin_projects as v2_admin_projects, projects as v2_projects

app.include_router(auth.router, prefix="/api", tags=["auth"])
app.include_router(progress.router, prefix="/api", tags=["progress"])
app.include_router(stages.router, prefix="/api", tags=["stages"])
app.include_router(stages_admin.router, prefix="/api", tags=["stages-admin"])
app.include_router(admin.router, prefix="/api", tags=["admin"])
app.include_router(integrations.router, prefix="/api", tags=["integrations"])
app.include_router(services.router, prefix="/api", tags=["services"])
app.include_router(notifications.router, prefix="/api", tags=["notifications"])

# V2 Routers
app.include_router(v2_applications.router, prefix="/api", tags=["v2-applications"])
app.include_router(v2_public.router, prefix="/api", tags=["v2-public"])
app.include_router(v2_admin_applications.router, prefix="/api", tags=["v2-admin-applications"])
app.include_router(v2_projects.router, prefix="/api", tags=["v2-projects"])
app.include_router(v2_admin_projects.router, prefix="/api", tags=["v2-admin-projects"])


@app.websocket("/ws/admin")
async def ws_admin(websocket: WebSocket):
    """Live-лента для HR-панели: pending_new / verified. Только staff (cookie md_token)."""
    from app.database import SessionLocal
    from app.notify import publish, subscribe, unsubscribe
    from app.routes.auth import user_from_token

    await websocket.accept()
    async with SessionLocal() as db:
        user = await user_from_token(websocket.cookies.get("md_token", ""), db)
    if user is None or not user.is_staff:
        await websocket.close(code=4401)
        return
    q = subscribe()
    try:
        publish({"type": "hello", "pending": "subscribe-ok"})
        while True:
            msg = await q.get()
            await websocket.send_text(msg)
    except Exception:
        pass
    finally:
        unsubscribe(q)


@app.websocket("/ws/me")
async def ws_me(websocket: WebSocket):
    """Live-лента сотрудника: verified/verified_batch/rejected/wifi_password + notification."""
    from app.database import SessionLocal
    from app.notify import subscribe, unsubscribe
    from app.routes.auth import user_from_token

    await websocket.accept()
    async with SessionLocal() as db:
        user = await user_from_token(websocket.cookies.get("md_token", ""), db)
    if user is None:
        await websocket.close(code=4401)
        return
    email = user.email
    user_id = user.id
    q = subscribe()
    try:
        while True:
            msg = await q.get()
            try:
                import json
                evt = json.loads(msg)
            except Exception:
                continue
            evt_type = evt.get("type")
            # сотруднику — только его события
            if evt_type in ("verified", "verified_batch", "rejected", "wifi_password") and evt.get("email") == email:
                await websocket.send_text(msg)
            elif evt_type == "notification" and evt.get("to_user_id") == user_id:
                await websocket.send_text(msg)
    except Exception:
        pass
    finally:
        unsubscribe(q)


@app.get("/api/health")
async def health():
    return {"ok": True}


@app.api_route("/", methods=["GET", "HEAD"], include_in_schema=False)
async def root_health():
    """Render health check (HEAD / от Render dashboard)."""
    return {"ok": True}
