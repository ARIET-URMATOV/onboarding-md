import asyncio
import os
import sys

# Добавляем корневую директорию проекта в sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import select
from app.database import SessionLocal
from app.models import Progress, User
from app.stages_data import compute_xp

async def run_migration():
    print("Начинаем миграцию прогресса пользователей на V2...")
    async with SessionLocal() as db:
        users = (await db.execute(select(User))).scalars().all()
        print(f"Найдено пользователей: {len(users)}")
        
        updated = 0
        for user in users:
            prog = await db.get(Progress, user.id)
            if not prog:
                continue
                
            tasks = prog.done_tasks or {}
            
            # V1 logic: all in stage "1"
            # V2 logic (4 authenticated stages, intro lives on the public page):
            # 1-mpulse... -> stage "1" (Скачай приложение)
            # docs/accesses/confluence -> stage "2" (Документы и доступы)
            # 2-team-read/3-watch/4-ready -> stage "3" (combined)
            # old 5-take/5-confirm stay in stage "4" (dept)
            
            old_stage1 = tasks.get("1", [])
            if not old_stage1 and not any(tasks.get(k) for k in ("2", "3", "4", "5")):
                # If they didn't even start, nothing to migrate — fresh WebView flow
                prog.done_tasks = {"1": [], "2": [], "3": [], "4": []}
                prog.xp = compute_xp(prog.done_tasks)
                updated += 1
                continue
                
            # Extract MPulse tasks
            mpulse_tasks = [t for t in old_stage1 if t.startswith("1-mpulse")]
            docs_tasks = [t for t in old_stage1 if not t.startswith("1-mpulse") and t != "1-intro"]
            
            v2_stage3 = []
            if "2-team-read" in tasks.get("2", []):
                v2_stage3.append("2-team-read")
            if "3-watch" in tasks.get("3", []):
                v2_stage3.append("3-watch")
            if "4-ready" in tasks.get("4", []):
                v2_stage3.append("4-ready")
                
            new_tasks = {
                "1": mpulse_tasks,
                "2": docs_tasks,
                "3": v2_stage3,
                "4": tasks.get("5", []),
            }
                
            prog.done_tasks = new_tasks
            prog.xp = compute_xp(prog.done_tasks)
            updated += 1
            
        await db.commit()
        print(f"Миграция завершена! Обновлено записей: {updated}")

if __name__ == "__main__":
    asyncio.run(run_migration())
