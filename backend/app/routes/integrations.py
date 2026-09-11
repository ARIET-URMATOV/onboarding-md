"""Ссылки/инструкции внешних систем (TZ: онбординг даёт ссылки, LDAP — их own настройки)."""
import re

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.limiter import limiter
from app.models import AppSetting, User
from app.routes.auth import get_current_user, require_staff
from app.schemas import AutoAddOut, LinksOut

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
    """Одноразовые invite-ссылки per group (фолбэк ручного вступления)."""
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
    """Список групп для вступления (только своей роли; настраивается в /admin)."""
    return {"groups": await _tg_groups(db, user.role)}


@router.post("/integrations/telegram-auto-add", response_model=AutoAddOut)
@limiter.limit("5/minute")
async def telegram_auto_add(
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Бот автоматически добавляет сотрудника во все группы.

    Требует: TELEGRAM_BOT_TOKEN + username сотрудника + группы в настройках
    + бота админом в каждой группе (can_invite_users).
    """
    if not settings.telegram_bot_token:
        raise HTTPException(
            status_code=501,
            detail="Telegram-бот не настроен: создайте бота через @BotFather, "
            "выдайте ему админку в группах и задайте TELEGRAM_BOT_TOKEN.",
        )
    if not user.telegram_username:
        raise HTTPException(
            status_code=400,
            detail="Сначала укажите ваш Telegram @username в задаче.",
        )
    groups = await _tg_groups(db, user.role)
    if not groups:
        raise HTTPException(
            status_code=501,
            detail="Группы для вашей роли не настроены: обратитесь к HR (/admin → Коды и ссылки).",
        )
    token = settings.telegram_bot_token
    # 1) числовой ID — напрямую; 2) getChat(@username); 3) getUpdates (писал боту?)
    handle = user.telegram_username.strip()
    tg_id: object = None
    if re.fullmatch(r"@?\d{5,20}", handle):
        tg_id = int(handle.lstrip("@"))
    else:
        try:
            resolved = await _tg_call(token, "getChat", {"chat_id": handle})
            tg_id = resolved.get("id")
        except RuntimeError:
            tg_id = await _resolve_via_updates(token, handle)
    invite_links: list[dict] = []
    if not tg_id:
        # фолбэк: invite-ссылки, чтобы сотрудник вступил вручную (200, не 400)
        invite_links = await _make_invite_links(token, groups)
        failed = [{
            "title": str(g.get("title") or g["chat_id"]),
            "reason": f"Не найден {handle}: напишите боту /start и повторите, или вступите по ссылке ниже.",
        } for g in groups]
        return AutoAddOut(added=[], failed=failed, username=user.telegram_username,
                          invite_links=invite_links)
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
        failed_ids = {f["title"] for f in failed}
        invite_links = await _make_invite_links(
            token, [g for g in groups if str(g.get("title") or g["chat_id"]) in failed_ids])
    return AutoAddOut(added=added, failed=failed, username=user.telegram_username,
                      invite_links=invite_links)


@router.post("/integrations/telegram-webhook")
@limiter.limit("60/minute")
async def telegram_webhook(request: Request):
    """Приём апдейтов бота (если повешен webhook). Без секрета — 501 (работает getUpdates)."""
    import json

    from fastapi import HTTPException
    from fastapi.responses import JSONResponse

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
    msg = update.get("message") or {}
    frm = msg.get("from") or {}
    chat = msg.get("chat") or {}
    if frm.get("id") and chat.get("type") == "private" and str(msg.get("text") or "").startswith("/start"):
        try:
            await _tg_call(settings.telegram_bot_token, "sendMessage", {
                "chat_id": frm["id"],
                "text": "Привет! Я бот онбординга MDigital. Теперь вернитесь в портал и нажмите «Добавить меня во все группы».",
            })
        except RuntimeError:
            pass
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
