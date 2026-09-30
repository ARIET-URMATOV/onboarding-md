from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from pydantic import BaseModel

from app.database import get_db
from app.models import CandidateApplication, ApplicationEvent, User
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

@router.post("/{app_id}/decision")
async def hr_decision(
    app_id: int,
    decision_in: DecisionIn,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_staff)
):
    """Действия HR (approve, reject, request_info)."""
    # NFR-04 checks
    if admin_user.staff_role == 'sysadmin':
        raise HTTPException(status_code=403, detail="Только HR может принимать решения")
        
    app = await db.get(CandidateApplication, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
        
    valid_transitions = {
        "new": ["approved", "rejected", "needs_info"],
        "in_review": ["approved", "rejected", "needs_info"],
        "needs_info": ["rejected"] # Can technically reject if they never answer
    }
    
    current = app.status
    target = ""
    
    if decision_in.decision == "approve":
        target = "approved"
    elif decision_in.decision == "reject":
        target = "rejected"
    elif decision_in.decision == "needs_info":
        target = "needs_info"
    else:
        raise HTTPException(status_code=400, detail="Invalid decision")

    if target not in valid_transitions.get(current, []):
        raise HTTPException(status_code=400, detail=f"Cannot transition from {current} to {target}")

    app.status = target
    
    evt = ApplicationEvent(
        application_id=app.id,
        from_status=current,
        to_status=target,
        author_id=admin_user.id,
        comment=decision_in.comment
    )
    db.add(evt)
    await db.commit()
    
    # TODO: Trigger SMTP emails to candidate
    
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
    await db.commit()
    
    # TODO: Send email with temp password
    
    return {"ok": True, "ad_login": account_in.ad_login}
