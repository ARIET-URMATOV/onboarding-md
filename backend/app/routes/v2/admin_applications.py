from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import ApplicationEvent, CandidateApplication, OutboxEvent, User
from app.notify import publish
from app.routes.auth import require_staff

router = APIRouter(prefix="/admin/applications")

# --- Schemas ---
class ApplicationOut(BaseModel):
    id: int
    number: str
    name: str
    email: str
    phone: str
    department: str | None
    position: str | None
    planned_date: str | None
    lead_name: str
    status: str
    created_at: str
    updated_at: str

class DecisionIn(BaseModel):
    decision: str # "approve", "reject", "needs_info"
    comment: str

class AccountIn(BaseModel):
    ad_login: str

# --- Endpoints ---

class MetricsOut(BaseModel):
    total_applications: int
    conversion_rate: float
    avg_hr_hours: float
    avg_sysadmin_hours: float
    avg_activation_to_complete_hours: float
    overdue_share: float

@router.get("/metrics", response_model=MetricsOut)
async def get_metrics(
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_staff)
):
    """Метрики по воронке онбординга (NFR-10)."""
    from datetime import datetime, timezone

    from app.models import Progress

    apps = (await db.execute(select(CandidateApplication))).scalars().all()
    evts = (await db.execute(select(ApplicationEvent))).scalars().all()

    total = len(apps)
    activated = sum(1 for a in apps if a.status == 'activated')
    conversion_rate = (activated / total * 100) if total > 0 else 0.0

    # HR SLA по умолчанию — 2 рабочих дня (OQ-06 proposal: 48ч).
    HR_SLA_HOURS = 48.0

    hr_times = []
    sys_times = []
    overdue = 0
    now = datetime.now(timezone.utc)

    for app in apps:
        app_evts = sorted([e for e in evts if e.application_id == app.id], key=lambda x: x.created_at)

        # Time from 'new' to 'approved'/'rejected'
        t_new = next((e.created_at for e in app_evts if e.to_status == 'new'), app.created_at)
        t_hr_decision = next((e.created_at for e in app_evts if e.to_status in ['approved', 'rejected']), None)

        if t_new and t_hr_decision:
            hrs = (t_hr_decision - t_new).total_seconds() / 3600
            hr_times.append(hrs)
            if hrs > HR_SLA_HOURS:
                overdue += 1
        elif t_new:
            age_h = (now - t_new).total_seconds() / 3600 if t_new.tzinfo else 0.0
            if age_h > HR_SLA_HOURS and app.status in ('new', 'in_review', 'needs_info'):
                overdue += 1

        # Time from 'approved' to 'account_created'
        t_sys_decision = next((e.created_at for e in app_evts if e.to_status == 'account_created'), None)
        if t_hr_decision and t_sys_decision:
            sys_times.append((t_sys_decision - t_hr_decision).total_seconds() / 3600)

    avg_hr = sum(hr_times) / len(hr_times) if hr_times else 0.0
    avg_sys = sum(sys_times) / len(sys_times) if sys_times else 0.0

    # Time from activation (first AD login) to onboarding completion.
    act_times = []
    user_ids = [a.user_id for a in apps if a.user_id]
    if user_ids:
        progs = (await db.execute(select(Progress).where(Progress.user_id.in_(user_ids)))).scalars().all()
        user_by_id = {a.user_id: a for a in apps if a.user_id}
        for p in progs:
            a = user_by_id.get(p.user_id)
            t_act = next(
                (e.created_at for e in sorted(
                    [e for e in evts if e.application_id == (a.id if a else -1)],
                    key=lambda x: x.created_at,
                ) if e.to_status == 'activated'),
                None,
            )
            if t_act and p.completed_at:
                act_times.append((p.completed_at - t_act).total_seconds() / 3600)
    avg_act = sum(act_times) / len(act_times) if act_times else 0.0

    return MetricsOut(
        total_applications=total,
        conversion_rate=round(conversion_rate, 1),
        avg_hr_hours=round(avg_hr, 1),
        avg_sysadmin_hours=round(avg_sys, 1),
        avg_activation_to_complete_hours=round(avg_act, 1),
        overdue_share=round((overdue / total * 100) if total else 0.0, 1),
    )

