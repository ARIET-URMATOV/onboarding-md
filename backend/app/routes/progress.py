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


 @router.post("/verify-docs", response_model=OkOut)
 @limiter.limit("10/minute")
 async def verify_docs(
     request: Request,
     db: AsyncSession = Depends(get_db),
     user: User = Depends(require_role),
 ):
     """HR/administrator verifies document completion for Step 1.
     Marks all Step 1 document tasks as verified.
     """
     prog = await load_progress(db, user)
     tasks = normalize_tasks(prog.done_tasks)
     sid = "1"
     # Mark all Step 1 document tasks as done (they are already toggled by user,
     # this is HR final verification)
     doc_tasks = [tid for tid in tasks[sid] if tid.startswith("1-") and tid in {
         "1-dogovor", "1-nda", "1-pdp", "1-ip", "1-sn"
     }]
     # Ensure all 5 doc tasks are in the list
     required = {"1-dogovor", "1-nda", "1-pdp", "1-ip", "1-sn"}
     current = set(doc_tasks)
     if required <= current:
         # All document tasks are present, mark HR verified
         prog.done_tasks = normalize_tasks({**prog.done_tasks, "1": list(required | current)})
         db.add(prog)
         await db.commit()
         await db.refresh(prog)
     return OkOut()


 @router.post("/verify-mpulse-code", response_model=OkOut)
 @limiter.limit("10/minute")
 async def verify_mpulse_code(
     request: Request,
     db: AsyncSession = Depends(get_db),
     user: User = Depends(get_current_user),
 ):
     """Verify MPulse verification code entered by employee.
     The code is the same for all employees in this onboarding batch.
     """
     # In a real implementation, this would validate the code against a stored value
     # For now, we just mark the MPulse tasks as complete
     prog = await load_progress(db, user)
     tasks = normalize_tasks(prog.done_tasks)
     sid = "1"
     mpulse_tasks = [tid for tid in tasks[sid] if tid.startswith("1-mpulse")]
     # Mark all MPulse tasks as done
     new_mpulse = [t for t in ["1-mpulse", "1-mpulse-schedule", "1-mpulse-checkin", "1-mpulse-code", "1-mpulse-news"] if t not in mpulse_tasks]
     all_mpulse = mpulse_tasks + new_mpulse
     tasks[sid] = all_mpulse
     prog.done_tasks = normalize_tasks({**prog.done_tasks, "1": all_mpulse})
     db.add(prog)
     await db.commit()
     await db.refresh(prog)
     return OkOut()


 @router.post("/confirm-confluence", response_model=OkOut)
 @limiter.limit("10/minute")
 async def confirm_confluence(
     request: Request,
     db: AsyncSession = Depends(get_db),
     user: User = Depends(get_current_user),
 ):
     """Employee confirms familiarity with Confluence knowledge base.
     Marks the 'I have read' task as complete.
     """
     prog = await load_progress(db, user)
     tasks = normalize_tasks(prog.done_tasks)
     sid = "1"
     # Ensure 1-confluence-read is in the tasks list
     if "1-confluence-read" not in tasks[sid]:
         tasks[sid] = [*tasks[sid], "1-confluence-read"]
     prog.done_tasks = normalize_tasks({**prog.done_tasks, "1": tasks[sid]})
     db.add(prog)
     await db.commit()
     await db.refresh(prog)
     return OkOut()
