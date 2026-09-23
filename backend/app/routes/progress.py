from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select as _select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.limiter import limiter
from app.models import MpulseCode, Progress, User, VerificationLog, WifiMac
from app.routes.auth import get_current_user, require_role, require_staff
from app.schemas import (
    BatchRequestIn,
    ConfluenceConfirmIn,
    InfoReadIn,
    MpulseCodeIn,
    OkOut,
    ProgressOut,
    RequestIn,
    StageActionIn,
    TaskIn,
    VerifyTargetIn,
    VoiceIn,
    WifiMacIn,
)
from app.stages_data import STAGES, compute_level, compute_xp, is_all_complete, normalize_tasks, task_meta

# Step 1: документы (HR-верификация, 5 баллов)
DOC_TASKS = {"1-dogovor", "1-nda", "1-pdp", "1-ip", "1-sn"}
# Step 2: доступы (0 баллов, staff-верификация; wifi — пароль)
ACCESS_TASKS = {"1-mbusiness", "1-accountant", "1-wifi", "1-proxy", "1-telegram",
                "1-jira", "1-figma", "1-gitlab"}
# Step 3: MPulse (5 баллов, код)
MPULSE_TASKS = ["1-mpulse", "1-mpulse-schedule", "1-mpulse-checkin", "1-mpulse-code", "1-mpulse-news"]
# Step 4: Confluence (10 баллов, один тогглер; 5 обязательных ссылок + видимый таймер 120с)
CONFLUENCE_READ = "1-confluence-read"
# Info-read tasks: модалки со скролл-чекером (документы + доступы + mpulse)
INFO_READ_TASKS: set[str] = DOC_TASKS | ACCESS_TASKS | set(MPULSE_TASKS) - {"1-telegram"}

router = APIRouter()


async def load_progress(db: AsyncSession, user: User) -> Progress:
    prog = await db.get(Progress, user.id, with_for_update=True)
    if prog is None:
        prog = Progress(user_id=user.id)
        db.add(prog)
        try:
            await db.commit()
        except Exception:
            await db.rollback()
            prog2 = await db.get(Progress, user.id)
            if prog2 is not None:
                return prog2
            raise
        await db.refresh(prog)
    return prog


async def log_verification(
    db: AsyncSession,
    user_id: int,
    task_id: str,
    method: str,
    verified_by: int | None = None,
    details: dict | None = None,
) -> None:
    """Аудит: кто/что/когда/кем подтверждён (идемпотентно — дубль не пишем)."""
    import json

    from sqlalchemy import select

    res = await db.execute(
        select(VerificationLog).where(
            VerificationLog.user_id == user_id,
            VerificationLog.task_id == task_id,
            VerificationLog.method == method,
        )
    )
    if res.scalar_one_or_none() is None:
        db.add(VerificationLog(
            user_id=user_id, task_id=task_id, verified_by=verified_by, method=method,
            details=json.dumps(details or {}, ensure_ascii=False),
        ))


async def save_progress(db: AsyncSession, prog: Progress, done_tasks: dict) -> ProgressOut:
    from datetime import datetime, timezone

    prog.done_tasks = normalize_tasks(done_tasks)
    prog.xp = compute_xp(prog.done_tasks)
    if is_all_complete(prog.done_tasks):
        if prog.completed_at is None:
            prog.completed_at = datetime.now(timezone.utc)
    else:
        prog.completed_at = None
    db.add(prog)
    await db.commit()
    await db.refresh(prog)
    return ProgressOut(
        done_tasks=prog.done_tasks,
        xp=prog.xp,
        level=compute_level(prog.xp),
        completed_at=prog.completed_at.isoformat() if prog.completed_at else None,
    )


