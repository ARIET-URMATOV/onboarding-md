"""CRUD для external_services: публичный GET + админский создание/редактирование/удаление."""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select as _select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.limiter import limiter
from app.models import ExternalService, User
from app.routes.auth import get_current_user, require_staff
from app.schemas import (
    LUCIDE_ICONS,
    VALID_CATEGORIES,
    VALID_ROLES_LIST,
    VALID_SERVICE_TASK_IDS,
    OkOut,
    ServiceIn,
    ServiceOut,
    ServicePatchIn,
)

router = APIRouter()

TG_VALID_ROLES = set(VALID_ROLES_LIST)


def _validate_service_in(payload: ServiceIn) -> None:
    if payload.icon_key not in LUCIDE_ICONS:
        raise HTTPException(status_code=400, detail=f"icon_key: допустимы {LUCIDE_ICONS}")
    if payload.category not in VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"category: допустимы {VALID_CATEGORIES}")
    if payload.task_id is not None and payload.task_id not in VALID_SERVICE_TASK_IDS:
        raise HTTPException(
            status_code=400,
            detail=f"task_id: допустимы {VALID_SERVICE_TASK_IDS} или null (info-only)",
        )
    for r in payload.roles:
        if r not in TG_VALID_ROLES:
            raise HTTPException(status_code=400, detail=f"roles: допустимы {sorted(TG_VALID_ROLES)}")


def _validate_service_patch(payload: ServicePatchIn) -> None:
    if payload.icon_key is not None and payload.icon_key not in LUCIDE_ICONS:
        raise HTTPException(status_code=400, detail=f"icon_key: допустимы {LUCIDE_ICONS}")
    if payload.category is not None and payload.category not in VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"category: допустимы {VALID_CATEGORIES}")
    if payload.task_id is not None and payload.task_id not in VALID_SERVICE_TASK_IDS:
        raise HTTPException(
            status_code=400,
            detail=f"task_id: допустимы {VALID_SERVICE_TASK_IDS} или null",
        )
    if payload.roles is not None:
        for r in payload.roles:
            if r not in TG_VALID_ROLES:
                raise HTTPException(status_code=400, detail=f"roles: допустимы {sorted(TG_VALID_ROLES)}")


async def get_visible_services(db: AsyncSession, user_role: str | None = None) -> list[dict]:
    """Видимые сервисы с фильтром по роли (demo → все)."""
    rows = (await db.execute(
        _select(ExternalService).order_by(ExternalService.sort_order, ExternalService.key)
    )).scalars().all()
    out = []
    for s in rows:
        if not s.is_visible:
            continue
        roles = s.roles or []
        if user_role and roles and user_role not in roles:
            continue
        out.append({
            "key": s.key, "title": s.title, "subtitle": s.subtitle,
            "url": s.url, "icon_key": s.icon_key, "category": s.category,
            "task_id": s.task_id, "roles": [r for r in roles if r in TG_VALID_ROLES],
            "sort_order": s.sort_order, "is_visible": s.is_visible,
            "open_new_tab": s.open_new_tab, "extra": s.extra or {},
        })
    return out


@router.get("/integrations/services")
@limiter.limit("30/minute")
async def list_services(
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Публичный список сервисов: видимые + фильтр по роли."""
    is_demo = user.email.lower() == "demo@mdigital.kg"
    return {"services": await get_visible_services(db, None if is_demo else user.role)}


@router.get("/admin/services")
@limiter.limit("30/minute")
async def admin_list_services(
    request: Request,
    db: AsyncSession = Depends(get_db),
    staff: User = Depends(require_staff),
):
    """Админ: все сервисы включая скрытые."""
    rows = (await db.execute(
        _select(ExternalService).order_by(ExternalService.sort_order, ExternalService.key)
    )).scalars().all()
    return [{"key": s.key, "title": s.title, "subtitle": s.subtitle,
             "url": s.url, "icon_key": s.icon_key, "category": s.category,
             "task_id": s.task_id, "roles": s.roles or [],
             "sort_order": s.sort_order, "is_visible": s.is_visible,
             "open_new_tab": s.open_new_tab, "extra": s.extra or {},
             "created_at": s.created_at.isoformat() if s.created_at else None,
             "updated_at": s.updated_at.isoformat() if s.updated_at else None}
            for s in rows]


@router.post("/admin/services", response_model=ServiceOut)
@limiter.limit("10/minute")
async def create_service(
    payload: ServiceIn,
    request: Request,
    db: AsyncSession = Depends(get_db),
    staff: User = Depends(require_staff),
):
    _validate_service_in(payload)
    existing = await db.get(ExternalService, payload.key)
    if existing is not None:
        raise HTTPException(status_code=409, detail=f"Сервис с ключом «{payload.key}» уже существует")
    svc = ExternalService(
        key=payload.key, title=payload.title, subtitle=payload.subtitle,
        url=payload.url, icon_key=payload.icon_key, category=payload.category,
        task_id=payload.task_id, roles=payload.roles, sort_order=payload.sort_order,
        is_visible=payload.is_visible, open_new_tab=payload.open_new_tab,
        extra=payload.extra,
    )
    db.add(svc)
    await db.commit()
    await db.refresh(svc)
    return ServiceOut(
        key=svc.key, title=svc.title, subtitle=svc.subtitle,
        url=svc.url, icon_key=svc.icon_key, category=svc.category,
        task_id=svc.task_id, roles=svc.roles or [], sort_order=svc.sort_order,
        is_visible=svc.is_visible, open_new_tab=svc.open_new_tab, extra=svc.extra or {},
    )


@router.patch("/admin/services/{key}", response_model=ServiceOut)
@limiter.limit("20/minute")
async def update_service(
    key: str,
    payload: ServicePatchIn,
    request: Request,
    db: AsyncSession = Depends(get_db),
    staff: User = Depends(require_staff),
):
    _validate_service_patch(payload)
    svc = await db.get(ExternalService, key)
    if svc is None:
        raise HTTPException(status_code=404, detail="Сервис не найден")
    for field in ("title", "subtitle", "url", "icon_key", "category",
                  "sort_order", "is_visible", "open_new_tab", "extra", "roles"):
        val = getattr(payload, field)
        if val is not None:
            setattr(svc, field, val)
    if payload.task_id is not ...:
        svc.task_id = payload.task_id
    db.add(svc)
    await db.commit()
    await db.refresh(svc)
    return ServiceOut(
        key=svc.key, title=svc.title, subtitle=svc.subtitle,
        url=svc.url, icon_key=svc.icon_key, category=svc.category,
        task_id=svc.task_id, roles=svc.roles or [], sort_order=svc.sort_order,
        is_visible=svc.is_visible, open_new_tab=svc.open_new_tab, extra=svc.extra or {},
    )


@router.delete("/admin/services/{key}", response_model=OkOut)
@limiter.limit("10/minute")
async def delete_service(
    key: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    staff: User = Depends(require_staff),
):
    """Hard delete: сервис физически удаляется из БД."""
    svc = await db.get(ExternalService, key)
    if svc is None:
        raise HTTPException(status_code=404, detail="Сервис не найден")
    await db.delete(svc)
    await db.commit()
    return OkOut()
