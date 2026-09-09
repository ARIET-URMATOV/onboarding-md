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
