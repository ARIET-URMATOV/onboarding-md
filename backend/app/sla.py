"""SLA-мониторинг Stage 1: 7 дней с users.created_at (TZ п.10).

Фоновая asyncio-задача раз в 24ч ищет просроченных: пишет в лог всегда,
отправляет email/Telegram если настроены SMTP_HOST / TELEGRAM_BOT_TOKEN.
Фронт уже показывает обратный отсчёт по created_at.
"""
import asyncio
from datetime import datetime, timedelta, timezone

from app.config import settings

SLA_DAYS = 7
WARN_DAYS = 6


async def find_overdue(db) -> list[dict]:
    """Сотрудники с незавершённым Stage 1 старше SLA_DAYS / WARN_DAYS."""
    from sqlalchemy import select

    from app.models import Progress, User
    from app.stages_data import get_stages_sync, normalize_tasks

    all_ids = set(get_stages_sync()[1]["tasks"].keys())
    cutoff_warn = datetime.now(timezone.utc) - timedelta(days=WARN_DAYS)
    users = (await db.execute(select(User).where(User.created_at <= cutoff_warn))).scalars().all()
    out = []
    for u in users:
        prog = await db.get(Progress, u.id)
        done1 = set(normalize_tasks(prog.done_tasks).get("1", [])) if prog else set()
        if all_ids <= done1:
            continue
        created = u.created_at
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        days = (datetime.now(timezone.utc) - created).days
        out.append({
            "user_id": u.id, "email": u.email, "name": u.name,
            "days": days, "overdue": days >= SLA_DAYS, "done": len(done1),
        })
    return out


async def send_email(to: str, subject: str, body: str) -> bool:
    """SMTP через aiosmtplib; False если не настроен или ошибка."""
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
        print(f"sla: smtp failed to {to}: {e}")
        return False


async def send_telegram(chat_id: str, text: str) -> bool:
    """Telegram Bot API; chat_id здесь = email-подпись (нужен маппинг; пока заглушка)."""
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
        print(f"sla: telegram failed: {e}")
        return False


async def sla_check_once() -> list[dict]:
    from app.database import SessionLocal

    try:
        async with SessionLocal() as db:
            rows = await find_overdue(db)
    except Exception as e:
        print(f"sla: check failed: {e}")
        return []
    for r in rows:
        level = "OVERDUE" if r["overdue"] else "WARN-DAY6"
        print(f"sla: [{level}] user={r['user_id']} {r['email']} days={r['days']} done_stage1={r['done']}")
        subject = (
            "Онбординг просрочен: требуется завершить Этап 1"
            if r["overdue"] else "Напоминание: остался 1 день Этапа 1"
        )
        body = (
            f"Здравствуйте, {r['name']}!\n\n"
            f"{'Прошла неделя' if r['overdue'] else 'Остался 1 день'} с начала онбординга "
            f"(выполнено {r['done']} задач Stage 1). Пожалуйста, завершите Этап 1 «Документы и доступы».\n"
        )
        sent = await send_email(r["email"], subject, body)
        if settings.hr_notify_email and r["overdue"]:
            await send_email(
                settings.hr_notify_email,
                f"[HR] Просрочка онбординга: {r['email']}",
                body + f"\nСотрудник: {r['email']} (id={r['user_id']}).\n",
            )
        if not sent:
            print(f"sla: notify skipped (SMTP not configured) for {r['email']}")
    return rows


async def sla_loop(interval_seconds: int = 24 * 3600) -> None:
    # первая проверка вскоре после старта (поймать уже-просроченных), дальше по интервалу
    await asyncio.sleep(30)
    while True:
        await sla_check_once()
        await asyncio.sleep(interval_seconds)
