"""Ссылки/инструкции внешних систем (TZ: онбординг даёт ссылки, LDAP — их own настройки)."""
import re

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.limiter import limiter
from app.models import AppSetting, User
from app.routes.auth import get_current_user, require_staff
from app.schemas import AutoAddIn, AutoAddOut, LinksOut

router = APIRouter()

BOT_API = "https://api.telegram.org/bot{token}/{method}"


async def _tg_call(token: str, method: str, payload: dict) -> dict:
    import httpx

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(BOT_API.format(token=token, method=method), json=payload)
    except Exception as e:
        raise RuntimeError(f"сеть недоступна: {e}")
    try:
        data = resp.json()
    except Exception:
        data = {}
    if not data.get("ok"):
        raise RuntimeError(str(data.get("description") or f"HTTP {resp.status_code}"))
    return data.get("result") or {}


VALID_ROLES = ("frontend", "backend", "design")


async def _tg_groups(db, user_role: str | None = None) -> list[dict]:
    """Список групп из app_settings[telegram.groups_json], фильтр по роли.

    Группа видна роли, если roles пуст (для всех) или содержит роль.
    Старые записи без roles = для всех (обратная совместимость).
    """
    import json

    row = await db.get(AppSetting, "telegram.groups_json")
    if row is None or not row.value.strip():
        return []
    try:
        groups = json.loads(row.value)
    except Exception:
        return []
    out = []
    for g in groups:
        if not isinstance(g, dict) or not g.get("chat_id"):
            continue
        roles = g.get("roles") or []
        if user_role and roles and user_role not in roles:
            continue
        out.append({"title": str(g.get("title") or g["chat_id"]),
                    "chat_id": str(g["chat_id"]),
                    "roles": [r for r in roles if r in VALID_ROLES]})
    return out


async def _resolve_via_updates(token: str, handle: str) -> object:
    """user_id из входящих сообщений боту (getUpdates): матчим from.username.

    Обход лимита getChat(@username)=not found для пользователей,
    которых бот ещё не видел. Возвращает id или None.
    """
    want = handle.lstrip("@").lower()
    try:
        data = await _tg_call(token, "getUpdates", {"limit": 100, "timeout": 0})
    except RuntimeError:
        return None
    updates = data if isinstance(data, list) else []
    for u in updates:
        if not isinstance(u, dict):
            continue
        msg = u.get("message") or u.get("edited_message") or {}
        frm = msg.get("from") or {}
        uname = str(frm.get("username") or "").lower()
        if uname and uname == want and frm.get("id"):
            return frm["id"]
    return None


async def _bot_username(token: str) -> str:
    try:
        me = await _tg_call(token, "getMe", {})
        return str(me.get("username") or "")
    except RuntimeError:
        return ""


async def _make_invite_links(token: str, groups: list[dict]) -> list[dict]:
    """Одноразовые invite-ссылки per group (фолбэк, если force-add не вышел)."""
    out = []
    for g in groups:
        chat_id = str(g["chat_id"])
        title = str(g.get("title") or chat_id)
        try:
            link = await _tg_call(token, "createChatInviteLink", {"chat_id": chat_id})
            url = str(link.get("invite_link") or "")
            if url:
                out.append({"title": title, "url": url})
        except RuntimeError:
            continue
    return out


async def _resolve_tg_id(db, token: str, handle: str) -> object:
    """Вариант A: user_id по @username.

    1) telegram_contacts (бот видел пользователя после /start);
    2) getChat(@username) — работает, если пользователь контактировал с ботом;
    3) getUpdates (писал боту?).
    """
    from sqlalchemy import select as _select

    from app.models import TelegramContact

    want = handle.lstrip("@").lower()
    if re.fullmatch(r"\d{5,20}", want):
        print(f"tg-resolve: {handle} -> {want} via numeric-id")
        return int(want)
    row = (await db.execute(
        _select(TelegramContact).where(TelegramContact.username == want)
    )).scalars().first()
    if row is not None:
        print(f"tg-resolve: {handle} -> {row.tg_user_id} via contacts")
        return row.tg_user_id
    try:
        resolved = await _tg_call(token, "getChat", {"chat_id": "@" + want})
        if resolved.get("id"):
            print(f"tg-resolve: {handle} -> {resolved.get('id')} via getChat")
            return resolved.get("id")
    except RuntimeError as e:
        print(f"tg-resolve: getChat({handle}) failed: {e}")
    got = await _resolve_via_updates(token, handle)
    print(f"tg-resolve: {handle} -> {got} via getUpdates")
    return got


