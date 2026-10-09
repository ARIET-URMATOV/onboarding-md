# XP-источник: БД stages/stage_tasks (хардкод — fallback для тестов/до сида).
# Фронт стучится GET /api/stages, сервер считает XP только из БД.

# Stage 1 «Скачай приложение» — первый экран после входа (FR-401).
# Stage 2 «Документы и доступы» — как v1, без шага MPulse (FR-404).
# Stage 3 «Команда, видео, чек-лист» — объединённые старые 2, 3, 4 (FR-405).
# Stage 4 «Онбординг в департамент» — задачи зависят от департамента (FR-406).
# Прелогин-этап «Знакомство с компанией» живёт на публичной странице, а не здесь:
# после первого входа по AD сразу открыт этап 1.
_FALLBACK_STAGES: dict[int, dict] = {
    # Stage 1: Скачай приложение (MPulse + корпоративные приложения)
    1: {"xp_reward": 50, "tasks": {
        "1-mpulse": 1, "1-mpulse-schedule": 1, "1-mpulse-checkin": 1, "1-mpulse-code": 1, "1-mpulse-news": 1,
    }},
    # Stage 2: Документы и доступы (бывший этап 1 без MPulse)
    2: {"xp_reward": 100, "tasks": {
        "1-dogovor": 1, "1-nda": 1, "1-pdp": 1, "1-ip": 1, "1-sn": 1,
        "1-mbusiness": 0, "1-accountant": 0, "1-wifi": 0, "1-proxy": 0, "1-telegram": 0,
        "1-jira": 0, "1-figma": 0, "1-gitlab": 0,
        "1-confluence-read": 10,
    }},
    # Stage 3: Команда, видео, чек-лист
    3: {"xp_reward": 100, "tasks": {
        "2-team-read": 5,
        "3-watch": 5,
        "4-ready": 5,
    }},
    # Stage 4: Онбординг в департамент
    4: {"xp_reward": 200, "tasks": {
        "5-take": 100, "5-confirm": 100
    }},
}
STAGES: dict[int, dict] = _FALLBACK_STAGES

# Мета верификации задач (SSOT для fallback; в БД — колонки stage_tasks).
# verification_type: info_read | manual_hr | manual_staff | technical_code | technical_password | technical_timer
# responsible_role: подпись ответственного для UI (бекенд делит только employee/staff).
TASK_META: dict[str, tuple[str, str]] = {
    "1-dogovor": ("manual_hr", "hr"), "1-nda": ("manual_hr", "hr"),
    "1-pdp": ("manual_hr", "hr"), "1-ip": ("manual_hr", "hr"), "1-sn": ("manual_hr", "hr"),
    "1-mbusiness": ("info_read", "hr"), "1-accountant": ("info_read", "accountant"),
    "1-wifi": ("info_read", "sysadmin"), "1-proxy": ("info_read", "lead"),
    "1-telegram": ("manual_staff", "teamlead"),
    "1-jira": ("info_read", "teamlead"), "1-figma": ("info_read", "teamlead"),
    "1-gitlab": ("info_read", "teamlead"),
    "1-mpulse": ("info_read", "system"), "1-mpulse-schedule": ("info_read", "system"),
    "1-mpulse-checkin": ("info_read", "system"), "1-mpulse-code": ("info_read", "system"),
    "1-mpulse-news": ("info_read", "system"),
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
        out = {sid: [] for sid in ("1", "2", "3", "4")}
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
