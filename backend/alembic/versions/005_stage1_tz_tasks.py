"""stage1 TZ v1.0 reseed: drop legacy, 5+0+5+10=20

Revision ID: 005
Revises: 004
Create Date: 2026-09-09
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# (id, stage_id, title, xp, sort_order)
TASKS = [
    ("1-dogovor", 1, "Договор об оказании услуг", 1, 1),
    ("1-nda", 1, "NDA Соглашение о неразглашении", 1, 2),
    ("1-pdp", 1, "Соглашение об обработке персональных данных", 1, 3),
    ("1-ip", 1, "Свидетельство ИП", 1, 4),
    ("1-sn", 1, "Справка о несудимости", 1, 5),
    ("1-mbusiness", 1, "MBusiness - открытие", 0, 6),
    ("1-accountant", 1, "Доступ бухгалтеру", 0, 7),
    ("1-wifi", 1, "Доступ к Wi-Fi (MAC адрес)", 0, 8),
    ("1-proxy", 1, "Прокси-карта и Face ID", 0, 9),
    ("1-telegram", 1, "Доступ в Telegram-группы", 0, 10),
    ("1-mpulse", 1, "Установка и авторизация MPulse", 1, 11),
    ("1-mpulse-schedule", 1, "Выбор рабочего графика", 1, 12),
    ("1-mpulse-checkin", 1, "Daily check-in/check-out", 1, 13),
    ("1-mpulse-code", 1, "Ввод проверочного кода", 1, 14),
    ("1-mpulse-news", 1, "Получение новостей и уведомлений", 1, 15),
    ("1-confluence-vacation", 1, "Правила оформления отпусков", 1, 16),
    ("1-confluence-grading", 1, "Система грейдинга и повышения", 1, 17),
    ("1-confluence-info", 1, "Общая информация о компании", 1, 18),
    ("1-confluence-rules", 1, "Правила внутреннего трудового распорядка", 1, 19),
    ("1-confluence-security", 1, "Безопасность информации", 1, 20),
    ("1-confluence-benefits", 1, "Соцпакет", 1, 21),
    ("1-confluence-contact", 1, "Контакты отделов", 1, 22),
    ("1-confluence-faq", 1, "Частые вопросы", 1, 23),
    ("1-confluence-read", 1, "Я ознакомился(ась)", 2, 24),
]

LEGACY = ("1-docs", "1-lead", "1-mplus", "1-jira", "1-confluence")


def upgrade() -> None:
    tasks_tbl = sa.table(
        "stage_tasks",
        sa.column("id", sa.Text),
        sa.column("stage_id", sa.Integer),
        sa.column("title", sa.Text),
        sa.column("xp", sa.Integer),
        sa.column("sort_order", sa.Integer),
    )
    # Удаляем legacy (их нет в новом SSOT; done_tasks старых юзеров подчистит normalize_tasks)
    op.execute(
        sa.text("DELETE FROM stage_tasks WHERE id IN ('1-docs','1-lead','1-mplus','1-jira','1-confluence')")
    )
    conn = op.get_bind()
    for t in TASKS:
        # upsert по PK: обновить если есть, вставить если нет
        conn.execute(
            sa.text(
                "INSERT INTO stage_tasks (id, stage_id, title, xp, sort_order) "
                "VALUES (:id, :sid, :title, :xp, :so) "
                "ON CONFLICT (id) DO UPDATE SET stage_id=EXCLUDED.stage_id, "
                "title=EXCLUDED.title, xp=EXCLUDED.xp, sort_order=EXCLUDED.sort_order"
            ),
            {"id": t[0], "sid": t[1], "title": t[2], "xp": t[3], "so": t[4]},
        )
    # SQLite (тесты) не поддерживает ON CONFLICT в таком виде через op.execute? —
    # фактически поддерживает; fallback ниже не нужен т.к. тесты используют create_all + fallback stages_data.
    _ = tasks_tbl


def downgrade() -> None:
    op.execute(
        sa.text(
            "DELETE FROM stage_tasks WHERE id LIKE '1-dogovor' OR id LIKE '1-nda' "
            "OR id LIKE '1-pdp' OR id LIKE '1-ip' OR id LIKE '1-sn' "
            "OR id LIKE '1-mbusiness' OR id LIKE '1-accountant' OR id LIKE '1-wifi' "
            "OR id LIKE '1-proxy' OR id LIKE '1-telegram' OR id LIKE '1-mpulse%' "
            "OR id LIKE '1-confluence-%'"
        )
    )
