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


async def notify_new_request(user_email: str, user_name: str, task_id: str, batch: bool = False) -> None:
    """Новый запрос сотрудника: HR email + WS всем staff-подписчикам."""
    publish({"type": "pending_new_batch" if batch else "pending_new", "email": user_email,
             "name": user_name, "task_id": task_id})
    if settings.hr_notify_email:
        what = f"пакет задач ({task_id})" if batch else f"задачу {task_id}"
        await send_email(
            settings.hr_notify_email,
            f"[Онбординг] {user_name} — запрос проверки: {task_id}",
            f"Сотрудник {user_name} ({user_email}) подписал документы и передал их на проверку: {what}.\n"
            f"Зайдите в админ-панель (/admin), проверьте пакет физически и нажмите "
            f"«Подтвердить получение и проверку документов».",
        )
    else:
        print(f"notify: pending_new {user_email} {task_id} (HR email not configured)")


async def notify_rejected(user_email: str, user_name: str, task_id: str, reason: str) -> None:
    """HR отклонил: письмо сотруднику (что доделать) + WS."""
    publish({"type": "rejected", "email": user_email, "task_id": task_id, "reason": reason})
    await send_email(
        user_email,
        f"HR отклонил: {task_id} — нужно доделать",
        f"Здравствуйте, {user_name}!\n\nHR проверил пакет и отклонил задачу {task_id}.\n"
        f"Причина: {reason}\n\nДоделайте и отправьте на проверку снова.",
    )


async def notify_verified(user_email: str, task_id: str, xp: int) -> None:
    """HR подтвердил: письмо сотруднику + WS (его /ws/me подхватит)."""
    publish({"type": "verified", "email": user_email, "task_id": task_id, "xp": xp})
    await send_email(
        user_email,
        f"Подтверждено: {task_id} (+XP)",
        f"HR подтвердил задачу {task_id}. Начислено XP, прогресс обновлён в портале.",
    )


async def notify_verified_batch(user_email: str, task_ids: list[str], xp: int) -> None:
    """Одно событие + одно письмо на весь пакет (Stage = один XP = один тост)."""
    publish({"type": "verified_batch", "email": user_email, "task_ids": task_ids, "xp": xp})
    await send_email(
        user_email,
        "Пакет документов подтверждён (+5 баллов)",
        f"HR подтвердил получение и проверку документов ({len(task_ids)} шт.). "
        f"Начислено XP, этап закрыт — продолжайте онбординг.",
    )
