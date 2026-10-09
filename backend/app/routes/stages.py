from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Stage, StageTask
from app.stages_data import load_stages_from_db, task_meta

router = APIRouter()

@router.get("/stages")
async def list_stages(db: AsyncSession = Depends(get_db)):
    # warm cache and return canonical list for frontend (front стучится сюда)
    await load_stages_from_db(db)
    rs = await db.execute(select(Stage).order_by(Stage.sort_order))
    stages = rs.scalars().all()
    rt = await db.execute(select(StageTask).order_by(StageTask.sort_order))
    tasks = rt.scalars().all()
    if not stages:
        # fallback hardcoded (тесты / до сида) — отдаём то же что в stages_data fallback
        from app.stages_data import _FALLBACK_STAGES

        fallback_titles = {
            1: ("Скачай приложение", "Приложение", "Установи корпоративное приложение MPulse и свяжи аккаунт: график, check-in/out, новости и уведомления.", "Ачивка «На связи»", "Откроется после прохождения этапа", "mobile"),
            2: ("Документы и доступы", "Документы", "Подписание документов, получение доступов и изучение базы знаний Confluence.", "Ачивка «Старт»", "Откроется после прохождения этапа", "docs"),
            3: ("Команда, видео и чек-лист", "Команда", "Знакомство с командой, приветственное видео и чек-лист первого дня.", "Ачивка «Знакомство»", "Откроется после прохождения этапа", "team"),
            4: ("Онбординг в департамент", "Департамент", "Задачи твоего направления: репозиторий, Figma, style guide и финальный тест.", "Ачивка «Мастер»", "Откроется после прохождения этапа", "test"),
        }
        out = []
        for sid, v in _FALLBACK_STAGES.items():
            t, sl, d, rn, rd, ik = fallback_titles[sid]
            sub = [
                {"id": tid, "title": tid, "xp": xp,
                 "verification_type": task_meta(tid)[0], "responsible_role": task_meta(tid)[1]}
                for tid, xp in v["tasks"].items()
            ]
            out.append({"id": sid, "title": t, "shortLabel": sl, "description": d, "xpReward": v["xp_reward"], "rewardName": rn, "rewardDesc": rd, "iconKey": ik, "subTasks": sub})
        return out
    by_stage: dict[int, list] = {s.id: [] for s in stages}
    for t in tasks:
        vt, rr = t.verification_type or task_meta(t.id)[0], t.responsible_role or task_meta(t.id)[1]
        by_stage.setdefault(t.stage_id, []).append(
            {"id": t.id, "title": t.title, "xp": t.xp,
             "verification_type": vt, "responsible_role": rr}
        )
    out2 = []
    for s in stages:
        out2.append({
            "id": s.id,
            "title": s.title,
            "shortLabel": s.short_label,
            "description": s.description,
            "xpReward": s.xp_reward,
            "rewardName": s.reward_name,
            "rewardDesc": s.reward_desc,
            "iconKey": s.icon_key,
            "subTasks": by_stage.get(s.id, []),
        })
    return out2
