"""Ссылки/инструкции внешних систем (TZ: онбординг даёт ссылки, LDAP — их own настройки)."""
from fastapi import APIRouter, Depends, HTTPException, Request
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

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(BOT_API.format(token=token, method=method), json=payload)
        try:
            data = resp.json()
        except Exception:
            data = {}
        if not data.get("ok"):
            raise RuntimeError(str(data.get("description") or f"HTTP {resp.status_code}"))
        return data.get("result") or {}


async def _tg_groups(db) -> list[dict]:
    """Список групп из app_settings[telegram.groups_json]."""
    import json

    row = await db.get(AppSetting, "telegram.groups_json")
    if row is None or not row.value.strip():
        return []
    try:
        groups = json.loads(row.value)
    except Exception:
        return []
    return [g for g in groups if isinstance(g, dict) and g.get("chat_id")]


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
    """Список групп для вступления (настраивается в /admin, без редеплоя)."""
    return {"groups": await _tg_groups(db)}


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
    groups = await _tg_groups(db)
    if not groups:
        raise HTTPException(
            status_code=501,
            detail="Группы не настроены: HR должен заполнить telegram.groups_json в /admin.",
        )
    token = settings.telegram_bot_token
    # username -> числовой user_id (нужен для addChatMember)
    try:
        resolved = await _tg_call(token, "getChat", {"chat_id": user.telegram_username})
        tg_id = resolved.get("id")
    except RuntimeError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Не найден Telegram-пользователь {user.telegram_username}: {e}. "
            "Проверьте @username (пользователь должен существовать).",
        )
    if not tg_id:
        raise HTTPException(status_code=400, detail="Не удалось разрешить @username в user_id.")
    added: list[str] = []
    failed: list[dict] = []
    for g in groups:
        chat_id = str(g["chat_id"])
        title = str(g.get("title") or chat_id)
        try:
            await _tg_call(token, "addChatMember", {"chat_id": chat_id, "user_id": tg_id})
            added.append(title)
        except RuntimeError as e:
            reason = str(e)
            if "bot was blocked" in reason.lower() or "user not found" in reason.lower():
                hint = "Пользователь не найден — проверьте @username."
            elif "not enough rights" in reason.lower() or "admin" in reason.lower():
                hint = "Дайте боту админку в группе (can_invite_users)."
            else:
                hint = reason
            failed.append({"title": title, "reason": hint})
    return AutoAddOut(added=added, failed=failed, username=user.telegram_username)


@router.get("/integrations/telegram-check-rights")
@limiter.limit("10/minute")
async def telegram_check_rights(
    request: Request,
    db: AsyncSession = Depends(get_db),
    staff: User = Depends(require_staff),
):
    """Проверка для HR: бот есть? админ ли в каждой группе? (кнопка «Проверить права»)."""
    if not settings.telegram_bot_token:
        raise HTTPException(status_code=501, detail="TELEGRAM_BOT_TOKEN не задан.")
    token = settings.telegram_bot_token
    try:
        me = await _tg_call(token, "getMe", {})
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=f"Бот недоступен: {e}")
    groups = await _tg_groups(db)
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
                            "detail": f"статус бота: {status}, invite: {can_invite}"})
        except RuntimeError as e:
            checked.append({"title": title, "chat_id": chat_id, "ok": False, "detail": str(e)})
    return {"bot": me.get("username"), "groups": checked}
