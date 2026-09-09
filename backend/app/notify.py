"""Уведомления: in-process WS broadcast + email/Telegram (env-guarded).

Broadcast — один инстанс (podman/Render single replica). Для multi-replica
нужен Redis pub/sub вместо _SUBSCRIBERS (см. plan Phase B).
"""
import asyncio
import json

from app.config import settings

_SUBSCRIBERS: set[asyncio.Queue] = set()


def subscribe() -> asyncio.Queue:
    q: asyncio.Queue = asyncio.Queue()
    _SUBSCRIBERS.add(q)
    return q


def unsubscribe(q: asyncio.Queue) -> None:
    _SUBSCRIBERS.discard(q)


def publish(event: dict) -> None:
    """Неблокирующая рассылка всем WS-подписчикам. event: {type, ...}."""
    for q in list(_SUBSCRIBERS):
        try:
            q.put_nowait(json.dumps(event, ensure_ascii=False))
        except asyncio.QueueFull:
            pass


async def send_email(to: str, subject: str, body: str) -> bool:
    if not settings.smtp_configured:
        return False
    try:
        from email.message import EmailMessage

        import aiosmtplib

        msg = EmailMessage()
        msg["From"] = settings.smtp_from
        msg["To"] = to
        msg["Subject"] = subject
        msg.set_content(body)
        await aiosmtplib.send(
            msg, hostname=settings.smtp_host, port=settings.smtp_port,
            username=settings.smtp_user, password=settings.smtp_password,
            start_tls=True, timeout=10,
        )
        return True
    except Exception as e:
        print(f"notify: smtp failed to {to}: {e}")
        return False


async def send_telegram_text(chat_id: str, text: str) -> bool:
    if not settings.telegram_configured:
        return False
    try:
        import httpx

        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage",
                json={"chat_id": chat_id, "text": text},
            )
            return resp.status_code == 200
    except Exception as e:
        print(f"notify: telegram failed: {e}")
        return False


async def notify_new_request(user_email: str, user_name: str, task_id: str) -> None:
    """Новый запрос сотрудника: HR email + WS всем staff-подписчикам."""
    publish({"type": "pending_new", "email": user_email, "name": user_name, "task_id": task_id})
    if settings.hr_notify_email:
        await send_email(
            settings.hr_notify_email,
            f"[Онбординг] Новый запрос: {task_id}",
            f"Сотрудник {user_name} ({user_email}) запросил подтверждение задачи {task_id}.\nОткройте /admin.",
        )
    else:
        print(f"notify: pending_new {user_email} {task_id} (HR email not configured)")


async def notify_verified(user_email: str, task_id: str, xp: int) -> None:
    """HR подтвердил: письмо сотруднику + WS (его /ws/me подхватит)."""
    publish({"type": "verified", "email": user_email, "task_id": task_id, "xp": xp})
    await send_email(
        user_email,
        f"Подтверждено: {task_id} (+XP)",
        f"HR подтвердил задачу {task_id}. Начислено XP, прогресс обновлён в портале.",
    )
