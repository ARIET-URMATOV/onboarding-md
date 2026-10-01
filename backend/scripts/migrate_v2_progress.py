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
            # V2 logic:
            # 1-intro -> stage "1"
            # 1-mpulse... -> stage "2"
            # 1-dogovor... -> stage "3"
            
            old_stage1 = tasks.get("1", [])
            if not old_stage1:
                # If they didn't even start, still mark stage 1 as done because they are already hired
                tasks["1"] = ["1-intro"]
                prog.done_tasks = tasks
                prog.xp = compute_xp(prog.done_tasks)
                updated += 1
                continue
                
            # Extract MPulse tasks
            mpulse_tasks = [t for t in old_stage1 if t.startswith("1-mpulse")]
            docs_tasks = [t for t in old_stage1 if not t.startswith("1-mpulse")]
            
            # New mapping
            new_tasks = {
                "1": ["1-intro"], # Auto-award stage 1 for existing hires
                "2": mpulse_tasks,
                "3": docs_tasks,
                "4": tasks.get("4", []), # Team/Video/Checklist were in 2,3,4 but wait
                "5": tasks.get("5", [])
            }
            
            # Wait, old Stages were:
            # 2: 2-team-read
            # 3: 3-watch
            # 4: 4-ready
            # In V2, Stage 4 COMBINES these: "2-team-read", "3-watch", "4-ready"
            
            v2_stage4 = []
            if "2-team-read" in tasks.get("2", []):
                v2_stage4.append("2-team-read")
            if "3-watch" in tasks.get("3", []):
                v2_stage4.append("3-watch")
            if "4-ready" in tasks.get("4", []):
                v2_stage4.append("4-ready")
                
            new_tasks["4"] = v2_stage4
            
            # Remove old keys
            if "2" in new_tasks and not new_tasks["2"]:
                del new_tasks["2"]
                
            prog.done_tasks = new_tasks
            prog.xp = compute_xp(prog.done_tasks)
            updated += 1
            
        await db.commit()
        print(f"Миграция завершена! Обновлено записей: {updated}")

if __name__ == "__main__":
    asyncio.run(run_migration())
