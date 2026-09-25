from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket
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
    # HOTFIX: ensure user_id column exists in telegram_contacts (миграция 026).
    # Вне telegram-if: колонка должна чиниться всегда, независимо от env.
    # HOTFIX-2: stage_tasks verification_type=info_read (миграция 026, часть 2).
    # Без этого /progress/info-read отвечает 400 на проде, где alembic не накатился.
    # HOTFIX-3: telegram_contacts.tg_user_id INTEGER -> BIGINT (миграция 027).
    # TG id 5506243702 > int32 max -> asyncpg DataError в webhook. Только PostgreSQL.
    try:
        from sqlalchemy import text as _text

        from app.database import engine
        async with engine.begin() as conn:
            await conn.execute(_text("ALTER TABLE telegram_contacts ADD COLUMN IF NOT EXISTS user_id INTEGER"))
            await conn.execute(_text("CREATE INDEX IF NOT EXISTS ix_telegram_contacts_user_id ON telegram_contacts(user_id)"))
            await conn.execute(_text(
                "UPDATE stage_tasks SET verification_type = 'info_read' WHERE id IN ("
                "'1-dogovor','1-nda','1-pdp','1-ip','1-sn',"
                "'1-mbusiness','1-accountant','1-wifi','1-proxy',"
                "'1-jira','1-figma','1-gitlab',"
                "'1-mpulse','1-mpulse-schedule','1-mpulse-checkin','1-mpulse-code','1-mpulse-news')"
            ))
            dialect = ""
            try:
                dialect = conn.engine.dialect.name
            except Exception:
                dialect = ""
            if dialect == "postgresql":
                cur = await conn.execute(_text(
                    "SELECT data_type FROM information_schema.columns "
                    "WHERE table_name = 'telegram_contacts' AND column_name = 'tg_user_id'"
                ))
                row = cur.first()
                if row is not None and row[0] != "bigint":
                    await conn.execute(_text("ALTER TABLE telegram_contacts ALTER COLUMN tg_user_id TYPE BIGINT"))
                    print("HOTFIX: telegram_contacts.tg_user_id converted to BIGINT")
        print("HOTFIX: telegram_contacts.user_id + stage_tasks info_read ensured")
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

from app.routes import admin, auth, integrations, notifications, progress, services, stages  # noqa: E402

app.include_router(auth.router, prefix="/api", tags=["auth"])
app.include_router(progress.router, prefix="/api", tags=["progress"])
app.include_router(stages.router, prefix="/api", tags=["stages"])
app.include_router(admin.router, prefix="/api", tags=["admin"])
app.include_router(integrations.router, prefix="/api", tags=["integrations"])
app.include_router(services.router, prefix="/api", tags=["services"])
app.include_router(notifications.router, prefix="/api", tags=["notifications"])


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
