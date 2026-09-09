from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.limiter import limiter
from app.models import MpulseCode, Progress, User, VerificationLog
from app.routes.auth import require_staff
from app.schemas import AdminUserOut, AuditOut, MpulseCodeOut, MpulseRotateIn, StaffSetIn, VerifyTargetIn
from app.stages_data import normalize_tasks


def _mpulse_out(r: MpulseCode) -> MpulseCodeOut:
    return MpulseCodeOut(
        id=r.id,
        code=r.code,
        batch_name=r.batch_name,
        is_active=r.is_active,
        valid_from=r.valid_from.isoformat() if r.valid_from else None,
        valid_until=r.valid_until.isoformat() if r.valid_until else None,
        created_at=r.created_at.isoformat() if r.created_at else None,
    )

router = APIRouter()


def _admin_user_out(user: User, done_stage1: list[str] | None = None) -> AdminUserOut:
    return AdminUserOut(
        id=user.id,
        email=user.email,
        name=user.name,
        role=user.role,
        is_staff=user.is_staff,
        created_at=user.created_at.isoformat() if user.created_at else None,
        done_stage1=done_stage1 or [],
    )


@router.get("/admin/users", response_model=list[AdminUserOut])
@limiter.limit("30/minute")
async def list_users(
    request: Request,
    q: str = "",
    db: AsyncSession = Depends(get_db),
    staff: User = Depends(require_staff),
):
    """Поиск сотрудников (email/name) + их done stage 1 для панели HR."""
    stmt = select(User).order_by(desc(User.created_at)).limit(50)
    if q.strip():
        like = f"%{q.strip().lower()}%"
        stmt = select(User).where(
            (User.email.ilike(like)) | (User.name.ilike(like))
        ).order_by(desc(User.created_at)).limit(50)
    users = (await db.execute(stmt)).scalars().all()
    out = []
    for u in users:
        prog = await db.get(Progress, u.id)
        done1: list[str] = []
        if prog is not None:
            done1 = normalize_tasks(prog.done_tasks).get("1", [])
        out.append(_admin_user_out(u, done1))
    return out


@router.get("/admin/pending-verifications", response_model=list[AdminUserOut])
@limiter.limit("30/minute")
async def pending_verifications(
    request: Request,
    db: AsyncSession = Depends(get_db),
    staff: User = Depends(require_staff),
):
    """Сотрудники, начавшие Stage 1, но не завершившие (есть отметки, 24 задачи не все)."""
    from app.stages_data import get_stages_sync

    all_ids = set(get_stages_sync()[1]["tasks"].keys())
    users = (await db.execute(select(User).order_by(desc(User.created_at)).limit(100))).scalars().all()
    out = []
    for u in users:
        prog = await db.get(Progress, u.id)
        if prog is None:
            continue
        done1 = set(normalize_tasks(prog.done_tasks).get("1", []))
        if done1 - all_ids:
            done1 &= all_ids  # защита от мусора
        if done1 and not all_ids <= done1:
            out.append(_admin_user_out(u, sorted(done1)))
    return out


@router.post("/admin/wifi-password")
@limiter.limit("10/minute")
async def set_wifi_password(
    payload: VerifyTargetIn,
    request: Request,
    db: AsyncSession = Depends(get_db),
    staff: User = Depends(require_staff),
):
    """Staff задаёт персональный Wi-Fi пароль сотруднику (Fernet; payload.task_id игнорируется).

    Пароль генерируется сервером и возвращается staff ОДИН раз —
    передайте сотруднику вне системы (показывается один раз, в БД только шифр).
    """
    import secrets

    from app.crypto import encrypt_secret
    from app.models import WifiPassword

    target = await db.get(User, payload.user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="Сотрудник не найден")
    password = secrets.token_urlsafe(12)
    row = await db.get(WifiPassword, target.id)
    if row is None:
        row = WifiPassword(user_id=target.id, password_encrypted="", set_by=staff.id)
    row.password_encrypted = encrypt_secret(password)
    row.set_by = staff.id
    db.add(row)
    await db.commit()
    return {"ok": True, "password": password, "user_id": target.id}


@router.patch("/admin/users/{user_id}/staff", response_model=AdminUserOut)
@limiter.limit("20/minute")
async def set_staff(
    user_id: int,
    payload: StaffSetIn,
    request: Request,
    db: AsyncSession = Depends(get_db),
    staff: User = Depends(require_staff),
):
    """Выдать/снять staff (HR) без прямого доступа к БД."""
    from sqlalchemy import func

    if user_id == staff.id and not payload.is_staff:
        raise HTTPException(status_code=400, detail="Нельзя снять staff с себя")
    target = await db.get(User, user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="Сотрудник не найден")
    if target.is_staff and not payload.is_staff:
        # нельзя снять последнего staff — портал останется без HR
        n_staff = (await db.execute(select(func.count()).select_from(User).where(User.is_staff))).scalar() or 0
        if n_staff <= 1:
            raise HTTPException(status_code=400, detail="Нельзя снять последнего staff")
    target.is_staff = payload.is_staff
    db.add(target)
    await db.commit()
    await db.refresh(target)
    return _admin_user_out(target)


@router.get("/admin/mpulse-code", response_model=list[MpulseCodeOut])
@limiter.limit("30/minute")
async def mpulse_codes(
    request: Request,
    db: AsyncSession = Depends(get_db),
    staff: User = Depends(require_staff),
):
    """Активные коды MPulse (только staff — код не светить сотрудникам)."""
    rows = (
        await db.execute(select(MpulseCode).order_by(desc(MpulseCode.created_at)).limit(20))
    ).scalars().all()
    return [_mpulse_out(r) for r in rows]


@router.post("/admin/mpulse-code", response_model=MpulseCodeOut)
@limiter.limit("10/minute")
async def rotate_mpulse_code(
    payload: MpulseRotateIn,
    request: Request,
    db: AsyncSession = Depends(get_db),
    staff: User = Depends(require_staff),
):
    """Ротация кода MPulse на батч: старые деактивируются, новый активен."""
    old = (await db.execute(select(MpulseCode).where(MpulseCode.is_active))).scalars().all()
    for r in old:
        r.is_active = False
        db.add(r)
    new = MpulseCode(code=payload.code.strip(), batch_name=payload.batch_name.strip(), is_active=True)
    db.add(new)
    await db.commit()
    await db.refresh(new)
    return _mpulse_out(new)


@router.get("/admin/audit", response_model=list[AuditOut])
@limiter.limit("30/minute")
async def audit_log(
    request: Request,
    user_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    staff: User = Depends(require_staff),
):
    """Журнал верификаций (кто/что/когда/кем)."""
    stmt = select(VerificationLog).order_by(desc(VerificationLog.created_at)).limit(100)
    if user_id is not None:
        stmt = select(VerificationLog).where(VerificationLog.user_id == user_id).order_by(
            desc(VerificationLog.created_at)
        ).limit(100)
    rows = (await db.execute(stmt)).scalars().all()
    return [
        AuditOut(
            id=r.id,
            user_id=r.user_id,
            task_id=r.task_id,
            verified_by=r.verified_by,
            method=r.method,
            details=r.details or "{}",
            created_at=r.created_at.isoformat() if r.created_at else None,
        )
        for r in rows
    ]
