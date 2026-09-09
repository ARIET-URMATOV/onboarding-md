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
    ConfluenceConfirmIn,
    MpulseCodeIn,
    OkOut,
    ProgressOut,
    StageActionIn,
    TaskIn,
    VerifyTargetIn,
    VoiceIn,
    WifiMacIn,
    WifiVerifyIn,
)
from app.stages_data import STAGES, compute_level, compute_xp, is_all_complete, normalize_tasks

# Step 1: документы (HR-верификация, 5 баллов)
DOC_TASKS = {"1-dogovor", "1-nda", "1-pdp", "1-ip", "1-sn"}
# Step 2: доступы (0 баллов, staff-верификация; wifi — пароль)
ACCESS_TASKS = {"1-mbusiness", "1-accountant", "1-wifi", "1-proxy", "1-telegram"}
# Step 3: MPulse (5 баллов, код)
MPULSE_TASKS = ["1-mpulse", "1-mpulse-schedule", "1-mpulse-checkin", "1-mpulse-code", "1-mpulse-news"]
# Step 4: Confluence (10 баллов, таймер 120с)
CONFLUENCE_TASKS = [
    "1-confluence-vacation", "1-confluence-grading", "1-confluence-info",
    "1-confluence-rules", "1-confluence-security", "1-confluence-benefits",
    "1-confluence-contact", "1-confluence-faq",
]
CONFLUENCE_READ = "1-confluence-read"

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

    prog = await load_progress(db, user)
    tasks = normalize_tasks(prog.done_tasks)
    sid = str(payload.stage_id)
    cur = tasks[sid]
    if payload.task_id in cur:
        tasks[sid] = [t for t in cur if t != payload.task_id]
    else:
        tasks[sid] = [*cur, payload.task_id]
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
    return await save_progress(db, prog, tasks)


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
    return await save_progress(db, prog, tasks)


@router.post("/wifi-mac", response_model=OkOut)
@limiter.limit("10/minute")
async def wifi_mac(
    request: Request,
    payload: WifiMacIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Сотрудник отправляет MAC-адрес (sysadmin добавляет в allowlist)."""
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
    # NB: отправка MAC ≠ верификация: 1-wifi отмечает staff через /verify-access
    # (или пароль через /wifi-verify). done_tasks не трогаем.
    return OkOut()


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


@router.post("/wifi-verify", response_model=ProgressOut)
@limiter.limit("10/minute")
async def wifi_verify(
    request: Request,
    payload: WifiVerifyIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Сотрудник вводит Wi-Fi пароль (персональный из wifi_passwords, fallback WIFI_PASSWORD)."""
    import hmac

    from app.models import WifiPassword

    expected: str | None = None
    row = await db.get(WifiPassword, user.id)
    if row is not None:
        from app.crypto import decrypt_secret

        try:
            expected = decrypt_secret(row.password_encrypted)
        except ValueError as e:
            raise HTTPException(status_code=500, detail=str(e))
    else:
        expected = settings.wifi_password
    if not hmac.compare_digest(payload.password, expected):
        raise HTTPException(status_code=400, detail="Неверный пароль Wi-Fi")
    prog = await load_progress(db, user)
    tasks = normalize_tasks(prog.done_tasks)
    if "1-wifi" not in tasks["1"]:
        tasks["1"] = [*tasks["1"], "1-wifi"]
    await log_verification(db, user.id, "1-wifi", "technical_password")
    return await save_progress(db, prog, tasks)


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
    return await save_progress(db, prog, tasks)


@router.post("/confirm-confluence", response_model=ProgressOut)
@limiter.limit("10/minute")
async def confirm_confluence(
    request: Request,
    payload: ConfluenceConfirmIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """«Я ознакомился» — идемпотентно, минимум 120с после открытия (confluence_min_seconds)."""
    from datetime import datetime, timezone

    if CONFLUENCE_READ in normalize_tasks((await load_progress(db, user)).done_tasks)["1"]:
        prog = await load_progress(db, user)
        return await save_progress(db, prog, prog.done_tasks)
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
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=400, detail="Неверный opened_at")
    else:
        raise HTTPException(status_code=400, detail="Нет отметки времени открытия")
    prog = await load_progress(db, user)
    tasks = normalize_tasks(prog.done_tasks)
    for tid in [*CONFLUENCE_TASKS, CONFLUENCE_READ]:
        if tid not in tasks["1"]:
            tasks["1"].append(tid)
    await log_verification(db, user.id, CONFLUENCE_READ, "technical_timer",
                           details={"opened_at": payload.opened_at, "elapsed_s": round(elapsed_s, 1)})
    return await save_progress(db, prog, tasks)
