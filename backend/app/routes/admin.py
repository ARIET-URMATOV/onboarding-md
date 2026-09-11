import re

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.limiter import limiter
from app.models import AppSetting, MpulseCode, Progress, User, VerificationLog
from app.routes.auth import require_staff
from app.schemas import (
    CONTACT_KEYS,
    INSTRUCTION_KEYS,
    AdminUserOut,
    AuditOut,
    LeadSetIn,
    MpulseCodeOut,
    MpulseRotateIn,
    OkOut,
    PendingRequestOut,
    RejectIn,
    SettingIn,
    SettingsOut,
    StaffSetIn,
    WifiPasswordIn,
)
from app.stages_data import normalize_tasks


def _mpulse_out(r: MpulseCode) -> MpulseCodeOut:
    return MpulseCodeOut(
        id=r.id,
        code=r.code,
        batch_name=r.batch_name,
        is_active=r.is_active,
        valid_from=r.valid_from.isoformat() if r.valid_from else None,
        valid_until=r.valid_until.isoformat() if r.valid_until else None,
        created_at=r.created_at.isoformat() if r.created_at else None,
    )

router = APIRouter()


def _admin_user_out(
    user: User, done_stage1: list[str] | None = None, lead_email: str = ""
) -> AdminUserOut:
    return AdminUserOut(
        id=user.id,
        email=user.email,
        name=user.name,
        role=user.role,
        is_staff=user.is_staff,
        created_at=user.created_at.isoformat() if user.created_at else None,
        done_stage1=done_stage1 or [],
        lead_email=lead_email,
    )


async def _lead_email(db: AsyncSession, user: User) -> str:
    if not getattr(user, "lead_id", None):
        return ""
    lead = await db.get(User, user.lead_id)
    return lead.email if lead is not None else ""


@router.get("/admin/users", response_model=list[AdminUserOut])
@limiter.limit("30/minute")
async def list_users(
    request: Request,
    q: str = "",
    db: AsyncSession = Depends(get_db),
    staff: User = Depends(require_staff),
):
    """Поиск сотрудников (email/name) + их done stage 1 для панели HR."""
    stmt = select(User).order_by(desc(User.created_at)).limit(50)
    if q.strip():
        like = f"%{q.strip().lower()}%"
        stmt = select(User).where(
            (User.email.ilike(like)) | (User.name.ilike(like))
        ).order_by(desc(User.created_at)).limit(50)
    users = (await db.execute(stmt)).scalars().all()
    out = []
    for u in users:
        prog = await db.get(Progress, u.id)
        done1: list[str] = []
        if prog is not None:
            done1 = normalize_tasks(prog.done_tasks).get("1", [])
        out.append(_admin_user_out(u, done1, await _lead_email(db, u)))
    return out


@router.get("/admin/pending-verifications", response_model=list[PendingRequestOut])
@limiter.limit("30/minute")
async def pending_verifications(
    request: Request,
    db: AsyncSession = Depends(get_db),
    staff: User = Depends(require_staff),
):
    """Очередь запросов сотрудников (pending_requests), новые сверху."""
    from app.models import PendingRequest
    from app.schemas import PendingRequestOut

    rows = (
        await db.execute(
            select(PendingRequest, User)
            .join(User, User.id == PendingRequest.user_id)
            .where(PendingRequest.status == "pending")
            .order_by(desc(PendingRequest.created_at))
            .limit(100)
        )
    ).all()
    return [
        PendingRequestOut(
            id=r.id, user_id=r.user_id, email=u.email, name=u.name,
            task_id=r.task_id, note=r.note,
            created_at=r.created_at.isoformat() if r.created_at else None,
        )
        for r, u in rows
    ]


@router.get("/admin/pending-count")
@limiter.limit("30/minute")
async def pending_count(
    request: Request,
    db: AsyncSession = Depends(get_db),
    staff: User = Depends(require_staff),
):
    """Счётчик для колокольчика TopBar."""
    from sqlalchemy import func

    from app.models import PendingRequest

    n = (await db.execute(
        select(func.count()).select_from(PendingRequest).where(PendingRequest.status == "pending")
    )).scalar() or 0
    return {"pending": n}


