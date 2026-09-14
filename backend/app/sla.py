"""SLA-мониторинг Stage 1: 7 дней с users.created_at (TZ п.10).

sla_status() — синхронный хелпер для /me.
sla_loop()   — фоновая asyncio-задача: in-app уведомления сотруднику + руководителю.
"""
import asyncio
from datetime import datetime, timedelta, timezone

SLA_DAYS = 7


def sla_status(created_at: datetime, completed_at: datetime | None = None) -> dict:
    """Единый расчёт SLA-статуса для фронта."""
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    deadline = created_at + timedelta(days=SLA_DAYS)
    now = datetime.now(timezone.utc)

    if completed_at is not None:
        if completed_at.tzinfo is None:
            completed_at = completed_at.replace(tzinfo=timezone.utc)
        done_days = (completed_at - created_at).days
        return {
            "deadline": deadline.isoformat(),
            "days_left": max(0, SLA_DAYS - done_days),
            "total_days": SLA_DAYS,
            "status": "done" if done_days < SLA_DAYS else "done_late",
            "started_at": created_at.isoformat(),
        }

    days_left = max(0, (deadline - now).days)
    diff_days = (now - created_at).days

    if diff_days >= SLA_DAYS:
        status = "overdue"
    elif days_left == 0:
        status = "due_today"
    else:
        status = "active"

    return {
        "deadline": deadline.isoformat(),
        "days_left": days_left,
        "total_days": SLA_DAYS,
        "status": status,
        "started_at": created_at.isoformat(),
    }


async def _find_overdue(db) -> list[dict]:
    """Сотрудники с незавершённым Stage 1 и подходящим/просроченным SLA."""
    from sqlalchemy import select

    from app.models import Progress, User
    from app.stages_data import get_stages_sync, normalize_tasks

    all_ids = set(get_stages_sync()[1]["tasks"].keys())
    # Все пользователи (ограничим выборку для производительности)
    users = (await db.execute(
        select(User).order_by(User.created_at.desc()).limit(200)
    )).scalars().all()
    out = []
    for u in users:
        prog = await db.get(Progress, u.id)
        done1 = set(normalize_tasks(prog.done_tasks).get("1", [])) if prog else set()
        if all_ids <= done1:
            continue
        created = u.created_at
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        deadline = created + timedelta(days=SLA_DAYS)
        days_left = max(0, (deadline - now).days)
        diff_days = (now - created).days

        if diff_days < SLA_DAYS - 1:
            continue  # Ещё рано — напоминаем за день (SLA_DAYS - 1 = 6 дней)

        out.append({
            "user_id": u.id, "email": u.email, "name": u.name,
            "days_left": days_left, "diff_days": diff_days,
            "overdue": diff_days >= SLA_DAYS,
            "done": len(done1), "lead_id": u.lead_id,
            "all_task_ids": sorted(all_ids - done1),
        })
    return out


async def _create_notification(db, user_id: int, kind: str, title: str, body: str, meta: dict | None = None) -> bool:
    """Создать in-app уведомление (идемпотентно: не дублирует непрочитанное того же kind).
    Публикует WS-событие для пользователя."""
    from sqlalchemy import select as sa_select

    from app.models import Notification

    existing = (await db.execute(
        sa_select(Notification.id).where(
            Notification.user_id == user_id,
            Notification.kind == kind,
            Notification.read_at.is_(None),
        ).limit(1)
    )).scalar_one_or_none()
    if existing is not None:
        return False

    n = Notification(user_id=user_id, kind=kind, title=title, body=body, meta=meta or {})
    db.add(n)
    await db.flush()

    # WS реалтайм
    from app.notify import publish
    publish({
        "type": "notification", "to_user_id": user_id,
        "notification": {"id": n.id, "kind": kind, "title": title, "body": body},
    })
    return True


async def sla_check_once() -> list[dict]:
    from app.database import SessionLocal

    try:
        async with SessionLocal() as db:
            rows = await _find_overdue(db)
    except Exception as e:
        print(f"sla: check failed: {e}")
        return []

    created_any = False
    for r in rows:
        if r["overdue"]:
            kind_emp = "sla_overdue"
            title = "Онбординг просрочен"
            body = (
                f"Прошла неделя ({r['diff_days']} дн.) с начала онбординга. "
                f"Выполнено {r['done']} задач Stage 1. "
                f"Завершите Этап 1 «Документы и доступы» как можно скорее."
            )
        elif r["days_left"] <= 1:
            kind_emp = "sla_due_today"
            title = "Последний день онбординга"
            body = (
                f"Сегодня последний день ({r['diff_days']} дн. из 7). "
                f"Выполнено {r['done']} задач Stage 1."
            )
        else:
            kind_emp = "sla_warning"
            title = f"Осталось {r['days_left']} дн. до дедлайна"
            body = (
                f"До завершения онбординга осталось {r['days_left']} дн. "
                f"Выполнено {r['done']} задач Stage 1."
            )

        created = await _create_notification(db, r["user_id"], kind_emp, title, body, {
            "days_left": r["days_left"], "diff_days": r["diff_days"],
            "done": r["done"], "overdue": r["overdue"],
        })
        if created:
            created_any = True
            print(f"sla: [{kind_emp}] user={r['user_id']} {r['email']} days={r['diff_days']}")

        # Руководителю — только при просрочке
        if r["overdue"] and r["lead_id"]:
            lead_kind = f"sla_lead_{r['user_id']}"
            tasks_list = ", ".join(r["all_task_ids"][:5])
            created_lead = await _create_notification(
                db, r["lead_id"], lead_kind,
                f"Просрочка: {r['name']} ({r['email']})",
                f"Сотрудник просрочил онбординг на {r['diff_days']} дн. "
                f"Незавершённые задачи: {tasks_list}.",
                {"target_user_id": r["user_id"], "diff_days": r["diff_days"]},
            )
            if created_lead:
                print(f"sla: [{lead_kind}] → lead_id={r['lead_id']}")

    if created_any:
        try:
            await db.commit()
        except Exception:
            pass

    return rows


async def sla_loop(interval_seconds: int = 24 * 3600) -> None:
    # первая проверка вскоре после старта (поймать уже-просроченных), дальше по интервалу
    await asyncio.sleep(30)
    while True:
        await sla_check_once()
        await asyncio.sleep(interval_seconds)
