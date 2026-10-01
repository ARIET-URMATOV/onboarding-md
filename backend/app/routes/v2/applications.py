import random
import string
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import CandidateApplication, ApplicationEvent, OutboxEvent
from app.limiter import limiter
from pydantic import BaseModel, EmailStr

router = APIRouter(prefix="/applications")

def utcnow():
    return datetime.now(timezone.utc)

def generate_ticket_number() -> str:
    # Basic fallback generator ONB-YYYY-NNNN
    # Ideally integrated with ServiceDesk
    year = utcnow().year
    suffix = ''.join(random.choices(string.digits, k=4))
    return f"ONB-{year}-{suffix}"

# Schemas
class ApplicationIn(BaseModel):
    name: str
    email: EmailStr
    phone: str
    department: str
    position: str
    planned_date: str
    lead_name: str
    consent_given: bool

class VerifyEmailIn(BaseModel):
    email: EmailStr
    code: str

class StatusIn(BaseModel):
    number: str
    email: EmailStr

class ReplyIn(BaseModel):
    email: EmailStr
    reply: str

# In-memory code store for MVP/Prototype (in production, use Redis or DB table)
_verification_codes = {}

@router.post("")
@limiter.limit("5/hour")
async def create_draft_application(
    req: Request,
    app_in: ApplicationIn,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    if not app_in.consent_given:
        raise HTTPException(status_code=400, detail="Consent is required")

    # Check if active application already exists
    stmt = select(CandidateApplication).where(
        CandidateApplication.email == app_in.email,
        CandidateApplication.status.notin_(["rejected", "activated"])
    )
    existing = (await db.execute(stmt)).scalars().first()
    if existing:
        raise HTTPException(status_code=400, detail="Активная заявка уже существует. Проверь статус.")

    code = ''.join(random.choices(string.digits, k=6))
    _verification_codes[app_in.email] = {
        "code": code,
        "expires": utcnow() + timedelta(minutes=15),
        "data": app_in.model_dump(),
        "ip": req.client.host if req.client else "",
        "attempts": 0
    }

    # Queue an outbox event for the email
    db.add(OutboxEvent(
        kind="email",
        payload={
            "to": app_in.email,
            "subject": "Код подтверждения MDIGITAL",
            "body": f"Ваш код: {code}. Действителен 15 минут."
        }
    ))
    await db.commit()

    return {"ok": True, "msg": "Verification code sent"}

@router.post("/verify-email")
@limiter.limit("15/hour")
async def verify_email(
    req: Request,
    verify_in: VerifyEmailIn,
    db: AsyncSession = Depends(get_db)
):
    record = _verification_codes.get(verify_in.email)
    if not record:
        raise HTTPException(status_code=400, detail="Код не найден или истёк")
    
    if record["expires"] < utcnow():
        del _verification_codes[verify_in.email]
        raise HTTPException(status_code=400, detail="Срок действия кода истёк")
        
    if record["code"] != verify_in.code:
        record["attempts"] += 1
        if record["attempts"] >= 5:
            del _verification_codes[verify_in.email]
            raise HTTPException(status_code=400, detail="Слишком много попыток. Запросите код заново.")
        raise HTTPException(status_code=400, detail="Неверный код")
        
    data = record["data"]
    parsed_date = None
    if data["planned_date"]:
        try:
            parsed_date = datetime.strptime(data["planned_date"], "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except ValueError:
            pass

    ticket_number = generate_ticket_number()
    
    # Create the application
    application = CandidateApplication(
        number=ticket_number,
        name=data["name"],
        email=data["email"],
        phone=data["phone"],
        department=data["department"],
        position=data["position"],
        planned_date=parsed_date,
        lead_name=data["lead_name"],
        consent_given=data["consent_given"],
        consent_ip=record["ip"],
        status="new",
        email_verified_at=utcnow()
    )
    db.add(application)
    await db.flush()

    # Log event
    evt = ApplicationEvent(
        application_id=application.id,
        from_status="",
        to_status="new",
        comment="Заявка создана и подтверждена почта"
    )
    db.add(evt)
    await db.commit()

    del _verification_codes[verify_in.email]

    return {"ticket_number": ticket_number}

@router.post("/status")
@limiter.limit("10/hour")
async def check_status(
    req: Request,
    status_in: StatusIn,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(CandidateApplication).where(
        CandidateApplication.number == status_in.number,
        CandidateApplication.email == status_in.email
    )
    application = (await db.execute(stmt)).scalars().first()
    
    if not application:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
        
    # Get the latest comment from HR if status is needs_info or rejected
    comment = ""
    if application.status in ["needs_info", "rejected"]:
        evt_stmt = select(ApplicationEvent).where(
            ApplicationEvent.application_id == application.id,
            ApplicationEvent.to_status == application.status
        ).order_by(ApplicationEvent.created_at.desc())
        latest_evt = (await db.execute(evt_stmt)).scalars().first()
        if latest_evt:
            comment = latest_evt.comment

    return {
        "status": application.status,
        "updated_at": application.updated_at.isoformat(),
        "comment": comment
    }

@router.post("/{number}/reply")
async def reply_to_needs_info(
    number: str,
    reply_in: ReplyIn,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(CandidateApplication).where(
        CandidateApplication.number == number,
        CandidateApplication.email == reply_in.email
    )
    application = (await db.execute(stmt)).scalars().first()
    
    if not application:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
        
    if application.status != "needs_info":
        raise HTTPException(status_code=400, detail="Заявка не ожидает уточнения")

    application.status = "in_review"
    
    evt = ApplicationEvent(
        application_id=application.id,
        from_status="needs_info",
        to_status="in_review",
        comment=f"Ответ кандидата: {reply_in.reply}"
    )
    db.add(evt)
    await db.commit()
    
    return {"ok": True}
