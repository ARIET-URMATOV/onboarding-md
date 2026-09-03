from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Stage, StageTask
from app.stages_data import load_stages_from_db

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
            1: ("Документы и mPlus", "Документы", "Заполни документы, познакомься с руководителем и установи корпоративный мессенджер mPLuse.", "Ачивка «Старт»", "Откроется после прохождения этапа", "docs"),
            2: ("Команда и руководство", "Команда", "Открой карточки ключевых сотрудников, познакомься с тимлидом и задай первый вопрос.", "Ачивка «Знакомство»", "Откроется после прохождения этапа", "team"),
            3: ("Видеообращение", "Видео", "Посмотри приветственное видео от руководства. Узнай о миссии, ценностях и планах команды.", "Ачивка «Вдохновение»", "Откроется после прохождения этапа", "video"),
            4: ("Тех. чек-лист", "Чек-лист", "Проверь, что у тебя есть всё необходимое для работы: доступы, инструменты, инструкции.", "Ачивка «Готовность»", "Откроется после прохождения этапа", "check"),
            5: ("Итоговый тест", "Тест", "Пройди финальный тест по материалам онбординга. Удачи!", "Ачивка «Мастер»", "Откроется после прохождения этапа", "test"),
        }
        out = []
        for sid, v in _FALLBACK_STAGES.items():
            t, sl, d, rn, rd, ik = fallback_titles[sid]
            sub = [{"id": tid, "title": tid, "xp": xp} for tid, xp in v["tasks"].items()]
            out.append({"id": sid, "title": t, "shortLabel": sl, "description": d, "xpReward": v["xp_reward"], "rewardName": rn, "rewardDesc": rd, "iconKey": ik, "subTasks": sub})
        return out
    by_stage: dict[int, list] = {s.id: [] for s in stages}
    for t in tasks:
        by_stage.setdefault(t.stage_id, []).append({"id": t.id, "title": t.title, "xp": t.xp})
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