@router.post("/progress/task", response_model=ProgressOut)
@limiter.limit("30/minute")
async def toggle_task(
    request: Request,
    payload: TaskIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role),
):
    stage = STAGES.get(payload.stage_id)
    if stage is None or payload.task_id not in stage["tasks"]:
        raise HTTPException(status_code=400, detail="Неизвестная задача")

    # Замок TZ: задачи с верификацией нельзя закрыть свободным кликом.
    # manual_* → POST /progress/request (HR очередь); technical_* → код/таймер/пароль;
    # self_link → POST /progress/self-link (авто-зачёт при переходе по ссылке).
    vt, _rr = task_meta(payload.task_id)
    if vt == "manual_hr":
        raise HTTPException(status_code=403, detail="Защита от случайных галочек: документы подтверждает HR. Нажмите «Я передал документы HR».")
    if vt == "manual_staff":
        raise HTTPException(status_code=403, detail="Доступ подтверждает staff. Отправьте запрос на верификацию.")
    if vt in ("technical_code", "technical_timer", "technical_password", "self_link"):
        raise HTTPException(status_code=403, detail="Эта задача закрывается автоматически.")

    prog = await load_progress(db, user)
    tasks = normalize_tasks(prog.done_tasks)
    sid = str(payload.stage_id)
    cur = tasks[sid]
    if payload.task_id in cur:
        tasks[sid] = [t for t in cur if t != payload.task_id]
    else:
        tasks[sid] = [*cur, payload.task_id]
    return await save_progress(db, prog, tasks)