async def _auto_verify_telegram(db, user_id: int) -> bool:
    """Авто-зачёт 1-telegram (бот реально добавил во все группы).

    method=telegram_add, verified_by=None (система). Идемпотентно.
    Возвращает True если задача теперь done.
    """
    from sqlalchemy import select as _select

    from app.models import PendingRequest, User
    from app.routes.progress import load_progress, log_verification, save_progress

    target = await db.get(User, user_id)
    if target is None:
        return False
    prog = await load_progress(db, target)
    from app.stages_data import normalize_tasks

    tasks = normalize_tasks(prog.done_tasks)
    if "1-telegram" not in tasks["1"]:
        tasks["1"] = [*tasks["1"], "1-telegram"]
    await log_verification(db, target.id, "1-telegram", "telegram_add", None,
                           {"via": "bot_auto_add"})
    out = await save_progress(db, prog, tasks)
    req = await db.execute(
        _select(PendingRequest).where(
            PendingRequest.user_id == target.id,
            PendingRequest.task_id == "1-telegram",
            PendingRequest.status == "pending",
        )
    )
    row = req.scalar_one_or_none()
    if row is not None:
        row.status = "verified"
        db.add(row)
        await db.commit()
    from app.notify import notify_verified

    await notify_verified(target.email, "1-telegram", out.xp)
    return True


