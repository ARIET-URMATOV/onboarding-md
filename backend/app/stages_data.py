# XP-источник: БД stages/stage_tasks (хардкод — fallback для тестов/до сида).
# Фронт стучится GET /api/stages, сервер считает XP только из БД.

# Stage 1 «Документы и доступы» — TZ v1.0: 5 + 0 + 5 + 10 = 20 баллов (task XP).
# Legacy 1-docs/1-lead/1-mplus/1-jira/1-confluence удалены (аддитивность ломала
# is_all_complete/compute_xp: старые юзеры 5/5 -> 5/29, бонус xp_reward недостижим).
# Confluence checklist (8×1) заменён одним тогглером 1-confluence-read ×10.
# normalize_tasks() отфильтрует legacy ID из done_tasks существующих юзеров.
_FALLBACK_STAGES: dict[int, dict] = {
    1: {"xp_reward": 150, "tasks": {
        # Step 1: Подписание документов (5 баллов, HR-верификация)
        "1-dogovor": 1, "1-nda": 1, "1-pdp": 1, "1-ip": 1, "1-sn": 1,
        # Step 2: Получение доступов (0 баллов, ручная верификация staff)
        "1-mbusiness": 0, "1-accountant": 0, "1-wifi": 0, "1-proxy": 0, "1-telegram": 0,
        "1-jira": 0, "1-figma": 0, "1-gitlab": 0,
        # Step 3: Корпоративное приложение MPulse (5 баллов, код)
        "1-mpulse": 1, "1-mpulse-schedule": 1, "1-mpulse-checkin": 1, "1-mpulse-code": 1, "1-mpulse-news": 1,
        # Step 4: База знаний Confluence (10 баллов, один тогглер; 5 ссылок + видимый таймер 120с)
        "1-confluence-read": 10,
    }},
    2: {"xp_reward": 150, "tasks": {"2-studio": 40, "2-profiles": 40, "2-lead": 40, "2-chat": 30}},
    3: {"xp_reward": 100, "tasks": {"3-watch": 100}},
    4: {"xp_reward": 150, "tasks": {"4-workspace": 25, "4-repo": 25, "4-figma": 25, "4-mail": 25, "4-messenger": 25, "4-style": 25}},
    5: {"xp_reward": 200, "tasks": {"5-take": 100, "5-confirm": 100}},
}
STAGES: dict[int, dict] = _FALLBACK_STAGES

# Мета верификации задач (SSOT для fallback; в БД — колонки stage_tasks).
# verification_type: manual_hr | manual_staff | technical_code | technical_password | technical_timer
# responsible_role: подпись ответственного для UI (бекенд делит только employee/staff).
TASK_META: dict[str, tuple[str, str]] = {
    "1-dogovor": ("manual_hr", "hr"), "1-nda": ("manual_hr", "hr"),
    "1-pdp": ("manual_hr", "hr"), "1-ip": ("manual_hr", "hr"), "1-sn": ("manual_hr", "hr"),
    "1-mbusiness": ("manual_staff", "hr"), "1-accountant": ("manual_staff", "accountant"),
    "1-wifi": ("manual_staff", "sysadmin"), "1-proxy": ("manual_staff", "lead"),
    "1-telegram": ("manual_staff", "teamlead"),
    "1-jira": ("manual_staff", "teamlead"), "1-figma": ("manual_staff", "teamlead"),
    "1-gitlab": ("manual_staff", "teamlead"),
    "1-mpulse": ("technical_code", "system"), "1-mpulse-schedule": ("technical_code", "system"),
    "1-mpulse-checkin": ("technical_code", "system"), "1-mpulse-code": ("technical_code", "system"),
    "1-mpulse-news": ("technical_code", "system"),
    "1-confluence-read": ("technical_timer", "system"),
}


def task_meta(task_id: str) -> tuple[str, str]:
    return TASK_META.get(task_id, ("manual", ""))


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