@router.get("/progress/pending")
@limiter.limit("30/minute")
async def my_pending(
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Мои ожидающие + отклонённые запросы (для статусов на фронте)."""
    from sqlalchemy import select as _select

    from app.models import PendingRequest

    rows = (
        await db.execute(
            _select(PendingRequest).where(
                PendingRequest.user_id == user.id,
                PendingRequest.status.in_(["pending", "rejected"]),
            )
        )
    ).scalars().all()
    return {
        "pending": [r.task_id for r in rows if r.status == "pending"],
        "rejected": [{"task_id": r.task_id, "note": r.note} for r in rows if r.status == "rejected"],
    }


@router.post("/progress/request", response_model=ProgressOut)
@limiter.limit("30/minute")
async def request_verification(
    request: Request,
    payload: RequestIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role),
):
    """Сотрудник создаёт запрос на верификацию (manual_hr/manual_staff).

    XP не начисляется — только статус «Ожидает HR». HR подтверждает через /verify-*.
    Идемпотентно: повтор возвращает текущий прогресс.
    """
    from sqlalchemy import select as _select

    from app.models import PendingRequest

    stage = STAGES.get(1)
    if payload.task_id not in stage["tasks"]:
        raise HTTPException(status_code=400, detail="Неизвестная задача")
    vt, _rr = task_meta(payload.task_id)
    if vt not in ("manual_hr", "manual_staff"):
        raise HTTPException(status_code=400, detail="Эта задача не требует запроса (код/таймер/пароль)")
    prog = await load_progress(db, user)
    tasks = normalize_tasks(prog.done_tasks)
    if payload.task_id in tasks["1"]:
        return await save_progress(db, prog, tasks)  # уже подтверждена
    existing = await db.execute(
        _select(PendingRequest).where(
            PendingRequest.user_id == user.id,
            PendingRequest.task_id == payload.task_id,
            PendingRequest.status == "pending",
        )
    )
    if existing.scalar_one_or_none() is None:
        # resubmit после reject: старые rejected-строки той же задачи — в историю не нужны
        # как дубли; помечаем их superseded, создаём свежий pending
        old_rej = await db.execute(
            _select(PendingRequest).where(
                PendingRequest.user_id == user.id,
                PendingRequest.task_id == payload.task_id,
                PendingRequest.status == "rejected",
            )
        )
        for r in old_rej.scalars().all():
            r.status = "superseded"
            db.add(r)
        db.add(PendingRequest(
            user_id=user.id, task_id=payload.task_id,
            note=payload.note.strip()[:300], status="pending",
        ))
        await db.commit()
        from app.notify import notify_new_request, publish

        publish({"type": "pending_new", "email": user.email, "name": user.name,
                 "task_id": payload.task_id})
        await notify_new_request(user.email, user.name, payload.task_id, db=db, user=user)
    return await save_progress(db, prog, tasks)


@router.post("/progress/request-batch", response_model=ProgressOut)
@limiter.limit("10/minute")
async def request_batch(
    request: Request,
    payload: BatchRequestIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role),
):
    """Одна кнопка «Подписал документы, отправить на проверку HR»: весь пакет разом.

    Создаёт pending-запросы только для manual_* задач, которых ещё нет ни в done,
    ни в pending. XP не начисляется. Одно уведомление HR с именем сотрудника.
    """
    from sqlalchemy import select as _select

    from app.models import PendingRequest

    stage = STAGES.get(1)
    wanted: list[str] = []
    for raw in payload.task_ids:
        tid = str(raw).strip()
        if tid not in stage["tasks"]:
            raise HTTPException(status_code=400, detail=f"Неизвестная задача: {tid}")
        vt, _rr = task_meta(tid)
        if vt not in ("manual_hr", "manual_staff"):
            raise HTTPException(status_code=400, detail=f"Задача {tid} не требует запроса (код/таймер/пароль)")
        wanted.append(tid)
    prog = await load_progress(db, user)
    tasks = normalize_tasks(prog.done_tasks)
    done = set(tasks["1"])
    created = 0
    for tid in wanted:
        if tid in done:
            continue
        existing = await db.execute(
            _select(PendingRequest).where(
                PendingRequest.user_id == user.id,
                PendingRequest.task_id == tid,
                PendingRequest.status == "pending",
            )
        )
        if existing.scalar_one_or_none() is None:
            old_rej = await db.execute(
                _select(PendingRequest).where(
                    PendingRequest.user_id == user.id,
                    PendingRequest.task_id == tid,
                    PendingRequest.status == "rejected",
                )
            )
            for r in old_rej.scalars().all():
                r.status = "superseded"
                db.add(r)
            db.add(PendingRequest(
                user_id=user.id, task_id=tid,
                note=payload.note.strip()[:300], status="pending",
            ))
            created += 1
    if created:
        await db.commit()
        from app.notify import notify_new_request, publish

        publish({"type": "pending_new_batch", "email": user.email, "name": user.name,
                 "task_ids": wanted})
        await notify_new_request(user.email, user.name, ", ".join(wanted), batch=True, db=db, user=user)
    return await save_progress(db, prog, tasks)


@router.post("/progress/stage", response_model=ProgressOut)
@limiter.limit("30/minute")
async def stage_action(
    request: Request,
    payload: StageActionIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role),
):
    stage = STAGES.get(payload.stage_id)
    if stage is None:
        raise HTTPException(status_code=400, detail="Неизвестный этап")

    # Замок TZ: Этап 1 нельзя закрыть массово — только по одной задаче через верификацию.
    if payload.stage_id == 1 and payload.action == "complete" and not user.is_staff:
        raise HTTPException(status_code=403, detail="Этап 1 закрывается только через верификацию каждой задачи.")

    prog = await load_progress(db, user)
    tasks = normalize_tasks(prog.done_tasks)
    sid = str(payload.stage_id)

    if payload.action == "complete":
        all_ids = list(stage["tasks"].keys())
        tasks[sid] = all_ids
    else:  # uncomplete
        tasks[sid] = []

    return await save_progress(db, prog, tasks)


@router.post("/intro-seen", response_model=OkOut)
@limiter.limit("30/minute")
async def intro_seen(
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not user.intro_seen:
        user.intro_seen = True
        db.add(user)
        await db.commit()
    return OkOut()


@router.post("/voice", response_model=OkOut)
@limiter.limit("30/minute")
async def set_voice(
    request: Request,
    payload: VoiceIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.voice_enabled != payload.enabled:
        user.voice_enabled = payload.enabled
        db.add(user)
        await db.commit()
    return OkOut()


@router.post("/verify-docs", response_model=ProgressOut)
@limiter.limit("10/minute")
async def verify_docs(
    request: Request,
    payload: VerifyTargetIn,
    db: AsyncSession = Depends(get_db),
    staff: User = Depends(require_staff),
):
    """Staff подтверждает документы сотрудника (Step 1, 5 баллов).

    Сотрудник сначала отмечает свои 5 задач через /progress/task
    (статус «ожидает HR»), staff подтверждает каждую по task_id.
    """
    if payload.task_id not in DOC_TASKS:
        raise HTTPException(status_code=400, detail="Не задача Step 1")
    target = await db.get(User, payload.user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="Сотрудник не найден")
    prog = await load_progress(db, target)
    tasks = normalize_tasks(prog.done_tasks)
    if payload.task_id not in tasks["1"]:
        tasks["1"] = [*tasks["1"], payload.task_id]
    await log_verification(db, target.id, payload.task_id, "manual_hr", staff.id)
    out = await save_progress(db, prog, tasks)
    # закрыть запрос + уведомить сотрудника (письмо + WS)
    from sqlalchemy import select as _select

    from app.models import PendingRequest
    from app.notify import notify_verified

    req = await db.execute(
        _select(PendingRequest).where(
            PendingRequest.user_id == target.id,
            PendingRequest.task_id == payload.task_id,
            PendingRequest.status == "pending",
        )
    )
    row = req.scalar_one_or_none()
    if row is not None:
        row.status = "verified"
        db.add(row)
        await db.commit()
    await notify_verified(target.email, payload.task_id, out.xp)
    return out


@router.post("/verify-docs-batch", response_model=ProgressOut)
@limiter.limit("10/minute")
async def verify_docs_batch(
    request: Request,
    payload: BatchRequestIn,
    db: AsyncSession = Depends(get_db),
    staff: User = Depends(require_staff),
):
    """HR одной кнопкой «Подтвердить получение и проверку документов»: весь пакет.

    task_ids должны быть из DOC_TASKS. Отмечает done + audit + закрывает pending,
    начисляет XP (5×1=5), уведомляет сотрудника.
    """
    from sqlalchemy import select as _select

    from app.models import PendingRequest

    wanted: list[str] = []
    for raw in payload.task_ids:
        tid = str(raw).strip()
        if tid not in DOC_TASKS:
            raise HTTPException(status_code=400, detail=f"Не задача Step 1: {tid}")
        wanted.append(tid)
    if not wanted:
        raise HTTPException(status_code=400, detail="Пустой пакет")
    if payload.user_id is None:
        raise HTTPException(status_code=400, detail="Укажите user_id сотрудника")
    target = await db.get(User, payload.user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="Сотрудник не найден")
    prog = await load_progress(db, target)
    tasks = normalize_tasks(prog.done_tasks)
    for tid in wanted:
        if tid not in tasks["1"]:
            tasks["1"].append(tid)
        await log_verification(db, target.id, tid, "manual_hr", staff.id)
        req = await db.execute(
            _select(PendingRequest).where(
                PendingRequest.user_id == target.id,
                PendingRequest.task_id == tid,
                PendingRequest.status == "pending",
            )
        )
        r = req.scalar_one_or_none()
        if r is not None:
            r.status = "verified"
            db.add(r)
    out = await save_progress(db, prog, tasks)
    # одно событие на пакет (не 5): один тост + одно письмо за весь Stage
    from app.notify import notify_verified_batch

    await notify_verified_batch(target.email, wanted, out.xp)
    return out


@router.post("/verify-access", response_model=ProgressOut)
@limiter.limit("10/minute")
async def verify_access(
    request: Request,
    payload: VerifyTargetIn,
    db: AsyncSession = Depends(get_db),
    staff: User = Depends(require_staff),
):
    """Staff подтверждает доступ сотрудника (Step 2, 0 баллов).

    Единая точка для MBusiness / бухгалтера / Wi-Fi / proxy / Telegram.
    Ответственная роль отображается на фронте подписью, бекенд не делит staff.
    """
    if payload.task_id not in ACCESS_TASKS:
        raise HTTPException(status_code=400, detail="Не задача Step 2")
    target = await db.get(User, payload.user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="Сотрудник не найден")
    prog = await load_progress(db, target)
    tasks = normalize_tasks(prog.done_tasks)
    if payload.task_id not in tasks["1"]:
        tasks["1"] = [*tasks["1"], payload.task_id]
    await log_verification(db, target.id, payload.task_id, "manual_staff", staff.id)
    out = await save_progress(db, prog, tasks)
    from sqlalchemy import select as _select

    from app.models import PendingRequest
    from app.notify import notify_verified

    req = await db.execute(
        _select(PendingRequest).where(
            PendingRequest.user_id == target.id,
            PendingRequest.task_id == payload.task_id,
            PendingRequest.status == "pending",
        )
    )
    row = req.scalar_one_or_none()
    if row is not None:
        row.status = "verified"
        db.add(row)
        await db.commit()
    await notify_verified(target.email, payload.task_id, out.xp)
    return out


@router.post("/wifi-mac", response_model=ProgressOut)
@limiter.limit("10/minute")
async def wifi_mac(
    request: Request,
    payload: WifiMacIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Сотрудник отправляет MAC-адрес → сетевик получает + авто-зачёт 1-wifi."""
    import re

    mac = payload.mac.strip().upper()
    if not re.fullmatch(r"([0-9A-F]{2}[:-]){5}[0-9A-F]{2}", mac):
        raise HTTPException(status_code=400, detail="Неверный формат MAC")
    from sqlalchemy import select as _select

    existing = await db.execute(
        _select(WifiMac).where(WifiMac.user_id == user.id, WifiMac.mac == mac)
    )
    if existing.scalar_one_or_none() is None:
        db.add(WifiMac(user_id=user.id, mac=mac))
        await db.commit()
    # Авто-зачёт 1-wifi при отправке MAC (сетевик задаёт пароль отдельно)
    prog = await load_progress(db, user)
    tasks = normalize_tasks(prog.done_tasks)
    if "1-wifi" not in tasks["1"]:
        tasks["1"] = [*tasks["1"], "1-wifi"]
    await log_verification(db, user.id, "1-wifi", "technical_password",
                           details={"via": "mac_submit"})
    out = await save_progress(db, prog, tasks)
    from app.notify import notify_verified

    await notify_verified(user.email, "1-wifi", out.xp)
    return out


@router.post("/progress/self-link", response_model=ProgressOut)
@limiter.limit("10/minute")
async def self_link_task(
    request: Request,
    payload: TaskIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role),
):
    """Сотрудник подтвердил вход в сервис по ссылке _blank (jira/figma/gitlab).

    Идемпотентно: повторный вызов возвращает текущий прогресс.
    """
    stage = STAGES.get(payload.stage_id)
    if stage is None or payload.task_id not in stage["tasks"]:
        raise HTTPException(status_code=400, detail="Неизвестная задача")
    vt, _rr = task_meta(payload.task_id)
    if vt != "self_link":
        raise HTTPException(
            status_code=400,
            detail=f"Задача {payload.task_id} не является self_link (тип: {vt})",
        )
    prog = await load_progress(db, user)
    tasks = normalize_tasks(prog.done_tasks)
    sid = str(payload.stage_id)
    if payload.task_id not in tasks[sid]:
        tasks[sid] = [*tasks[sid], payload.task_id]
        await log_verification(db, user.id, payload.task_id, "self_link",
                               details={"via": "_blank_redirect"})
    return await save_progress(db, prog, tasks)


