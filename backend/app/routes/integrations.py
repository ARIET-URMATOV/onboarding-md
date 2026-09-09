"""Ссылки/инструкции внешних систем (TZ: онбординг даёт ссылки, LDAP — их own настройки)."""
from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.limiter import limiter
from app.models import User
from app.routes.auth import get_current_user
from app.schemas import LinksOut

router = APIRouter()


@router.get("/integrations/links", response_model=LinksOut)
@limiter.limit("30/minute")
async def integration_links(
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return LinksOut(
        telegram_invite_link=settings.telegram_invite_link,
        figma_team_url=settings.figma_team_url,
        confluence_url=settings.confluence_url,
        mpulse_android_url=settings.mpulse_android_url,
        mpulse_ios_url=settings.mpulse_ios_url,
    )


@router.post("/integrations/figma-invite")
@limiter.limit("10/minute")
async def figma_invite(
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Приглашение в Figma по email (нужен FIGMA_API_TOKEN от дизайна; иначе 501 + ссылка)."""
    from fastapi import HTTPException

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
    """Инвайт в Telegram-группы (нужен TELEGRAM_BOT_TOKEN от DevOps; иначе 501 + ссылка)."""
    from fastapi import HTTPException

    if not settings.telegram_bot_token or not settings.telegram_invite_link:
        raise HTTPException(
            status_code=501,
            detail="Telegram-бот не настроен. Используйте ссылку-приглашение.",
        )
    return {"ok": True, "invite_link": settings.telegram_invite_link}