@router.get("", response_model=List[ApplicationOut])
async def get_applications(
    status: str | None = None,
    department: str | None = None,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_staff)
):
    """Очередь заявок для HR и Sysadmin."""
    stmt = select(CandidateApplication).order_by(CandidateApplication.created_at.desc())
    
    if status:
        stmt = stmt.where(CandidateApplication.status == status)
    if department:
        stmt = stmt.where(CandidateApplication.department == department)
        
    results = await db.execute(stmt)
    apps = results.scalars().all()
    
    # Simple mapping
    out = []
    for a in apps:
        out.append(ApplicationOut(
            id=a.id,
            number=a.number,
            name=a.name,
            email=a.email,
            phone=a.phone,
            department=a.department,
            position=a.position,
            planned_date=a.planned_date.isoformat() if a.planned_date else None,
            lead_name=a.lead_name,
            status=a.status,
            created_at=a.created_at.isoformat() if a.created_at else "",
            updated_at=a.updated_at.isoformat() if a.updated_at else ""
        ))
    return out

class ApplicationEventOut(BaseModel):
    id: int
    from_status: str
    to_status: str
    author_id: int | None
    comment: str
    created_at: str

@router.get("/{app_id}/events", response_model=List[ApplicationEventOut])
async def get_application_events(
    app_id: int,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_staff)
):
    evts = (await db.execute(
        select(ApplicationEvent)
        .where(ApplicationEvent.application_id == app_id)
        .order_by(ApplicationEvent.created_at.desc())
    )).scalars().all()
    
    return [ApplicationEventOut(
        id=e.id,
        from_status=e.from_status,
        to_status=e.to_status,
        author_id=e.author_id,
        comment=e.comment,
        created_at=e.created_at.isoformat() if e.created_at else ""
    ) for e in evts]

@router.post("/{app_id}/decision")
async def hr_decision(
    app_id: int,
    decision_in: DecisionIn,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_staff)
):
    """Действия HR (take/approve/reject/needs_info). FR-206 граф, FR-208 причина отказа обязательна."""
    # NFR-04 checks
    if admin_user.staff_role == 'sysadmin':
        raise HTTPException(status_code=403, detail="Только HR может принимать решения")

    from app.routes.v2.applications import TRANSITIONS

    app = await db.get(CandidateApplication, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Заявка не найдена")

    current = app.status
    target = ""

    if decision_in.decision in ("take", "review"):
        target = "in_review"
    elif decision_in.decision == "approve":
        target = "approved"
    elif decision_in.decision == "reject":
        target = "rejected"
    elif decision_in.decision == "needs_info":
        target = "needs_info"
    else:
        raise HTTPException(status_code=400, detail="Invalid decision")

    if target not in TRANSITIONS.get(current, []):
        raise HTTPException(status_code=400, detail=f"Cannot transition from {current} to {target}")

    # FR-208: причина отказа обязательна.
    if target == "rejected" and not (decision_in.comment or "").strip():
        raise HTTPException(status_code=400, detail="Укажите причину отказа")

    app.status = target
    
    evt = ApplicationEvent(
        application_id=app.id,
        from_status=current,
        to_status=target,
        author_id=admin_user.id,
        comment=decision_in.comment
    )
    db.add(evt)
    
    # Queue email to candidate
    db.add(OutboxEvent(
        kind="email",
        payload={
            "to": app.email,
            "subject": f"Изменение статуса заявки: {target}",
            "body": f"Ваша заявка {app.number} переведена в статус: {target}. Комментарий: {decision_in.comment}"
        }
    ))
    
    await db.commit()

    # Realtime для /ws/admin (FR-210).
    publish({"type": "application_updated", "id": app.id, "status": target})

    return {"ok": True, "new_status": target}

@router.post("/{app_id}/account")
async def create_ad_account(
    app_id: int,
    account_in: AccountIn,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_staff)
):
    """Sysadmin отмечает учётку как созданную."""
    if admin_user.staff_role == 'hr':
        raise HTTPException(status_code=403, detail="Только Sysadmin может выдать AD")
        
    app = await db.get(CandidateApplication, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
        
    if app.status != "approved":
        raise HTTPException(status_code=400, detail="Заявка должна быть одобрена HR (status=approved)")
        
    app.status = "account_created"
    app.ad_login = account_in.ad_login
    
    evt = ApplicationEvent(
        application_id=app.id,
        from_status="approved",
        to_status="account_created",
        author_id=admin_user.id,
        comment=f"Создана учётная запись: {account_in.ad_login}"
    )
    db.add(evt)

    # Email with AD login
    db.add(OutboxEvent(
        kind="email",
        payload={
            "to": app.email,
            "subject": "Данные для входа в корпоративную сеть",
            "body": f"Ваш логин AD: {account_in.ad_login}. Пароль передан вторым каналом."
        }
    ))
    
    await db.commit()

    # Realtime для /ws/admin (FR-210).
    publish({"type": "application_updated", "id": app.id, "status": "account_created"})

    return {"ok": True, "ad_login": account_in.ad_login}