@router.post("/admin/pending/{pending_id}/reject", response_model=OkOut)
@limiter.limit("20/minute")
async def reject_pending(
    pending_id: int,
    payload: RejectIn,
    request: Request,
    db: AsyncSession = Depends(get_db),
    staff: User = Depends(require_staff),
):
    """Отклонить запрос с обязательной причиной (мин 10 символов).

    Причина пишется в pending.note + audit details, сотрудник уведомляется
    письмом и WS; статус у него остаётся «Ожидает проверки» до повторной отправки.
    """
    import json

    from app.models import PendingRequest, VerificationLog
    from app.notify import notify_rejected

    row = await db.get(PendingRequest, pending_id)
    if row is None or row.status != "pending":
        raise HTTPException(status_code=404, detail="Запрос не найден")
    reason = payload.reason.strip()
    row.status = "rejected"
    row.note = reason[:500]
    db.add(row)
    db.add(VerificationLog(
        user_id=row.user_id, task_id=row.task_id, verified_by=staff.id,
        method="rejected", details=json.dumps({"reason": reason}, ensure_ascii=False),
    ))
    await db.commit()
    target = await db.get(User, row.user_id)
    if target is not None:
        await notify_rejected(target.email, target.name, row.task_id, reason)
    return OkOut()


@router.post("/admin/users/{user_id}/reset-stage1", response_model=OkOut)
@limiter.limit("10/minute")
async def reset_stage1(
    user_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    staff: User = Depends(require_staff),
):
    """Сбросить Stage 1 сотрудника (тесты/HR): done, pending, wifi, audit Stage 1."""
    from sqlalchemy import delete

    from app.models import PendingRequest, VerificationLog, WifiMac, WifiPassword
    from app.stages_data import get_stages_sync

    target = await db.get(User, user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="Сотрудник не найден")
    s1 = set(get_stages_sync()[1]["tasks"].keys())
    prog = await db.get(Progress, user_id)
    if prog is not None:
        tasks = normalize_tasks(prog.done_tasks)
        tasks["1"] = []
        prog.done_tasks = normalize_tasks(tasks)
        from app.stages_data import compute_xp

        prog.xp = compute_xp(prog.done_tasks)
        prog.completed_at = None
        db.add(prog)
    await db.execute(delete(PendingRequest).where(PendingRequest.user_id == user_id))
    await db.execute(delete(WifiMac).where(WifiMac.user_id == user_id))
    await db.execute(delete(WifiPassword).where(WifiPassword.user_id == user_id))
    await db.execute(
        delete(VerificationLog).where(
            VerificationLog.user_id == user_id,
            VerificationLog.task_id.in_(s1),
        )
    )
    await db.commit()
    return OkOut()


@router.get("/admin/wifi-requests")
@limiter.limit("30/minute")
async def wifi_requests(
    request: Request,
    db: AsyncSession = Depends(get_db),
    staff: User = Depends(require_staff),
):
    """Wi-Fi запросы: сотрудник, MAC-адреса, есть ли пароль, верифицирован ли."""
    from app.models import WifiMac, WifiPassword

    macs = (await db.execute(select(WifiMac).order_by(desc(WifiMac.created_at)).limit(200))).scalars().all()
    out = []
    seen: set[int] = set()
    for m in macs:
        u = await db.get(User, m.user_id)
        if u is None:
            continue
        has_pw = await db.get(WifiPassword, m.user_id) is not None
        prog = await db.get(Progress, m.user_id)
        verified = prog is not None and "1-wifi" in normalize_tasks(prog.done_tasks).get("1", [])
        out.append({
            "user_id": m.user_id,
            "email": u.email,
            "name": u.name,
            "mac": m.mac,
            "sent_at": m.created_at.isoformat() if m.created_at else None,
            "has_password": has_pw,
            "verified": verified,
        })
        seen.add(m.user_id)
    return out


@router.post("/admin/wifi-password")
@limiter.limit("10/minute")
async def set_wifi_password(
    payload: WifiPasswordIn,
    request: Request,
    db: AsyncSession = Depends(get_db),
    staff: User = Depends(require_staff),
):
    """Сетевик вводит пароль вручную (пусто = сгенерировать сервером).

    Возвращается staff ОДИН раз — система показывает его сотруднику
    в интерфейсе под полем MAC. В БД только Fernet-шифр.
    """
    import secrets

    from app.crypto import encrypt_secret
    from app.models import WifiPassword

    target = await db.get(User, payload.user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="Сотрудник не найден")
    password = payload.password.strip() or secrets.token_urlsafe(12)
    if len(password) < 4:
        raise HTTPException(status_code=400, detail="Пароль слишком короткий (мин 4)")
    row = await db.get(WifiPassword, target.id)
    if row is None:
        row = WifiPassword(user_id=target.id, password_encrypted="", set_by=staff.id)
    row.password_encrypted = encrypt_secret(password)
    row.set_by = staff.id
    db.add(row)
    await db.commit()
    from app.notify import publish

    publish({"type": "wifi_password", "email": target.email, "user_id": target.id})
    return {"ok": True, "password": password, "user_id": target.id}


