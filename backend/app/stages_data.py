# Сервер-авторитетная копия XP-данных этапов (зеркало src/data/stages.ts).
# Фронт не может накрутить XP: сервер сам пересчитывает его из done_tasks.

STAGES: dict[int, dict] = {
    1: {
        "xp_reward": 150,
        "tasks": {
            "1-docs": 40,
            "1-lead": 40,
            "1-mplus": 50,
            "1-jira": 30,
            "1-confluence": 30,
        },
    },
    2: {
        "xp_reward": 150,
        "tasks": {
            "2-studio": 40,
            "2-profiles": 40,
            "2-lead": 40,
            "2-chat": 30,
        },
    },
    3: {
        "xp_reward": 100,
        "tasks": {
            "3-watch": 100,
        },
    },
    4: {
        "xp_reward": 150,
        "tasks": {
            "4-workspace": 25,
            "4-repo": 25,
            "4-figma": 25,
            "4-mail": 25,
            "4-messenger": 25,
            "4-style": 25,
        },
    },
    5: {
        "xp_reward": 200,
        "tasks": {
            "5-take": 100,
            "5-confirm": 100,
        },
    },
}


def compute_xp(done_tasks: dict) -> int:
    """Идемпотентный пересчёт XP из состояния done_tasks (включая бонус за этап)."""
    total = 0
    for sid, stage in STAGES.items():
        done = done_tasks.get(str(sid)) or []
        for tid, xp in stage["tasks"].items():
            if tid in done:
                total += xp
        if all(tid in done for tid in stage["tasks"]):
            total += stage["xp_reward"]
    return total


def stage_is_complete(sid: int, done_tasks: dict) -> bool:
    stage = STAGES.get(sid)
    if not stage:
        return False
    done = done_tasks.get(str(sid)) or []
    return all(tid in done for tid in stage["tasks"])


def normalize_tasks(done_tasks: dict | None) -> dict:
    out = {sid: [] for sid in ("1", "2", "3", "4", "5")}
    if not isinstance(done_tasks, dict):
        return out
    for sid in out:
        val = done_tasks.get(sid)
        if isinstance(val, list):
            out[sid] = [str(x) for x in val]
    return out
