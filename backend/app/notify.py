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


ROLE_TO_CONTACT = {
    "hr": "contacts.hr_email",
    "accountant": "contacts.accountant_email",
    "sysadmin": "contacts.sysadmin_email",
    "lead": "contacts.lead_email",
    "teamlead": "contacts.teamlead_email",
    "system": "",
}

TASK_ACTION_TEXT = {
    "1-mbusiness": "запросил открытие MBusiness",
    "1-accountant": "выполнил инструкцию для бухгалтера",
    "1-wifi": "отправил MAC-адрес (нужен пароль Wi-Fi)",
    "1-proxy": "запросил пропуск / Face ID",
    "1-telegram": "вступил в Telegram-группы и представился",
    "1-jira": "вошёл в Jira",
    "1-figma": "принял приглашение Figma",
    "1-gitlab": "вошёл в GitLab",
}


async def _contact_emails(db, responsible_role: str, user=None) -> list[str]:
    """Email ответственных: per-employee lead (для 1-proxy) -> contacts.* -> HR fallback."""
    from app.models import AppSetting
    from app.models import User as _User

    # per-employee Lead для пропусков
    if responsible_role == "lead" and user is not None and getattr(user, "lead_id", None):
        lead = await db.get(_User, user.lead_id)
        if lead is not None:
            return [lead.email]
    key = ROLE_TO_CONTACT.get(responsible_role, "")
    addrs: list[str] = []
    if key:
        row = await db.get(AppSetting, key)
        if row is not None and row.value.strip():
            addrs = [e.strip() for e in row.value.split(",") if e.strip()]
    if not addrs and settings.hr_notify_email:
        addrs = [settings.hr_notify_email]
    return addrs


async def notify_new_request(
    user_email: str,
    user_name: str,
    task_id: str,
    batch: bool = False,
    db=None,
    user=None,
    responsible_role: str = "hr",
) -> None:
    """Новый запрос: WS всем staff + email ответственному по роли (список/lead/HR-fallback)."""
    from app.stages_data import task_meta

    if not responsible_role or responsible_role == "hr":
        _vt, _rr = task_meta(task_id.split(",")[0].strip())
        if _rr:
            responsible_role = _rr
    publish({"type": "pending_new_batch" if batch else "pending_new", "email": user_email,
             "name": user_name, "task_id": task_id, "responsible_role": responsible_role})
    action = TASK_ACTION_TEXT.get(task_id.split(",")[0].strip(), f"запросил: {task_id}")
    addrs: list[str] = []
    if db is not None:
        try:
            addrs = await _contact_emails(db, responsible_role, user)
        except Exception as e:
            print(f"notify: contacts lookup failed: {e}")
    if not addrs and settings.hr_notify_email:
        addrs = [settings.hr_notify_email]
    if addrs:
        what = f"пакет задач ({task_id})" if batch else f"задачу {task_id}"
        for to in addrs:
            await send_email(
                to,
                f"[Онбординг] {user_name} {action}",
                f"Сотрудник {user_name} ({user_email}) {action}: {what}.\n"
                f"Зайдите в админ-панель (/admin) и подтвердите.",
            )
    else:
        print(f"notify: pending_new {user_email} {task_id} (no contacts configured)")


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
