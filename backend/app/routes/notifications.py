"""In-app уведомления сотрудника: список, прочитать, количество непрочитанных."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.limiter import limiter
from app.models import Notification, User
from app.routes.auth import get_current_user
from app.schemas import NotificationOut

router = APIRouter()


class NotificationReadOut(BaseModel):
    ok: bool = True


@router.get("/notifications", response_model=list[NotificationOut])
@limiter.limit("60/minute")
async def list_notifications(
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Свои уведомления, сначала непрочитанные."""
    rows = (await db.execute(
        select(Notification)
        .where(Notification.user_id == user.id)
        .order_by(Notification.read_at.is_(None).desc(), Notification.created_at.desc())
        .limit(50)
    )).scalars().all()
    return [
        NotificationOut(
            id=r.id, kind=r.kind, title=r.title, body=r.body,
            meta=r.meta if isinstance(r.meta, dict) else {},
            created_at=r.created_at.isoformat() if r.created_at else None,
            read=r.read_at is not None,
        )
        for r in rows
    ]


@router.post("/notifications/{notification_id}/read", response_model=NotificationReadOut)
@limiter.limit("60/minute")
async def mark_read(
    notification_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Пометить уведомление как прочитанное."""
    n = await db.get(Notification, notification_id)
    if n is None or n.user_id != user.id:
        raise HTTPException(status_code=404, detail="Уведомление не найдено")
    if n.read_at is None:
        n.read_at = datetime.now(timezone.utc)
        db.add(n)
        await db.commit()
    return NotificationReadOut()


@router.post("/notifications/read-all", response_model=NotificationReadOut)
@limiter.limit("30/minute")
async def mark_all_read(
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Пометить все непрочитанные уведомления как прочитанные."""
    from sqlalchemy import update

    await db.execute(
        update(Notification)
        .where(Notification.user_id == user.id, Notification.read_at.is_(None))
        .values(read_at=datetime.now(timezone.utc))
    )
    await db.commit()
    return NotificationReadOut()