@router.patch("/admin/users/{user_id}/staff", response_model=AdminUserOut)
@limiter.limit("20/minute")
async def set_staff(
    user_id: int,
    payload: StaffSetIn,
    request: Request,
    db: AsyncSession = Depends(get_db),
    staff: User = Depends(require_staff),
):
    """Выдать/снять staff (HR) без прямого доступа к БД."""
    from sqlalchemy import func

    if user_id == staff.id and not payload.is_staff:
        raise HTTPException(status_code=400, detail="Нельзя снять staff с себя")
    target = await db.get(User, user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="Сотрудник не найден")
    if target.is_staff and not payload.is_staff:
        # нельзя снять последнего staff — портал останется без HR
        n_staff = (await db.execute(select(func.count()).select_from(User).where(User.is_staff))).scalar() or 0
        if n_staff <= 1:
            raise HTTPException(status_code=400, detail="Нельзя снять последнего staff")
    target.is_staff = payload.is_staff
    db.add(target)
    await db.commit()
    await db.refresh(target)
    return _admin_user_out(target, None, await _lead_email(db, target))


@router.patch("/admin/users/{user_id}/lead", response_model=AdminUserOut)
@limiter.limit("20/minute")
async def set_lead(
    user_id: int,
    payload: LeadSetIn,
    request: Request,
    db: AsyncSession = Depends(get_db),
    staff: User = Depends(require_staff),
):
    """Назначить per-employee Лида (для уведомлений о пропуске). Пусто = глобальный."""
    target = await db.get(User, user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="Сотрудник не найден")
    email = payload.lead_email.strip().lower()
    if not email:
        target.lead_id = None
    else:
        lead = (await db.execute(select(User).where(User.email == email))).scalars().first()
        if lead is None:
            raise HTTPException(status_code=404, detail="Лид с таким email не найден")
        if lead.id == target.id:
            raise HTTPException(status_code=400, detail="Нельзя назначить самого себя лидом")
        target.lead_id = lead.id
    db.add(target)
    await db.commit()
    await db.refresh(target)
    prog = await db.get(Progress, target.id)
    done1: list[str] = []
    if prog is not None:
        done1 = normalize_tasks(prog.done_tasks).get("1", [])
    return _admin_user_out(target, done1, email if email else "")


@router.get("/admin/mpulse-code", response_model=list[MpulseCodeOut])
@limiter.limit("30/minute")
async def mpulse_codes(
    request: Request,
    db: AsyncSession = Depends(get_db),
    staff: User = Depends(require_staff),
):
    """Активные коды MPulse (только staff — код не светить сотрудникам)."""
    rows = (
        await db.execute(select(MpulseCode).order_by(desc(MpulseCode.created_at)).limit(20))
    ).scalars().all()
    return [_mpulse_out(r) for r in rows]


@router.post("/admin/mpulse-code", response_model=MpulseCodeOut)
@limiter.limit("10/minute")
async def rotate_mpulse_code(
    payload: MpulseRotateIn,
    request: Request,
    db: AsyncSession = Depends(get_db),
    staff: User = Depends(require_staff),
):
    """Ротация кода MPulse на батч: старые деактивируются, новый активен."""
    old = (await db.execute(select(MpulseCode).where(MpulseCode.is_active))).scalars().all()
    for r in old:
        r.is_active = False
        db.add(r)
    new = MpulseCode(code=payload.code.strip(), batch_name=payload.batch_name.strip(), is_active=True)
    db.add(new)
    await db.commit()
    await db.refresh(new)
    return _mpulse_out(new)


@router.get("/admin/audit", response_model=list[AuditOut])
@limiter.limit("30/minute")
async def audit_log(
    request: Request,
    user_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    staff: User = Depends(require_staff),
):
    """Журнал верификаций (кто/что/когда/кем)."""
    stmt = select(VerificationLog).order_by(desc(VerificationLog.created_at)).limit(100)
    if user_id is not None:
        stmt = select(VerificationLog).where(VerificationLog.user_id == user_id).order_by(
            desc(VerificationLog.created_at)
        ).limit(100)
    rows = (await db.execute(stmt)).scalars().all()
    return [
        AuditOut(
            id=r.id,
            user_id=r.user_id,
            task_id=r.task_id,
            verified_by=r.verified_by,
            method=r.method,
            details=r.details or "{}",
            created_at=r.created_at.isoformat() if r.created_at else None,
        )
        for r in rows
    ]