@router.get("/integrations/links", response_model=LinksOut)
@limiter.limit("30/minute")
async def integration_links(
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    instruction = ""
    try:
        row = await db.get(AppSetting, "instruction.accountant")
        if row is not None:
            instruction = row.value
    except Exception:
        instruction = ""
    return LinksOut(
        telegram_invite_link=settings.telegram_invite_link,
        figma_team_url=settings.figma_team_url,
        confluence_url=settings.confluence_url,
        mpulse_android_url=settings.mpulse_android_url,
        mpulse_ios_url=settings.mpulse_ios_url,
        jira_url=settings.jira_url,
        gitlab_url=settings.gitlab_url,
        instruction_accountant=instruction,
    )


@router.post("/integrations/figma-invite")
@limiter.limit("10/minute")
async def figma_invite(
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Приглашение в Figma по email (нужен FIGMA_API_TOKEN от дизайна; иначе 501 + ссылка)."""
    if not settings.figma_api_token:
        raise HTTPException(
            status_code=501,
            detail="Figma-инвайты не настроены (FIGMA_API_TOKEN). Используйте ссылку команды.",
        )
    import httpx

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                "https://api.figma.com/v1/invites",
                headers={"X-Figma-Token": settings.figma_api_token},
                json={"email": user.email},
            )
            if resp.status_code not in (200, 201):
                raise HTTPException(status_code=502, detail=f"Figma API: {resp.status_code}")
            return {"ok": True, "email": user.email}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Figma API недоступен: {e}")


@router.post("/integrations/telegram-invite")
@limiter.limit("10/minute")
async def telegram_invite(
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Инвайт-ссылка (фолбэк, если auto-add невозможен)."""
    if not settings.telegram_invite_link:
        raise HTTPException(
            status_code=501,
            detail="Ссылка-приглашение не настроена (TELEGRAM_INVITE_LINK).",
        )
    return {"ok": True, "invite_link": settings.telegram_invite_link}


@router.get("/integrations/telegram-groups")
@limiter.limit("30/minute")
async def telegram_groups(
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Список групп: демо видит все, сотрудники — только своей роли."""
    if user.email.lower() == settings.demo_email.lower():
        return {"groups": await _tg_groups(db, None)}
    return {"groups": await _tg_groups(db, user.role)}


@router.post("/integrations/telegram-auto-add", response_model=AutoAddOut)
@limiter.limit("5/minute")
async def telegram_auto_add(
    request: Request,
    body: AutoAddIn | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Start-based linking: бот добавляет сотрудника во все группы его роли.

    Сотрудник: 1) пишет боту /start (deep-link uid_<id>), 2) жмёт кнопку.
    Резолв: telegram_contacts.user_id == current_user.id.
    Полный успех → авто-зачёт 1-telegram (verified=true).
    Требует: TELEGRAM_BOT_TOKEN + группы в настройках
    + бота админом в каждой группе (can_invite_users).
    """
    from sqlalchemy import select as _select

    from app.models import TelegramContact

    if not settings.telegram_bot_token:
        raise HTTPException(
            status_code=501,
            detail="Telegram-бот не настроен: создайте бота через @BotFather, "
            "выдайте ему админку в группах и задайте TELEGRAM_BOT_TOKEN.",
        )
    # Resolve by user_id (Start-based linking)
    contact = (await db.execute(
        _select(TelegramContact).where(TelegramContact.user_id == user.id)
    )).scalars().first()
    if contact is None:
        raise HTTPException(
            status_code=400,
            detail="Сначала откройте бота в Telegram и нажмите Start.",
        )
    tg_id = contact.tg_user_id
    is_demo = user.email.lower() == settings.demo_email.lower()
    groups = await _tg_groups(db, None if is_demo else user.role)
    if not groups:
        raise HTTPException(
            status_code=501,
            detail="Группы для вашей роли не настроены: обратитесь к HR (/admin → Коды и ссылки).",
        )
    token = settings.telegram_bot_token
    async def _member_status(chat_id: str) -> str:
        """Реальный статус пользователя в чате (не верим unban на слово)."""
        try:
            m = await _tg_call(token, "getChatMember", {"chat_id": chat_id, "user_id": tg_id})
            return str(m.get("status") or "")
        except RuntimeError:
            return "unknown"

    added: list[str] = []
    failed: list[dict] = []
    for g in groups:
        chat_id = str(g["chat_id"])
        title = str(g.get("title") or chat_id)
        try:
            # unbanChatMember — рабочий способ добавить в супергруппу;
            # addChatMember — фолбэк для обычных групп (в супергруппах даёт 404).
            try:
                await _tg_call(token, "unbanChatMember", {"chat_id": chat_id, "user_id": tg_id})
            except RuntimeError as e:
                if "chat owner" in str(e).lower() or "already" in str(e).lower():
                    pass  # владелец / уже участник — считаем добавленным
                else:
                    await _tg_call(token, "addChatMember", {"chat_id": chat_id, "user_id": tg_id})
            # проверка: unban снимает бан, но НЕ возвращает левнувшего в чат
            status = await _member_status(chat_id)
            if status in ("left", "kicked", "unknown"):
                raise RuntimeError(
                    "JOIN_REQUIRED: пользователь вне чата — вступите по ссылке-приглашению ниже."
                )
            added.append(title)
        except RuntimeError as e:
            reason = str(e)
            if reason.startswith("JOIN_REQUIRED"):
                hint = "Вы вышли из группы — бот не может вернуть force-join. Вступите по ссылке ниже."
            elif "bot was blocked" in reason.lower() or "user not found" in reason.lower():
                hint = "Пользователь не найден — напишите боту /start и повторите."
            elif "not enough rights" in reason.lower() or "admin" in reason.lower():
                hint = "Дайте боту админку в группе (can_invite_users)."
            else:
                hint = reason
            failed.append({"title": title, "reason": hint})
    if failed:
        # частичный фолбэк: ссылки для групп, куда не добавилось
        failed_titles = {f["title"] for f in failed}
        invite_links = await _make_invite_links(
            token, [g for g in groups if str(g.get("title") or g["chat_id"]) in failed_titles])
    else:
        invite_links = []
    # автоотправка приветствия от бота в добавленные группы
    greeted: list[str] = []
    greeting_text = (body.greeting or "").strip()[:500] if body and body.greeting else ""
    if greeting_text and added:
        greet_msg = f"\U0001f44b \u041d\u043e\u0432\u044b\u0439 \u0441\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a {user.name or ''}:\n{greeting_text}"
        added_ids = {str(g["chat_id"]) for g in groups if str(g.get("title") or g["chat_id"]) in set(added)}
        for g in groups:
            chat_id = str(g["chat_id"])
            if chat_id not in added_ids:
                continue
            try:
                await _tg_call(token, "sendMessage", {"chat_id": chat_id, "text": greet_msg})
                greeted.append(str(g.get("title") or chat_id))
            except RuntimeError:
                pass  # best-effort — greeting failure must not break verification
    verified = False
    if not failed:
        # бот реально добавил во все группы → задача выполнена
        verified = await _auto_verify_telegram(db, user.id)
    return AutoAddOut(added=added, failed=failed, username=contact.username,
                      invite_links=invite_links, verified=verified, greeted=greeted)


@router.post("/integrations/telegram-webhook")
@limiter.limit("60/minute")
async def telegram_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Приём апдейтов бота (нужен webhook + TELEGRAM_WEBHOOK_SECRET).

    Вариант A «Сначала Start»:
    - message (личка, любое сообщение): upsert telegram_contacts
      {tg_user_id, username, first_name} — после этого getChat(@username) резолвит.
    - my_chat_member: бота добавили/убрали → автоподхват chat_id в groups_json
      (HR потом проставляет roles в /admin; без ролей группа видна всем).
    """
    import json

    from fastapi import HTTPException
    from fastapi.responses import JSONResponse
    from sqlalchemy import select as _select

    from app.models import TelegramContact

    secret = (request.headers.get("X-Telegram-Bot-Api-Secret-Token") or "").strip()
    expected = settings.telegram_webhook_secret.strip() if hasattr(settings, "telegram_webhook_secret") else ""
    if not expected:
        raise HTTPException(status_code=501, detail="Webhook не настроен (TELEGRAM_WEBHOOK_SECRET).")
    if not secret or secret != expected:
        raise HTTPException(status_code=403, detail="Bad webhook secret.")
    try:
        update = json.loads((await request.body()).decode() or "{}")
    except Exception:
        update = {}

    # 1) любое сообщение боту в личке → запоминаем контакт (шаг 2 варианта A)
    msg = update.get("message") or update.get("edited_message") or {}
    frm = msg.get("from") or {}
    chat = msg.get("chat") or {}
    if frm.get("id") and chat.get("type") == "private":
        tg_id = int(frm["id"])
        uname = str(frm.get("username") or "").lower()
        fname = str(frm.get("first_name") or "")[:80]
        row = (await db.execute(
            _select(TelegramContact).where(TelegramContact.tg_user_id == tg_id)
        )).scalars().first()
        if row is None:
            row = TelegramContact(tg_user_id=tg_id, username=uname, first_name=fname)
        else:
            row.username = uname
            row.first_name = fname
        db.add(row)
        try:
            await db.commit()
        except Exception:
            await db.rollback()
        text = str(msg.get("text") or "")
        if text.startswith("/start"):
            # Parse deep-link payload: uid_<userId> or plain /start
            payload = text.split(maxsplit=1)[1].strip() if " " in text else ""
            linked_user_id = None
            if payload.startswith("uid_"):
                try:
                    linked_user_id = int(payload[4:])
                except ValueError:
                    linked_user_id = None
            if linked_user_id is not None:
                # Link this Telegram account to the portal user
                from app.models import User as _User
                target_user = await db.get(_User, linked_user_id)
                if target_user is not None:
                    row.user_id = linked_user_id
                    db.add(row)
                    try:
                        await db.commit()
                    except Exception:
                        await db.rollback()
                    try:
                        await _tg_call(settings.telegram_bot_token, "sendMessage", {
                            "chat_id": tg_id,
                            "text": f"Привет, {target_user.name or ''}! Вы привязаны к порталу MDigital. "
                            "Вернитесь в портал и нажмите «Добавить меня в группы».",
                        })
                    except RuntimeError:
                        pass
                    return JSONResponse({"ok": True, "contact_saved": tg_id, "linked_user": linked_user_id})
            # Plain /start (no uid payload)
            try:
                await _tg_call(settings.telegram_bot_token, "sendMessage", {
                    "chat_id": tg_id,
                    "text": "Привет! Я бот онбординга MDigital. "
                    "Вернитесь в портал и нажмите «Добавить меня в группы».",
                })
            except RuntimeError:
                pass
            return JSONResponse({"ok": True, "contact_saved": tg_id})
        return JSONResponse({"ok": True, "contact_seen": tg_id})

    # 2) бота добавили в группу → автоподхват chat_id
    mcm = update.get("my_chat_member") or {}
    if mcm:
        mchat = mcm.get("chat") or {}
        chat_id = str(mchat.get("id") or "")
        ctype = str(mchat.get("type") or "")
        new_status = str((mcm.get("new_chat_member") or {}).get("status") or "")
        if chat_id and ctype in ("group", "supergroup", "channel") and new_status in (
            "administrator", "member",
        ):
            title = str(mchat.get("title") or chat_id)
            row = await db.get(AppSetting, "telegram.groups_json")
            try:
                existing = json.loads(row.value) if row and row.value.strip() else []
            except Exception:
                existing = []
            if not isinstance(existing, list):
                existing = []
            by_id: dict[str, dict] = {}
            for g in existing:
                if isinstance(g, dict) and g.get("chat_id"):
                    by_id[str(g["chat_id"])] = g
            if chat_id not in by_id:
                by_id[chat_id] = {"title": title, "chat_id": chat_id, "roles": []}
                val = json.dumps(list(by_id.values()), ensure_ascii=False)
                if row is None:
                    db.add(AppSetting(key="telegram.groups_json", value=val))
                else:
                    row.value = val
                await db.commit()
                return JSONResponse({"ok": True, "auto_discovered": chat_id})
            return JSONResponse({"ok": True, "already_known": chat_id})
    return JSONResponse({"ok": True})


@router.get("/integrations/telegram-check-rights")
@limiter.limit("10/minute")
async def telegram_check_rights(
    request: Request,
    db: AsyncSession = Depends(get_db),
    staff: User = Depends(require_staff),
    role: str | None = Query(default=None, pattern="^(frontend|backend|design)$"),
):
    """Проверка для HR: бот есть? админ ли в каждой группе? (?role=frontend — фильтр)."""
    if not settings.telegram_bot_token:
        raise HTTPException(status_code=501, detail="TELEGRAM_BOT_TOKEN не задан.")
    token = settings.telegram_bot_token
    try:
        me = await _tg_call(token, "getMe", {})
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=f"Бот недоступен: {e}")
    groups = await _tg_groups(db, role)
    checked = []
    for g in groups:
        chat_id = str(g["chat_id"])
        title = str(g.get("title") or chat_id)
        try:
            member = await _tg_call(token, "getChatMember", {"chat_id": chat_id, "user_id": me.get("id")})
            status = str(member.get("status"))
            can_invite = bool(member.get("can_invite_users"))
            ok = status in ("administrator", "creator") and (status == "creator" or can_invite)
            checked.append({"title": title, "chat_id": chat_id, "ok": ok,
                            "roles": g.get("roles") or [],
                            "detail": f"статус бота: {status}, invite: {can_invite}"})
        except RuntimeError as e:
            checked.append({"title": title, "chat_id": chat_id, "ok": False,
                            "roles": g.get("roles") or [], "detail": str(e)})
    return {"bot": me.get("username"), "groups": checked}
