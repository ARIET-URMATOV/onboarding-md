import re
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import APIRouter, Cookie, Depends, HTTPException, Response
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models import Progress, User
from app.schemas import (
    LoginIn,
    MeOut,
    OkOut,
    PasswordChangeIn,
    ProfileIn,
    ProgressOut,
    RegisterIn,
    RoleIn,
    UserOut,
)

router = APIRouter()

pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
COOKIE_NAME = "md_token"
TOKEN_TTL = timedelta(days=settings.jwt_access_token_expire_days)

AVATAR_RE = re.compile(r"^data:image/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=\s]+$")
AVATAR_MAX_BYTES = 300 * 1024


def create_token(user_id: int) -> str:
    payload = {"sub": str(user_id), "exp": datetime.now(timezone.utc) + TOKEN_TTL}
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
        max_age=int(TOKEN_TTL.total_seconds()),
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


async def ensure_progress(db: AsyncSession, user: User) -> Progress:
    res = await db.execute(select(Progress).where(Progress.user_id == user.id))
    prog = res.scalar_one_or_none()
    if prog is None:
        prog = Progress(user_id=user.id)
        db.add(prog)
        await db.commit()
        await db.refresh(prog)
    return prog


def user_out(user: User) -> UserOut:
    return UserOut(
        email=user.email,
        name=user.name,
        role=user.role,
        avatar=user.avatar,
        intro_seen=user.intro_seen,
        voice_enabled=user.voice_enabled,
    )


def me_out(user: User, prog: Progress) -> MeOut:
    return MeOut(
        user=user_out(user),
        progress=ProgressOut(done_tasks=prog.done_tasks, xp=prog.xp),
    )


@router.post("/register", response_model=MeOut)
async def register(payload: RegisterIn, response: Response, db: AsyncSession = Depends(get_db)):
    email = payload.email.lower().strip()
    res = await db.execute(select(User).where(User.email == email))
    if res.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="Пользователь с такой почтой уже существует")

    user = User(
        email=email,
        password_hash=pwd.hash(payload.password),
        name=(payload.name or email.split("@")[0]).strip(),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    prog = Progress(user_id=user.id)
    db.add(prog)
    await db.commit()
    await db.refresh(prog)

    set_auth_cookie(response, create_token(user.id))
    return me_out(user, prog)


@router.post("/login", response_model=MeOut)
async def login(payload: LoginIn, response: Response, db: AsyncSession = Depends(get_db)):
    email = payload.email.lower().strip()
    res = await db.execute(select(User).where(User.email == email))
    user = res.scalar_one_or_none()
    if user is None or not pwd.verify(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Неверная почта или пароль")

    prog = await ensure_progress(db, user)
    set_auth_cookie(response, create_token(user.id))
    return me_out(user, prog)


@router.post("/logout", response_model=OkOut)
async def logout(response: Response):
    cross = _is_cross_site()
    response.delete_cookie(key=COOKIE_NAME, path="/", samesite="none" if cross else "lax", secure=cross)
    return OkOut()


@router.get("/me", response_model=MeOut)
async def me(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    prog = await ensure_progress(db, user)
    return me_out(user, prog)


@router.post("/role", response_model=UserOut)
async def set_role(
    payload: RoleIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    user.role = payload.role
    await db.commit()
    await db.refresh(user)
    return user_out(user)


@router.patch("/profile", response_model=UserOut)
async def update_profile(
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

    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user_out(user)


@router.post("/profile/password", response_model=OkOut)
async def change_password(
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
async def demo_login(response: Response, db: AsyncSession = Depends(get_db)):
    """Идемпотентный вход в демо-аккаунт: создаёт его при первом заходе."""
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
    set_auth_cookie(response, create_token(user.id))
    return me_out(user, prog)


@router.post("/demo/reset", response_model=OkOut)
async def demo_reset(db: AsyncSession = Depends(get_db)):
    """Сброс демо-аккаунта в состояние «как новый». Трогает только demo."""
    user = await get_demo_user(db)
    if user is not None:
        prog = await db.get(Progress, user.id)
        if prog is not None:
            await db.delete(prog)
        user.name = settings.demo_name
        user.role = None
        user.intro_seen = False
        user.voice_enabled = True
        user.avatar = None
        db.add(user)
        await db.commit()
    return OkOut()