@router.get("/admin/settings", response_model=SettingsOut)
@limiter.limit("30/minute")
async def get_settings(
    request: Request,
    db: AsyncSession = Depends(get_db),
    staff: User = Depends(require_staff),
):
    """Настройки из app_settings (контакты ответственных, группы TG, инструкции)."""
    from app.config import settings as _s

    rows = (await db.execute(select(AppSetting))).scalars().all()
    stored = {r.key: r.value for r in rows}
    contacts = {k: stored.get(k, "") for k in CONTACT_KEYS}
    instructions = {k: stored.get(k, "") for k in INSTRUCTION_KEYS}
    return SettingsOut(
        contacts=contacts,
        links={
            "telegram_invite_link": _s.telegram_invite_link,
            "figma_team_url": _s.figma_team_url,
            "confluence_url": _s.confluence_url,
            "mpulse_android_url": _s.mpulse_android_url,
            "mpulse_ios_url": _s.mpulse_ios_url,
            "telegram_groups_json": stored.get("telegram.groups_json", "[]"),
        },
        instructions=instructions,
    )


@router.patch("/admin/settings", response_model=SettingsOut)
@limiter.limit("20/minute")
async def update_setting(
    payload: SettingIn,
    request: Request,
    db: AsyncSession = Depends(get_db),
    staff: User = Depends(require_staff),
):
    """Изменить настройку (контакты, telegram.groups_json). Валидация по ключу."""
    import json

    key = payload.key.strip()
    value = payload.value.strip()
    allowed = set(CONTACT_KEYS) | {"telegram.groups_json"} | set(INSTRUCTION_KEYS)
    if key not in allowed:
        raise HTTPException(status_code=400, detail=f"Неизвестный ключ (разрешены: {sorted(allowed)})")
    if key == "telegram.groups_json":
        try:
            groups = json.loads(value or "[]")
        except Exception:
            raise HTTPException(status_code=400, detail="groups_json — невалидный JSON")
        if not isinstance(groups, list):
            raise HTTPException(status_code=400, detail="groups_json — должен быть список")
        for g in groups:
            if not isinstance(g, dict) or not g.get("title") or not g.get("chat_id"):
                raise HTTPException(
                    status_code=400,
                    detail="Каждая группа: {title, chat_id, roles?}, например "
                    "{\"title\": \"Frontend Team\", \"chat_id\": \"-1001\", \"roles\": [\"frontend\"]}",
                )
            roles = g.get("roles") or []
            if not isinstance(roles, list) or any(r not in ("frontend", "backend", "design") for r in roles):
                raise HTTPException(
                    status_code=400,
                    detail="roles — список из frontend/backend/design (пустой = для всех)",
                )
            g["roles"] = [str(r) for r in roles]
        # merge по chat_id: присланные обновляются/добавляются, остальные НЕ трогаем
        # (иначе сохранение из устаревшей формы затирает группы).
        # mode=replace — полная замена (для удаления групп, осознанно).
        if payload.mode not in ("merge", "replace"):
            raise HTTPException(status_code=400, detail="mode: merge или replace")
        if payload.mode == "replace":
            value = json.dumps(groups, ensure_ascii=False)
            row0 = None
        else:
            row0 = await db.get(AppSetting, key)
        try:
            existing = json.loads(row0.value) if row0 and row0.value.strip() else []
        except Exception:
            existing = []
        if not isinstance(existing, list):
            existing = []
        by_id: dict[str, dict] = {}
        for g in existing:
            if isinstance(g, dict) and g.get("chat_id"):
                by_id[str(g["chat_id"])] = g
        for g in groups:
            by_id[str(g["chat_id"])] = g
        value = json.dumps(list(by_id.values()), ensure_ascii=False)
    if key.endswith("_email") and value:
        for email in value.split(","):
            email = email.strip()
            if email and not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
                raise HTTPException(status_code=400, detail=f"Неверный email: {email}")
    row = await db.get(AppSetting, key)
    if row is None:
        row = AppSetting(key=key, value=value)
    else:
        row.value = value
    db.add(row)
    await db.commit()
    return await get_settings(request, db, staff)
