import re
from datetime import datetime, timedelta, timezone
from logging import getLogger

import jwt
from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response
from passlib.context import CryptContext
from sqlalchemy import func, select, text as sa_text
from sqlalchemy.ext.asyncio import AsyncSession

logger = getLogger(__name__)

from app.config import settings
from app.database import get_db
from app.limiter import limiter
from app.models import Notification, PendingRequest, Progress, User, VerificationLog, WifiMac, utcnow
from app.auth import LDAPAuthError, ldap_service
from app.schemas import (
    LoginIn,
    MeOut,
    OkOut,
    PasswordChangeIn,
    ProfileIn,
    ProgressOut,
    UserOut,
)

router = APIRouter()

pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
COOKIE_NAME = "md_token"


@router.get("/auth/ldap-status")
async def ldap_status():
    """Проверить настроен ли LDAP."""
    return {"ldap_configured": settings.ldap_configured}


@router.get("/auth/oidc-status")
async def oidc_status():
    """Проверить настроен ли OIDC (Портал MDigital)."""
    return {"oidc_configured": settings.oidc_configured}


@router.get("/auth/oidc/start")
@limiter.limit("20/minute")
async def oidc_start(request: Request):
    """Generate PKCE/state/nonce, store in DB, return authorization URL."""
    from app.auth.oidc_service import OIDCState, save_state, _discovery

    if not settings.oidc_configured:
        raise HTTPException(status_code=503, detail="OIDC не настроен на сервере")

    oidc_state = OIDCState.generate()

    # Store in DB (async)
    from app.database import SessionLocal
    async with SessionLocal() as db:
        await save_state(db, oidc_state)

    disc = await _discovery()
    auth_url = (
        f"{disc['authorization_endpoint']}"
        f"?response_type=code"
        f"&client_id={settings.oidc_client_id}"
        f"&redirect_uri={settings.oidc_redirect_uri}"
        f"&scope=openid profile email"
        f"&state={oidc_state.state}"
        f"&nonce={oidc_state.nonce}"
        f"&code_challenge={oidc_state.code_challenge}"
        f"&code_challenge_method=S256"
    )
    return {"authorization_url": auth_url}


