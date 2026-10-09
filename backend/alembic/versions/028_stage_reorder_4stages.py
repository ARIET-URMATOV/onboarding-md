"""reorder stages for MPulse WebView: AppDownload -> stage 1, 4 stages total

Revision ID: 028
Revises: 5912251a9715
Create Date: 2026-10-02

Прелогин-этап «Знакомство с компанией» переехал на публичную страницу и в
аутентифицированном онбординге больше не существует. Новый порядок:
  1 «Скачай приложение» (MPulse + корпоративные приложения)
  2 «Документы и доступы» (как v1, без шага MPulse)
  3 «Команда, видео и чек-лист»
  4 «Онбординг в департамент»
ID задач НЕ переименовываются (только stage_id) — done_tasks переносятся без потерь.
XP-таблица меняется (интро-этап 50+100 уходит); новая таблица — на утверждение HR (OQ-08).

Downgrade восстанавливает v2-дизайн из 5 этапов (prelogin intro + 2..5) —
обратимость для staging-отката (NFR-06). Прогресс при откате маппится обратно,
флаг бывшего интро восстановить нельзя (ставится пустым) — задокументировано.
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "028"
down_revision: Union[str, None] = "5912251a9715"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# (id, stage_id, title, xp, sort_order) — каноника нового порядка, 4 этапа.
TASKS_4 = [
    ("1-mpulse", 1, "Установка и авторизация MPulse", 1, 1),
    ("1-mpulse-schedule", 1, "Выбор рабочего графика", 1, 2),
    ("1-mpulse-checkin", 1, "Daily check-in/check-out", 1, 3),
    ("1-mpulse-code", 1, "Ввод проверочного кода", 1, 4),
    ("1-mpulse-news", 1, "Получение новостей и уведомлений", 1, 5),
    ("1-dogovor", 2, "Договор об оказании услуг", 1, 1),
    ("1-nda", 2, "NDA Соглашение о неразглашении", 1, 2),
    ("1-pdp", 2, "Соглашение об обработке персональных данных", 1, 3),
    ("1-ip", 2, "Свидетельство ИП", 1, 4),
    ("1-sn", 2, "Справка о несудимости", 1, 5),
    ("1-mbusiness", 2, "MBusiness - открытие", 0, 6),
    ("1-accountant", 2, "Доступ бухгалтеру", 0, 7),
    ("1-wifi", 2, "Доступ к Wi-Fi (MAC адрес)", 0, 8),
    ("1-proxy", 2, "Прокси-карта и Face ID", 0, 9),
    ("1-telegram", 2, "Доступ в Telegram-группы", 0, 10),
    ("1-jira", 2, "Доступ к Jira (AD-логин)", 0, 11),
    ("1-figma", 2, "Доступ к Figma (инвайт)", 0, 12),
    ("1-gitlab", 2, "Доступ к GitLab", 0, 13),
    ("1-confluence-read", 2, "Я ознакомился(ась)", 10, 14),
    ("2-team-read", 3, "Ознакомился с командой", 5, 1),
    ("3-watch", 3, "Досмотреть видео до конца", 5, 2),
    ("4-ready", 3, "Чек-лист пройден", 5, 3),
    ("5-take", 4, "Пройти тест по ссылке", 100, 1),
    ("5-confirm", 4, "Подтвердить прохождение теста", 100, 2),
]

# (id, title, short_label, description, xp_reward, reward_name, reward_desc, icon_key, sort_order)
STAGES_4 = [
    (1, "Скачай приложение", "Приложение",
     "Установи корпоративное приложение MPulse и свяжи аккаунт: график, check-in/out, новости и уведомления.",
     50, "Ачивка «На связи»", "Откроется после прохождения этапа", "mobile", 1),
    (2, "Документы и доступы", "Документы",
     "Подписание документов, получение доступов и изучение базы знаний Confluence.",
     100, "Ачивка «Старт»", "Откроется после прохождения этапа", "docs", 2),
    (3, "Команда, видео и чек-лист", "Команда",
     "Знакомство с командой, приветственное видео и чек-лист первого дня.",
     100, "Ачивка «Знакомство»", "Откроется после прохождения этапа", "team", 3),
    (4, "Онбординг в департамент", "Департамент",
     "Задачи твоего направления: репозиторий, Figma, style guide и финальный тест.",
     200, "Ачивка «Мастер»", "Откроется после прохождения этапа", "test", 4),
]

# v2-дизайн из 5 этапов — для downgrade (staging-откат).
STAGES_5 = [
    (1, "Знакомство с компанией", "Знакомство",
     "Компания, миссия и ценности, продукты и первый день. Проходится до входа, без авторизации.",
     100, "Ачивка «Первый шаг»", "Откроется после прохождения этапа", "docs", 1),
    (2, "Скачай приложение", "Приложение",
     "Установи корпоративное приложение MPulse и свяжи аккаунт: график, check-in/out, новости и уведомления.",
     50, "Ачивка «На связи»", "Откроется после прохождения этапа", "mobile", 2),
    (3, "Документы и доступы", "Документы",
     "Подписание документов, получение доступов и изучение базы знаний Confluence.",
     100, "Ачивка «Старт»", "Откроется после прохождения этапа", "docs", 3),
    (4, "Команда, видео и чек-лист", "Команда",
     "Знакомство с командой, приветственное видео и чек-лист первого дня.",
     100, "Ачивка «Знакомство»", "Откроется после прохождения этапа", "team", 4),
    (5, "Онбординг в департамент", "Департамент",
     "Задачи твоего направления: репозиторий, Figma, style guide и финальный тест.",
     200, "Ачивка «Мастер»", "Откроется после прохождения этапа", "test", 5),
]

TASKS_5 = [("1-intro", 1, "Знакомство с компанией", 50, 1)] + [
    (tid, sid + 1, title, xp, so) for (tid, sid, title, xp, so) in TASKS_4
]

TASK_STAGE_4 = {t[0]: t[1] for t in TASKS_4}
TASK_XP_4 = {t[0]: t[3] for t in TASKS_4}
REWARD_4 = {s[0]: s[4] for s in STAGES_4}
TASK_STAGE_5 = {t[0]: t[1] for t in TASKS_5}
TASK_XP_5 = {t[0]: t[3] for t in TASKS_5}
REWARD_5 = {s[0]: s[4] for s in STAGES_5}


def _remap_progress(conn, task_stage: dict, task_xp: dict, reward: dict, n_stages: int) -> int:
    """Переносит done_tasks на новую раскладку по ID задач (ключи не важны),
    пересчитывает xp. Возвращает число обновлённых строк. Портативно PG/SQLite."""
    import json

    rows = conn.execute(sa.text("SELECT user_id, done_tasks FROM progress")).fetchall()
    updated = 0
    for uid, raw in rows:
        data = json.loads(raw) if isinstance(raw, str) else (raw or {})
        new_tasks: dict[str, list] = {str(i): [] for i in range(1, n_stages + 1)}
        found = False
        for _sid, tids in (data.items() if isinstance(data, dict) else []):
            for tid in tids or []:
                ns = task_stage.get(str(tid))
                if ns is not None:
                    if str(tid) not in new_tasks[str(ns)]:
                        new_tasks[str(ns)].append(str(tid))
                    found = True
        if not found and data == new_tasks:
            continue
        xp = 0
        for sid, stage_tasks in task_xp_items(task_xp, n_stages, task_stage):
            done = new_tasks[sid]
            for tid, txp in stage_tasks:
                if tid in done:
                    xp += txp
            if all(tid in done for tid, _ in stage_tasks):
                xp += reward[int(sid)]
        conn.execute(
            sa.text("UPDATE progress SET done_tasks = :dt, xp = :xp WHERE user_id = :uid"),
            {"dt": json.dumps(new_tasks), "xp": xp, "uid": uid},
        )
        updated += 1
    return updated


def task_xp_items(task_xp, n_stages, task_stage):
    by_stage: dict[str, list] = {str(i): [] for i in range(1, n_stages + 1)}
    for tid, xp in task_xp.items():
        by_stage[str(task_stage[tid])].append((tid, xp))
    return by_stage.items()


def _upsert_stages(conn, stages) -> None:
    for s in stages:
        conn.execute(
            sa.text(
                "INSERT INTO stages (id, title, short_label, description, xp_reward, "
                "reward_name, reward_desc, icon_key, sort_order) "
                "VALUES (:id, :title, :sl, :desc, :xp, :rn, :rd, :ik, :so) "
                "ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, "
                "short_label=EXCLUDED.short_label, description=EXCLUDED.description, "
                "xp_reward=EXCLUDED.xp_reward, reward_name=EXCLUDED.reward_name, "
                "reward_desc=EXCLUDED.reward_desc, icon_key=EXCLUDED.icon_key, "
                "sort_order=EXCLUDED.sort_order"
            ),
            {"id": s[0], "title": s[1], "sl": s[2], "desc": s[3], "xp": s[4],
             "rn": s[5], "rd": s[6], "ik": s[7], "so": s[8]},
        )


def _upsert_tasks(conn, tasks) -> None:
    for t in tasks:
        conn.execute(
            sa.text(
                "INSERT INTO stage_tasks (id, stage_id, title, xp, sort_order) "
                "VALUES (:id, :sid, :title, :xp, :so) "
                "ON CONFLICT (id) DO UPDATE SET stage_id=EXCLUDED.stage_id, "
                "title=EXCLUDED.title, xp=EXCLUDED.xp, sort_order=EXCLUDED.sort_order"
            ),
            {"id": t[0], "sid": t[1], "title": t[2], "xp": t[3], "so": t[4]},
        )


def upgrade() -> None:
    conn = op.get_bind()
    _upsert_stages(conn, STAGES_4)
    conn.execute(sa.text("DELETE FROM stages WHERE id = 5"))
    conn.execute(sa.text("DELETE FROM stage_tasks WHERE id = '1-intro'"))
    _upsert_tasks(conn, TASKS_4)
    n = _remap_progress(conn, TASK_STAGE_4, TASK_XP_4, REWARD_4, 4)
    print(f"028: stages reordered to 4, progress rows remapped: {n}")


def downgrade() -> None:
    conn = op.get_bind()
    _upsert_stages(conn, STAGES_5)
    _upsert_tasks(conn, TASKS_5)
    n = _remap_progress(conn, TASK_STAGE_5, TASK_XP_5, REWARD_5, 5)
    print(f"028 downgrade: 5-stage v2 design restored, progress rows remapped: {n}")
