"""Админка задач этапов (FR-407): лиды департаментов и HR редактируют задачи
этапа 5 (и остальных): ссылки — через Сервисы, здесь — тексты, XP,
тип проверки и привязка к департаменту. Пока доступ — staff (C3 расширит
до is_lead своего департамента через require_task_editor)."""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select as _select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.limiter import limiter
from app.models import StageTask, User
from app.routes.auth import get_current_user, require_staff
from app.schemas import StageTaskIn, StageTaskOut, StageTaskPatchIn

router = APIRouter()

VALID_VERIFICATION_TYPES = (
    "info_read", "manual_hr", "manual_staff",
    "technical_code", "technical_password", "technical_timer",
    "self_link", "self",
)
VALID_DEPARTMENTS = ("Frontend", "Backend", "Design")


async def require_task_editor(user: User = Depends(get_current_user)) -> User:
    """Читать задачи этапов: staff или лид департамента (C3).
    NB: зависит от get_current_user, а не require_staff — иначе лиды
    отсекались бы до проверки is_lead."""
    if user.is_staff or getattr(user, "is_lead", False):
        return user
    raise HTTPException(status_code=403, detail="Нужно staff или флаг лида департамента")


def assert_can_edit(editor: User, department: str | None) -> None:
    """Писать задачи: staff — любые; лид — только задачи своего департамента
    (общие задачи без департамента — только staff)."""
    if editor.is_staff:
        return
    if not getattr(editor, "is_lead", False):
        raise HTTPException(status_code=403, detail="Нужно staff или флаг лида департамента")
    if not department or department != (editor.department or ""):
        raise HTTPException(status_code=403, detail="Лид редактирует только задачи своего департамента")


def _out(t: StageTask) -> dict:
    return {
        "id": t.id, "stage_id": t.stage_id, "title": t.title, "xp": t.xp,
        "sort_order": t.sort_order, "verification_type": t.verification_type,
        "responsible_role": t.responsible_role, "department": t.department,
    }


def _validate_common(stage_id: int | None, verification_type: str | None, department: str | None) -> None:
    if stage_id is not None and stage_id not in (1, 2, 3, 4):
        raise HTTPException(status_code=422, detail="stage_id: допустимы 1–4")
    if verification_type is not None and verification_type not in VALID_VERIFICATION_TYPES:
        raise HTTPException(status_code=422, detail=f"verification_type: допустимы {list(VALID_VERIFICATION_TYPES)}")
    if department is not None and department not in VALID_DEPARTMENTS:
        raise HTTPException(status_code=422, detail=f"department: допустимы {list(VALID_DEPARTMENTS)} или null")


@router.get("/admin/stage-tasks")
@limiter.limit("30/minute")
async def list_stage_tasks(
    request: Request,
    department: str | None = None,
    db: AsyncSession = Depends(get_db),
    editor: User = Depends(require_task_editor),
):
    """Список задач с фильтром по департаменту (null = общие)."""
    if department is not None and department not in VALID_DEPARTMENTS:
        raise HTTPException(status_code=422, detail=f"department: допустимы {list(VALID_DEPARTMENTS)}")
    q = _select(StageTask).order_by(StageTask.stage_id, StageTask.sort_order, StageTask.id)
    if department:
        q = q.where(StageTask.department == department)
    rows = (await db.execute(q)).scalars().all()
    return [_out(t) for t in rows]


@router.post("/admin/stage-tasks", response_model=StageTaskOut)
@limiter.limit("20/minute")
async def create_stage_task(
    payload: StageTaskIn,
    request: Request,
    db: AsyncSession = Depends(get_db),
    editor: User = Depends(require_task_editor),
):
    _validate_common(payload.stage_id, payload.verification_type, payload.department)
    if await db.get(StageTask, payload.id) is not None:
        raise HTTPException(status_code=409, detail=f"Задача «{payload.id}» уже существует")
    assert_can_edit(editor, payload.department)
    t = StageTask(
        id=payload.id, stage_id=payload.stage_id, title=payload.title, xp=payload.xp,
        sort_order=payload.sort_order, verification_type=payload.verification_type,
        responsible_role=payload.responsible_role or "", department=payload.department,
    )
    db.add(t)
    await db.commit()
    await db.refresh(t)
    return _out(t)


@router.patch("/admin/stage-tasks/{task_id}", response_model=StageTaskOut)
@limiter.limit("20/minute")
async def patch_stage_task(
    task_id: str,
    payload: StageTaskPatchIn,
    request: Request,
    db: AsyncSession = Depends(get_db),
    editor: User = Depends(require_task_editor),
):
    t = await db.get(StageTask, task_id)
    if t is None:
        raise HTTPException(status_code=404, detail="Задача не найдена")
    _validate_common(payload.stage_id, payload.verification_type, payload.department)
    # Лид: итоговая привязка после патча должна остаться в его департаменте.
    new_dept = payload.department if payload.department is not None else t.department
    assert_can_edit(editor, new_dept)
    for field in ("stage_id", "title", "xp", "sort_order", "verification_type", "responsible_role", "department"):
        val = getattr(payload, field)
        if val is not None:
            setattr(t, field, val)
    db.add(t)
    await db.commit()
    await db.refresh(t)
    return _out(t)


@router.patch("/admin/users/{user_id}/is-lead")
@limiter.limit("20/minute")
async def set_is_lead(
    user_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    staff: User = Depends(require_staff),
):
    """Выдать/снять флаг лида департамента (FR-407). Body: {"is_lead": bool}.
    Департамент лида берётся из user.department."""
    try:
        body = await request.json()
    except Exception:
        body = {}
    want = bool(body.get("is_lead", False))
    if user_id == staff.id and not want:
        raise HTTPException(status_code=400, detail="Нельзя снять флаг с себя")
    target = await db.get(User, user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="Сотрудник не найден")
    target.is_lead = want
    db.add(target)
    await db.commit()
    return {"ok": True, "user_id": target.id, "is_lead": target.is_lead}