@router.post("/progress/info-read", response_model=ProgressOut)
@limiter.limit("30/minute")
async def info_read_task(
    request: Request,
    payload: InfoReadIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Сотрудник подтвердил прочтение инфо-модалки (скролл-чекер → авто-зачёт).

    Идемпотентно: повторный вызов возвращает текущий прогресс.
    Для MPulse: зачёт одной задачи зачёtyает все 5 mpulse-задач.
    """
    stage = STAGES.get(payload.stage_id)
    if stage is None or payload.task_id not in stage["tasks"]:
        raise HTTPException(status_code=400, detail="Неизвестная задача")
    vt, _rr = task_meta(payload.task_id)
    if vt != "info_read":
        raise HTTPException(
            status_code=400,
            detail=f"Задача {payload.task_id} не является info_read (тип: {vt})",
        )
    prog = await load_progress(db, user)
    tasks = normalize_tasks(prog.done_tasks)
    sid = str(payload.stage_id)
    to_add: list[str] = []
    if payload.task_id not in tasks[sid]:
        to_add.append(payload.task_id)
    # MPulse batch: любая mpulse-задача → все 5
    if payload.task_id in MPULSE_TASKS:
        for tid in MPULSE_TASKS:
            if tid not in tasks[sid]:
                to_add.append(tid)
    if to_add:
        tasks[sid] = [*tasks[sid], *to_add]
        await log_verification(db, user.id, payload.task_id, "info_read",
                               details={"via": "scroll_checker", "batch": len(to_add) > 1})
    return await save_progress(db, prog, tasks)


@router.get("/wifi-status")
@limiter.limit("30/minute")
async def wifi_status(
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """MAC отправлен? Wi-Fi верифицирован? (для разделения pending/verified на фронте)."""
    from sqlalchemy import select as _select

    res = await db.execute(_select(WifiMac).where(WifiMac.user_id == user.id).limit(1))
    mac_sent = res.scalar_one_or_none() is not None
    prog = await db.get(Progress, user.id)
    verified = prog is not None and "1-wifi" in normalize_tasks(prog.done_tasks).get("1", [])
    return {"mac_sent": mac_sent, "verified": verified}


@router.get("/wifi-password")
@limiter.limit("30/minute")
async def wifi_password_shown(
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Пароль для показа сотруднику (персональный из wifi_passwords, иначе env fallback).

    Виден только после отправки MAC. Сетевик вводит пароль в /admin, система
    показывает его здесь — пароль из Telegram не парсится (см. план Шаг 2.3).
    """
    from sqlalchemy import select as _select

    from app.crypto import decrypt_secret
    from app.models import WifiMac, WifiPassword

    mac_row = await db.execute(_select(WifiMac).where(WifiMac.user_id == user.id).limit(1))
    if mac_row.scalar_one_or_none() is None:
        return {"password": None, "mac_sent": False}
    row = await db.get(WifiPassword, user.id)
    if row is not None:
        try:
            return {"password": decrypt_secret(row.password_encrypted), "mac_sent": True}
        except ValueError as e:
            raise HTTPException(status_code=500, detail=str(e))
    return {"password": settings.wifi_password, "mac_sent": True}





@router.post("/verify-mpulse-code", response_model=ProgressOut)
@limiter.limit("10/minute")
async def verify_mpulse_code(
    request: Request,
    payload: MpulseCodeIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Сотрудник вводит код из MPulse (активный код mpulse_codes, fallback MPULSE_VERIFICATION_CODE)."""
    import hmac

    code = payload.code.strip()
    ok = hmac.compare_digest(code, settings.mpulse_verification_code)
    if not ok:
        now = datetime.now(timezone.utc)
        rows = (
            await db.execute(_select(MpulseCode).where(MpulseCode.is_active))
        ).scalars().all()
        for r in rows:
            if r.valid_from and now < r.valid_from:
                continue
            if r.valid_until and now > r.valid_until:
                continue
            if hmac.compare_digest(code, r.code):
                ok = True
                break
    # динамическая проверка через API MPulse (если настроен) — best effort, не блокирует
    api_used = False
    if not ok and settings.mpulse_api_url:
        import httpx

        try:
            async with httpx.AsyncClient(timeout=2.0) as client:
                resp = await client.post(settings.mpulse_api_url, json={"code": code})
                data = resp.json() if resp.status_code == 200 else {}
                ok = bool(data.get("ok") or data.get("valid") or data.get("verified"))
                api_used = True
        except Exception as e:
            print(f"mpulse api verify failed: {e}")
    if not ok:
        raise HTTPException(status_code=400, detail="Неверный код MPulse")
    prog = await load_progress(db, user)
    tasks = normalize_tasks(prog.done_tasks)
    cur = set(tasks["1"])
    for tid in MPULSE_TASKS:
        if tid not in cur:
            tasks["1"].append(tid)
    await log_verification(db, user.id, "1-mpulse-code", "technical_code",
                           details={"via_api": api_used})
    out = await save_progress(db, prog, tasks)
    from app.notify import notify_verified

    await notify_verified(user.email, "1-mpulse-code", out.xp)
    return out


@router.post("/confirm-confluence", response_model=ProgressOut)
@limiter.limit("10/minute")
async def confirm_confluence(
    request: Request,
    payload: ConfluenceConfirmIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """«Я ознакомился» — идемпотентно: все видимые Confluence-страницы + 120с."""
    import json
    import re
    from datetime import datetime, timezone

    from sqlalchemy import select as _select

    from app.models import ExternalService

    if CONFLUENCE_READ in normalize_tasks((await load_progress(db, user)).done_tasks)["1"]:
        prog = await load_progress(db, user)
        return await save_progress(db, prog, prog.done_tasks)
    # динамический набор pageId из видимых knowledge-сервисов
    rows = (await db.execute(
        _select(ExternalService).where(
            ExternalService.category == "knowledge", ExternalService.is_visible == True  # noqa: E712
        ).order_by(ExternalService.sort_order)
    )).scalars().all()
    required_page_ids: set[str] = set()
    for s in rows:
        try:
            extra = s.extra if isinstance(s.extra, dict) else json.loads(str(s.extra or "{}"))
        except Exception:
            extra = {}
        pid = str(extra.get("pageId", "")).strip()
        if pid:
            required_page_ids.add(pid)
    if not required_page_ids:
        # fallback: если таблица пуста (тесты / до сида), используем захардкоженные
        required_page_ids = {"51479172", "15370476", "86868582", "86868604", "51478978"}
    # все pageId (list голых id/URL или dict {pageId: iso-клик})
    raw_map: dict[str, str] = {}
    items = payload.links_clicked.items() if isinstance(payload.links_clicked, dict) else [(str(x), "") for x in payload.links_clicked]
    for raw, ts in items:
        m = re.search(r"pageId=(\d+)", str(raw))
        pid = m.group(1) if m else str(raw).strip()
        raw_map[pid] = str(ts or "")
    missing = required_page_ids - set(raw_map)
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Откройте все {len(required_page_ids)} страниц Confluence (не хватает: {len(missing)})",
        )
    elapsed_s = 0.0
    if payload.opened_at:
        try:
            opened = datetime.fromisoformat(payload.opened_at.replace("Z", "+00:00"))
            elapsed_s = (datetime.now(timezone.utc) - opened).total_seconds()
            if elapsed_s < settings.confluence_min_seconds:
                raise HTTPException(
                    status_code=400,
                    detail=f"Читайте ещё {int(settings.confluence_min_seconds - elapsed_s)} сек",
                )
            # opened_at должен соответствовать первому клику (±5 мин) — ловим подделку timestamps
            try:
                first_click = min(
                    datetime.fromisoformat(v.replace("Z", "+00:00"))
                    for v in raw_map.values() if v
                )
                if abs((opened - first_click).total_seconds()) > 300:
                    raise HTTPException(status_code=400, detail="Метка времени не совпадает с кликами")
            except HTTPException:
                raise
            except Exception:
                pass  # старых клиентов без per-link ts не трогаем
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=400, detail="Неверный opened_at")
    else:
        raise HTTPException(status_code=400, detail="Нет отметки времени открытия")
    prog = await load_progress(db, user)
    tasks = normalize_tasks(prog.done_tasks)
    if CONFLUENCE_READ not in tasks["1"]:
        tasks["1"].append(CONFLUENCE_READ)
    await log_verification(db, user.id, CONFLUENCE_READ, "technical_timer",
                           details={"opened_at": payload.opened_at,
                                    "elapsed_s": round(elapsed_s, 1),
                                    "links": raw_map})
    out = await save_progress(db, prog, tasks)
    from app.notify import notify_verified

    await notify_verified(user.email, CONFLUENCE_READ, out.xp)
    return out
