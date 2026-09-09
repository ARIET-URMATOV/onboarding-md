from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.limiter import limiter
from app.models import Progress, User, VerificationLog
from app.routes.auth import require_staff
from app.schemas import AdminUserOut, AuditOut, StaffSetIn
from app.stages_data import normalize_tasks

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
    """Сотрудники с незавершённым Stage 1 (есть отметки, но не все 24 задачи)."""
    from app.stages_data import get_stages_sync

    all_ids = set(get_stages_sync()[1]["tasks"].keys())
    users = (await db.execute(select(User).order_by(desc(User.created_at)).limit(100))).scalars().all()
    out = []
    for u in users:
        prog = await db.get(Progress, u.id)
        if prog is None:
            continue
        done1 = set(normalize_tasks(prog.done_tasks).get("1", []))
        if done1 and not all_ids <= done1:
            out.append(_admin_user_out(u, sorted(done1)))
    return out


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
    if user_id == staff.id and not payload.is_staff:
        raise HTTPException(status_code=400, detail="Нельзя снять staff с себя")
    target = await db.get(User, user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="Сотрудник не найден")
    target.is_staff = payload.is_staff
    db.add(target)
    await db.commit()
    await db.refresh(target)
    return _admin_user_out(target)


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
            created_at=r.created_at.isoformat() if r.created_at else None,
        )
        for r in rows
    ]