@router.post("/auth/oidc/callback")
@limiter.limit("20/minute")
async def oidc_callback(
    request: Request,
    code: str,
    state: str,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Exchange authorization code for tokens, upsert user, set session."""
    from app.auth.oidc_service import consume_state, exchange_code, validate_id_token, upsert_user, fetch_userinfo

    if not settings.oidc_configured:
        raise HTTPException(status_code=503, detail="OIDC не настроен на сервере")

    # 1. Validate state
    state_data = await consume_state(db, state)
    if state_data is None:
        raise HTTPException(status_code=400, detail="Неверный или использованный state — повторите вход")

    # 2. Exchange code for tokens
    try:
        tokens = await exchange_code(code, state_data["code_verifier"])
    except Exception as e:
        logger.warning(f"OIDC token exchange failed: {e}")
        raise HTTPException(status_code=401, detail="Не удалось обменять код на токены")

    # 3. Validate ID token
    try:
        claims = await validate_id_token(tokens.id_token, state_data["nonce"])
    except Exception as e:
        logger.warning(f"OIDC ID token validation failed: {e}")
        raise HTTPException(status_code=401, detail=f"ID token не прошёл валидацию: {e}")

    # 3b. Fetch userinfo (Portal claims_supported=["sub"] only)
    try:
        userinfo = await fetch_userinfo(tokens.access_token)
        if userinfo:
            if not claims.email and userinfo.get("email"):
                claims.email = str(userinfo["email"]).lower().strip()
            if not claims.name and userinfo.get("name"):
                claims.name = str(userinfo["name"]).strip()
            if not claims.preferred_username and userinfo.get("preferred_username"):
                claims.preferred_username = str(userinfo["preferred_username"]).strip()
            if userinfo.get("employee_uuid"):
                claims.employee_uuid = str(userinfo["employee_uuid"])
    except Exception as e:
        logger.warning(f"OIDC userinfo fetch failed (non-fatal): {e}")

    # 4. Upsert user
    user, _is_new = await upsert_user(db, claims, tokens.refresh_token)

    # 5. Set session cookie
    prog = await ensure_progress(db, user)
    set_auth_cookie(response, create_token(user.id))
    return me_out(user, prog)


def get_token_ttl() -> timedelta:
    return timedelta(days=settings.jwt_access_token_expire_days)

AVATAR_RE = re.compile(r"^data:image/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=\s]+$")
AVATAR_MAX_BYTES = 300 * 1024


def create_token(user_id: int) -> str:
    payload = {"sub": str(user_id), "exp": datetime.now(timezone.utc) + get_token_ttl()}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def _is_cross_site() -> bool:
    """Prod (vercel.app → onrender.com): кука требует SameSite=None; Secure."""
    return settings.is_production


def set_auth_cookie(response: Response, token: str) -> None:
    cross = _is_cross_site()
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="none" if cross else "lax",
        secure=cross,
        max_age=int(get_token_ttl().total_seconds()),
        path="/",
    )


async def get_current_user(
    md_token: str | None = Cookie(default=None, alias=COOKIE_NAME),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not md_token:
        raise HTTPException(status_code=401, detail="Не авторизован")
    try:
        payload = jwt.decode(md_token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Сессия истекла")
    try:
        user_id = int(payload.get("sub", 0))
    except (TypeError, ValueError):
        raise HTTPException(status_code=401, detail="Сессия истекла")
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Пользователь не найден")
    return user


async def require_role(user: User = Depends(get_current_user)) -> User:
    if not user.role:
        raise HTTPException(status_code=403, detail="Сначала выберите роль")
    return user


async def ensure_progress(db: AsyncSession, user: User) -> Progress:
    res = await db.execute(select(Progress).where(Progress.user_id == user.id).with_for_update())
    prog = res.scalar_one_or_none()
    if prog is None:
        prog = Progress(user_id=user.id)
        db.add(prog)
        try:
            await db.commit()
        except Exception:
            await db.rollback()
            res2 = await db.execute(select(Progress).where(Progress.user_id == user.id))
            prog2 = res2.scalar_one_or_none()
            if prog2 is not None:
                return prog2
            raise
        await db.refresh(prog)
    return prog


def require_staff(user: User = Depends(get_current_user)) -> User:
    """Staff/HR: подтверждает задачи сотрудников (Step 1 docs, Step 2 access)."""
    if not user.is_staff:
        raise HTTPException(status_code=403, detail="Только для HR/администратора")
    return user


async def user_from_token(token: str, db: AsyncSession) -> User | None:
    """Валидация md_token для WebSocket (?token=). None если невалиден."""
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        return await db.get(User, int(payload.get("sub", 0)))
    except Exception:
        return None


def user_out(user: User) -> UserOut:
    return UserOut(
        email=user.email,
        name=user.name,
        role=user.role,
        avatar=user.avatar,
        intro_seen=user.intro_seen,
        voice_enabled=user.voice_enabled,
        created_at=user.created_at.isoformat() if user.created_at else None,
        is_staff=user.is_staff,
        telegram_username=user.telegram_username or "",
    )


def me_out(user: User, prog: Progress) -> MeOut:
    from app.stages_data import compute_level

    level = compute_level(prog.xp)
    completed = prog.completed_at.isoformat() if prog.completed_at else None
    return MeOut(
        user=user_out(user),
        progress=ProgressOut(
            done_tasks=prog.done_tasks, xp=prog.xp, level=level, completed_at=completed
        ),
    )


@router.post("/login", response_model=MeOut)
@limiter.limit("20/minute")
async def login(
    request: Request, payload: LoginIn, response: Response, db: AsyncSession = Depends(get_db)
):
    """Вход через Active Directory (LDAP)."""
    try:
        user = ldap_service.authenticate(payload.email, payload.password)
    except LDAPAuthError as e:
        raise HTTPException(status_code=401, detail=str(e))

    prog = await ensure_progress(db, user)
    set_auth_cookie(response, create_token(user.id))
    return me_out(user, prog)


@router.get("/auth/auto-login")
@limiter.limit("20/minute")
async def auto_login(
    request: Request, token: str, response: Response, db: AsyncSession = Depends(get_db)
):
    """SSO-вход по JWT из корпоративного портала (SHARED_SECRET_KEY, TTL 5 мин).

    Корппортал подписывает {"email"|"login", "name"?, "exp"} общим секретом.
    AD-проверки нет: портал — источник истины (см. ADR-007).
    """
    from fastapi.responses import RedirectResponse

    if not settings.shared_secret_key:
        raise HTTPException(status_code=503, detail="Auto-login не настроен (SHARED_SECRET_KEY)")
    try:
        claims = jwt.decode(token, settings.shared_secret_key, algorithms=[settings.jwt_algorithm])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Ссылка истекла — запросите новую на корпоративном портале")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Неверная ссылка — запросите новую на корпоративном портале")
    email = str(claims.get("email") or "").lower().strip()
    if not email and claims.get("login"):
        login = str(claims["login"]).strip()
        email = login if "@" in login else f"{login}@mdigital.kg"
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="В токене нет email/логина")
    res = await db.execute(select(User).where(User.email == email))
    user = res.scalar_one_or_none()
    if user is None:
        import secrets

        user = User(
            email=email,
            password_hash=pwd.hash(secrets.token_urlsafe(24)),
            name=str(claims.get("name") or email.split("@")[0]).strip(),
        )
        db.add(user)
        await db.flush()
        db.add(Progress(user_id=user.id))
        await db.commit()
        await db.refresh(user)
    else:
        await ensure_progress(db, user)
    set_auth_cookie(response, create_token(user.id))
    return RedirectResponse(url=f"{settings.frontend_url.rstrip('/')}/dashboard", status_code=302)


@router.post("/logout", response_model=OkOut)
async def logout(response: Response):
    cross = _is_cross_site()
    response.delete_cookie(key=COOKIE_NAME, path="/", samesite="none" if cross else "lax", secure=cross)
    return OkOut()


@router.get("/me", response_model=MeOut)
async def me(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    prog = await ensure_progress(db, user)
    out = me_out(user, prog)

    # SLA status
    from app.sla import sla_status
    out.sla = sla_status(user.created_at, prog.completed_at)

    # Unread notifications count
    out.unread_count = (await db.execute(
        select(func.count(Notification.id)).where(
            Notification.user_id == user.id,
            Notification.read_at.is_(None),
        )
    )).scalar() or 0

    return out


@router.patch("/profile", response_model=UserOut)
@limiter.limit("20/minute")
async def update_profile(
    request: Request,
    payload: ProfileIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if payload.name is not None:
        name = payload.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Имя не может быть пустым")
        user.name = name

    if payload.avatar is not None:
        avatar = payload.avatar
        if avatar == "":
            user.avatar = None  # явный сброс аватара
        else:
            if len(avatar) > AVATAR_MAX_BYTES:
                raise HTTPException(status_code=413, detail="Аватар слишком большой (макс. 300 КБ)")
            if not AVATAR_RE.match(avatar):
                raise HTTPException(status_code=400, detail="Неверный формат изображения")
            user.avatar = avatar

    if payload.telegram_username is not None:
        handle = payload.telegram_username.strip()
        if handle == "":
            user.telegram_username = ""
        else:
            if not re.fullmatch(r"@?[A-Za-z][A-Za-z0-9_]{4,31}", handle):
                raise HTTPException(
                    status_code=400,
                    detail="Неверный Telegram username (латиница, 5-32 символа, например @ivan_99)",
                )
            user.telegram_username = handle if handle.startswith("@") else f"@{handle}"

    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user_out(user)


@router.post("/profile/password", response_model=OkOut)
@limiter.limit("10/minute")
async def change_password(
    request: Request,
    payload: PasswordChangeIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not pwd.verify(payload.current_password, user.password_hash):
        raise HTTPException(status_code=401, detail="Неверный текущий пароль")
    user.password_hash = pwd.hash(payload.new_password)
    db.add(user)
    await db.commit()
    return OkOut()


# ---------- DEMO ----------
async def get_demo_user(db: AsyncSession) -> User | None:
    res = await db.execute(select(User).where(User.email == settings.demo_email))
    return res.scalar_one_or_none()


@router.post("/demo/login", response_model=MeOut)
@limiter.limit("20/minute")
async def demo_login(request: Request, response: Response, db: AsyncSession = Depends(get_db), stage: int | None = None):
    """Идемпотентный вход в демо-аккаунт: создаёт его при первом заходе.

    Параметры:
    - stage: если передан (1-5), прогресс будет настроен так, чтобы этот этап был current.
      Все предыдущие этапы считаются пройденными.
    """
    user = await get_demo_user(db)
    if user is None:
        user = User(
            email=settings.demo_email,
            password_hash=pwd.hash(settings.demo_password),
            name=settings.demo_name,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    prog = await ensure_progress(db, user)

    if stage and 1 <= stage <= 5:
        from app.stages_data import normalize_tasks, compute_xp
        done = normalize_tasks(prog.done_tasks)
        # Fetch all tasks from DB for stages before the target stage
        result = await db.execute(
            sa_text("SELECT id FROM stage_tasks WHERE stage_id < :stage"),
            {"stage": stage}
        )
        rows = result.fetchall()
        for row in rows:
            sid = row.id.split("-")[0]
            if sid not in done:
                done[sid] = []
            if row.id not in done[sid]:
                done[sid].append(row.id)
        prog.done_tasks = done
        prog.xp = compute_xp(done)
        await db.commit()
        await db.refresh(prog)

    set_auth_cookie(response, create_token(user.id))
    return me_out(user, prog)


@router.post("/demo/reset", response_model=OkOut)
@limiter.limit("10/minute")
async def demo_reset(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Сброс демо-аккаунта в состояние «как новый». Трогает только demo.

    Требует активной демо-сессии (auth required — см. ADR). После сброса
    кука перевыпускается, чтобы сессия не протухла. Чистит не только
    Progress, но и связанные демо-данные: pending_requests, wifi_macs,
    verification_log — иначе бейджи/флаги переживают «сброс».
    """
    if user.email.lower() != settings.demo_email.lower():
        raise HTTPException(status_code=403, detail="Только демо-аккаунт может сбросить демо")
    demo = await get_demo_user(db)
    if demo is None:
        demo = User(
            email=settings.demo_email,
            password_hash=pwd.hash(settings.demo_password),
            name=settings.demo_name,
        )
        db.add(demo)
        await db.flush()
        db.add(Progress(user_id=demo.id))
        await db.commit()
        await db.refresh(demo)
    else:
        # Связанные строки демо-пользователя — полный wipe.
        from app.models import Notification
        for table in (PendingRequest, WifiMac, VerificationLog, Notification):
            rows = (await db.execute(select(table).where(table.user_id == demo.id))).scalars().all()
            for row in rows:
                await db.delete(row)
        prog = await db.get(Progress, demo.id)
        if prog is not None:
            await db.delete(prog)
        demo.name = settings.demo_name
        demo.role = None
        demo.intro_seen = False
        demo.voice_enabled = True
        demo.avatar = None
        demo.created_at = utcnow()
        db.add(demo)
        await db.flush()
        # Сразу создаём пустой прогресс, чтобы /me после reset отдавал xp=0
        # без гонки с ensure_progress.
        db.add(Progress(user_id=demo.id))
        await db.commit()
        await db.refresh(demo)
    # Перевыпуск куки: сброс не должен ронять текущую демо-сессию.
    set_auth_cookie(response, create_token(demo.id))
    return OkOut()
