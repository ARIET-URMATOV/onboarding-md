from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.limiter import limiter
from app.models import Progress, User
from app.routes.auth import get_current_user, require_role
from app.schemas import OkOut, ProgressOut, StageActionIn, TaskIn, VoiceIn
from app.stages_data import STAGES, compute_level, compute_xp, is_all_complete, normalize_tasks

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
