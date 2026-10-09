import random
import string
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.limiter import limiter
from app.models import ApplicationEvent, CandidateApplication, EmailVerificationCode, OutboxEvent
from app.notify import publish

router = APIRouter(prefix="/applications")

# FR-206: граф статусов. Переходы вне схемы запрещены на бэкенде.
TRANSITIONS: dict[str, list[str]] = {
    "new": ["in_review", "rejected"],
    "in_review": ["needs_info", "approved", "rejected"],
    "needs_info": ["in_review", "rejected"],
    "approved": ["account_created"],
    "account_created": ["activated"],
    "rejected": [],
    "activated": [],
}

REJECT_RETRY_DAYS = 30


def utcnow():
    return datetime.now(timezone.utc)


def generate_ticket_number() -> str:
    # Fallback ONB-ГГГГ-NNNN; при появлении ServiceDesk сюда встанет его номер.
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


@router.post("")
@limiter.limit("5/hour")
async def create_draft_application(
    request: Request,
    app_in: ApplicationIn,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    if not app_in.consent_given:
        raise HTTPException(status_code=400, detail="Consent is required")

    email = str(app_in.email).lower().strip()

    # FR-204: одна активная заявка на email — показываем статус существующей.
    stmt = select(CandidateApplication).where(
        CandidateApplication.email == email,
        CandidateApplication.status.notin_(["rejected", "activated"])
    )
    existing = (await db.execute(stmt)).scalars().first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail={
                "msg": "Активная заявка уже существует. Проверь статус.",
                "number": existing.number,
                "status": existing.status,
            },
        )

    # FR-208: повтор после отказа — только через 30 дней.
    rej_stmt = (
        select(CandidateApplication)
        .where(CandidateApplication.email == email, CandidateApplication.status == "rejected")
        .order_by(CandidateApplication.updated_at.desc())
        .limit(1)
    )
    last_rej = (await db.execute(rej_stmt)).scalars().first()
    if last_rej and last_rej.updated_at:
        upd = last_rej.updated_at
        if upd.tzinfo is None:
            upd = upd.replace(tzinfo=timezone.utc)
        if (utcnow() - upd).days < REJECT_RETRY_DAYS:
            raise HTTPException(status_code=400, detail="Повторная заявка возможна через 30 дней после отказа.")

    code = ''.join(random.choices(string.digits, k=6))

    # NFR-08: коды в БД, а не в памяти — переживают холодный старт / реплики.
    await db.execute(delete(EmailVerificationCode).where(EmailVerificationCode.email == email))
    db.add(EmailVerificationCode(
        email=email,
        code=code,
        payload=app_in.model_dump(),
        ip=request.client.host if request.client else "",
        attempts=0,
        expires_at=utcnow() + timedelta(minutes=15),
    ))

    # Письмо уходит через outbox (Phase X — реальный SMTP-воркер).
    db.add(OutboxEvent(
        kind="email",
        payload={
            "to": email,
            "subject": "Код подтверждения MDIGITAL",
            "body": f"Ваш код: {code}. Действителен 15 минут."
        }
    ))
    await db.commit()

    # DEV-only: вернуть код в ответе, чтобы не лезть в БД при локальном тесте.
    # В production поле отсутствует.
    out: dict = {"ok": True, "msg": "Verification code sent"}
    if not settings.is_production:
        out["dev_code"] = code
    return out


@router.post("/verify-email")
@limiter.limit("15/hour")
async def verify_email(
    request: Request,
    verify_in: VerifyEmailIn,
    db: AsyncSession = Depends(get_db)
):
    email = str(verify_in.email).lower().strip()
    stmt = select(EmailVerificationCode).where(EmailVerificationCode.email == email)
    record = (await db.execute(stmt)).scalars().first()
    if not record:
        raise HTTPException(status_code=400, detail="Код не найден или истёк")

    exp = record.expires_at
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < utcnow():
        await db.delete(record)
        await db.commit()
        raise HTTPException(status_code=400, detail="Срок действия кода истёк")

    if record.code != verify_in.code.strip():
        record.attempts += 1
        if record.attempts >= 5:
            await db.delete(record)
            await db.commit()
            raise HTTPException(status_code=400, detail="Слишком много попыток. Запросите код заново.")
        await db.commit()
        raise HTTPException(status_code=400, detail="Неверный код")

    data = dict(record.payload or {})
    parsed_date = None
    if data.get("planned_date"):
        try:
            parsed_date = datetime.strptime(data["planned_date"], "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except ValueError:
            pass

    ticket_number = generate_ticket_number()

    application = CandidateApplication(
        number=ticket_number,
        name=data.get("name", ""),
        email=email,
        phone=data.get("phone", ""),
        department=data.get("department"),
        position=data.get("position"),
        planned_date=parsed_date,
        lead_name=data.get("lead_name", ""),
        consent_given=bool(data.get("consent_given")),
        consent_ip=record.ip,
        status="new",
        email_verified_at=utcnow()
    )
    db.add(application)
    await db.flush()

    db.add(ApplicationEvent(
        application_id=application.id,
        from_status="",
        to_status="new",
        comment="Заявка создана и подтверждена почта"
    ))
    await db.delete(record)
    await db.commit()

    # Realtime: новая заявка для /ws/admin (FR-210).
    publish({"type": "application_new", "number": ticket_number})

    return {"ticket_number": ticket_number}


@router.post("/status")
@limiter.limit("10/hour")
async def check_status(
    request: Request,
    status_in: StatusIn,
    db: AsyncSession = Depends(get_db)
):
    # NFR-01: одинаковый ответ при «нет заявки» и «неверный email» — без утечки.
    stmt = select(CandidateApplication).where(
        CandidateApplication.number == status_in.number.strip(),
        CandidateApplication.email == str(status_in.email).lower().strip()
    )
    application = (await db.execute(stmt)).scalars().first()

    if not application:
        raise HTTPException(status_code=404, detail="Заявка не найдена")

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
@limiter.limit("10/hour")
async def reply_to_needs_info(
    number: str,
    reply_in: ReplyIn,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(CandidateApplication).where(
        CandidateApplication.number == number.strip(),
        CandidateApplication.email == str(reply_in.email).lower().strip()
    )
    application = (await db.execute(stmt)).scalars().first()

    if not application:
        raise HTTPException(status_code=404, detail="Заявка не найдена")

    if application.status != "needs_info":
        raise HTTPException(status_code=400, detail="Заявка не ожидает уточнения")

    if "in_review" not in TRANSITIONS.get(application.status, []):
        raise HTTPException(status_code=400, detail="Переход запрещён")

    application.status = "in_review"

    db.add(ApplicationEvent(
        application_id=application.id,
        from_status="needs_info",
        to_status="in_review",
        comment=f"Ответ кандидата: {reply_in.reply[:500]}"
    ))
    await db.commit()

    publish({"type": "application_updated", "id": application.id, "status": "in_review"})

    return {"ok": True}
