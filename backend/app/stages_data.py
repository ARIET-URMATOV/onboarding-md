# XP-источник: БД stages/stage_tasks (хардкод — fallback для тестов/до сида).
# Фронт стучится GET /api/stages, сервер считает XP только из БД.

_FALLBACK_STAGES: dict[int, dict] = {
    1: {"xp_reward": 150, "tasks": {"1-docs": 40, "1-lead": 40, "1-mplus": 50, "1-jira": 30, "1-confluence": 30}},
    2: {"xp_reward": 150, "tasks": {"2-studio": 40, "2-profiles": 40, "2-lead": 40, "2-chat": 30}},
    3: {"xp_reward": 100, "tasks": {"3-watch": 100}},
    4: {"xp_reward": 150, "tasks": {"4-workspace": 25, "4-repo": 25, "4-figma": 25, "4-mail": 25, "4-messenger": 25, "4-style": 25}},
    5: {"xp_reward": 200, "tasks": {"5-take": 100, "5-confirm": 100}},
}
STAGES: dict[int, dict] = _FALLBACK_STAGES


_cached: dict[int, dict] | None = None
_KNOWN_TASK_IDS: dict[str, set[str]] = {
    str(sid): set(stage["tasks"].keys()) for sid, stage in _FALLBACK_STAGES.items()
}


def _apply_stages(d: dict[int, dict]) -> None:
    global _cached, STAGES, _KNOWN_TASK_IDS
    _cached = d
    STAGES = d
    _KNOWN_TASK_IDS = {str(sid): set(st["tasks"].keys()) for sid, st in d.items()}


async def load_stages_from_db(db) -> dict[int, dict]:
    """Грузит stages/stage_tasks из БД, кеширует и обновляет STAGES. Fallback если таблица пуста."""
    try:
        from sqlalchemy import select

        from app.models import Stage, StageTask

        rs = await db.execute(select(Stage).order_by(Stage.sort_order))
        stages = rs.scalars().all()
        if not stages:
            return get_stages_sync()
        rt = await db.execute(select(StageTask).order_by(StageTask.sort_order))
        tasks = rt.scalars().all()
        by_stage: dict[int, dict[str, int]] = {s.id: {} for s in stages}
        for t in tasks:
            by_stage.setdefault(t.stage_id, {})[t.id] = t.xp
        d: dict[int, dict] = {}
        for s in stages:
            d[s.id] = {"xp_reward": s.xp_reward, "tasks": by_stage.get(s.id, {})}
        _apply_stages(d)
        return d
    except Exception:
        return get_stages_sync()


def get_stages_sync() -> dict[int, dict]:
    return _cached if _cached is not None else _FALLBACK_STAGES


def compute_xp(done_tasks: dict) -> int:
    total = 0
    stages = get_stages_sync()
    for sid, stage in stages.items():
        done = done_tasks.get(str(sid)) or []
        for tid, xp in stage["tasks"].items():
            if tid in done:
                total += xp
        if all(tid in done for tid in stage["tasks"]):
            total += stage["xp_reward"]
    return total


def compute_level(xp: int) -> int:
    return xp // 100 + 1


def is_all_complete(done_tasks: dict) -> bool:
    stages = get_stages_sync()
    for sid, stage in stages.items():
        done = done_tasks.get(str(sid)) or []
        if not all(tid in done for tid in stage["tasks"]):
            return False
    return True


def normalize_tasks(done_tasks: dict | None) -> dict:
    stages = get_stages_sync()
    out = {str(sid): [] for sid in stages}
    if not out:
        out = {sid: [] for sid in ("1", "2", "3", "4", "5")}
    if not isinstance(done_tasks, dict):
        return out
    for sid in out:
        val = done_tasks.get(sid)
        if isinstance(val, list):
            known = _KNOWN_TASK_IDS.get(sid, set())
            out[sid] = [str(x) for x in val if str(x) in known]
    return out


async def warm_stages_cache() -> None:
    try:
        from app.database import SessionLocal

        async with SessionLocal() as db:
            await load_stages_from_db(db)
    except Exception:
        pass
