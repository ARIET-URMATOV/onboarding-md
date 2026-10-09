"""Dev-only: seed stages/stage_tasks with the canonical 4-stage set.

For fresh local DBs (sqlite test.db) where Alembic seeds never ran.
Idempotent: skips when stage_tasks already has rows.
Source of truth for the dataset: alembic migration 028 (STAGES_4 / TASKS_4).

Usage:
    cd backend && DATABASE_URL="sqlite+aiosqlite:///./test.db" .venv/bin/python scripts/seed_stages.py
"""
import asyncio
import importlib.util
import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import text

from app.database import SessionLocal


def _load_028():
    path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "alembic", "versions", "028_stage_reorder_4stages.py")
    )
    spec = importlib.util.spec_from_file_location("m028", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


async def main() -> None:
    m28 = _load_028()
    from app.stages_data import task_meta

    import json as _json

    # (key, title, subtitle, url, icon_key, category, task_id, roles, sort_order)
    # Демо-контент департамента (FR-407): лиды дополняют через админку «Сервисы».
    DEPT_SERVICES = [
        ("dept-frontend-repo", "Репозиторий фронтенда", "GitLab · frontend",
         "https://gitlab.com/mdigital/frontend", "Link", "dept", None, ["frontend"], 1),
        ("dept-frontend-figma", "Figma команды", "Макеты и UI-кит",
         "https://figma.com", "ExternalLink", "dept", None, ["frontend"], 2),
        ("dept-frontend-guide", "Style guide", "Кодстайл и конвенции",
         "https://example.com/styleguide", "BookOpen", "dept", None, ["frontend"], 3),
        ("dept-frontend-test", "Тест по направлению", "Финальный тест Frontend",
         "https://example.com/tests/frontend", "ClipboardCheck", "dept", "5-take", ["frontend"], 4),
        ("dept-backend-test", "Тест по направлению", "Финальный тест Backend",
         "https://example.com/tests/backend", "ClipboardCheck", "dept", "5-take", ["backend"], 1),
        ("dept-design-test", "Тест по направлению", "Финальный тест Design",
         "https://example.com/tests/design", "ClipboardCheck", "dept", "5-take", ["design"], 1),
    ]

    async with SessionLocal() as db:
        n = (await db.execute(text("SELECT COUNT(*) FROM stage_tasks"))).scalar()
        if not n:
            for s in m28.STAGES_4:
                await db.execute(
                    text(
                        "INSERT INTO stages (id, title, short_label, description, xp_reward, "
                        "reward_name, reward_desc, icon_key, sort_order) "
                        "VALUES (:id, :title, :sl, :desc, :xp, :rn, :rd, :ik, :so)"
                    ),
                    {"id": s[0], "title": s[1], "sl": s[2], "desc": s[3], "xp": s[4],
                     "rn": s[5], "rd": s[6], "ik": s[7], "so": s[8]},
                )
            for t in m28.TASKS_4:
                vt, rr = task_meta(t[0])
                await db.execute(
                    text(
                        "INSERT INTO stage_tasks (id, stage_id, title, xp, sort_order, "
                        "verification_type, responsible_role) "
                        "VALUES (:id, :sid, :title, :xp, :so, :vt, :rr)"
                    ),
                    {"id": t[0], "sid": t[1], "title": t[2], "xp": t[3], "so": t[4],
                     "vt": vt, "rr": rr},
                )
            await db.commit()
            print(f"seeded {len(m28.STAGES_4)} stages, {len(m28.TASKS_4)} tasks")
        else:
            print(f"stage_tasks already has {n} rows — skip stages")

        n_svc = (await db.execute(text("SELECT COUNT(*) FROM external_services WHERE category = 'dept'"))).scalar()
        if not n_svc:
            from datetime import datetime, timezone

            now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
            for key, title, sub, url, icon, cat, tid, roles, so in DEPT_SERVICES:
                await db.execute(
                    text(
                        "INSERT INTO external_services (key, title, subtitle, url, icon_key, "
                        "category, task_id, roles, sort_order, is_visible, open_new_tab, extra, details, "
                        "created_at, updated_at) "
                        "VALUES (:key, :title, :sub, :url, :icon, :cat, :tid, :roles, :so, 1, 1, '{}', '', :now, :now)"
                    ),
                    {"key": key, "title": title, "sub": sub, "url": url, "icon": icon,
                     "cat": cat, "tid": tid, "roles": _json.dumps(roles), "so": so, "now": now},
                )
            await db.commit()
            print(f"seeded {len(DEPT_SERVICES)} dept services")


if __name__ == "__main__":
    asyncio.run(main())
