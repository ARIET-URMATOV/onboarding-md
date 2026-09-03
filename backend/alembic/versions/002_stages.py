"""stages + stage_tasks seed

Revision ID: 002
Revises: 001
Create Date: 2026-09-03
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

STAGES = [
    (1, "Документы и mPlus", "Документы", "Заполни документы, познакомься с руководителем и установи корпоративный мессенджер mPLuse.", 150, "Ачивка «Старт»", "Откроется после прохождения этапа", "docs", 1),
    (2, "Команда и руководство", "Команда", "Открой карточки ключевых сотрудников, познакомься с тимлидом и задай первый вопрос.", 150, "Ачивка «Знакомство»", "Откроется после прохождения этапа", "team", 2),
    (3, "Видеообращение", "Видео", "Посмотри приветственное видео от руководства. Узнай о миссии, ценностях и планах команды.", 100, "Ачивка «Вдохновение»", "Откроется после прохождения этапа", "video", 3),
    (4, "Тех. чек-лист", "Чек-лист", "Проверь, что у тебя есть всё необходимое для работы: доступы, инструменты, инструкции.", 150, "Ачивка «Готовность»", "Откроется после прохождения этапа", "check", 4),
    (5, "Итоговый тест", "Тест", "Пройди финальный тест по материалам онбординга. Удачи!", 200, "Ачивка «Мастер»", "Откроется после прохождения этапа", "test", 5),
]
TASKS = [
    ("1-docs", 1, "Заполнить документы", 40, 1),
    ("1-lead", 1, "Ознакомиться с руководителем", 40, 2),
    ("1-mplus", 1, "Скачать и установить mPLuse", 50, 3),
    ("1-jira", 1, "Доступ к Jira", 30, 4),
    ("1-confluence", 1, "Доступ к Confluence", 30, 5),
    ("2-studio", 2, "Студия у лида: знакомство", 40, 1),
    ("2-profiles", 2, "Прочитать профили команды", 40, 2),
    ("2-lead", 2, "Познакомиться с тимлидом", 40, 3),
    ("2-chat", 2, "Задать вопрос в чат команды", 30, 4),
    ("3-watch", 3, "Досмотреть видео до конца", 100, 1),
    ("4-workspace", 4, "Рабочее место готово", 25, 1),
    ("4-repo", 4, "Доступ к репозиторию", 25, 2),
    ("4-figma", 4, "Доступ к Figma", 25, 3),
    ("4-mail", 4, "Корпоративная почта", 25, 4),
    ("4-messenger", 4, "Мессенджер настроен", 25, 5),
    ("4-style", 4, "Прочитать инструкцию по стилю кода", 25, 6),
    ("5-take", 5, "Пройти тест по ссылке", 100, 1),
    ("5-confirm", 5, "Подтвердить прохождение теста", 100, 2),
]

def upgrade() -> None:
    op.create_table(
        "stages",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("short_label", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("xp_reward", sa.Integer(), nullable=False),
        sa.Column("reward_name", sa.Text(), nullable=False),
        sa.Column("reward_desc", sa.Text(), nullable=False),
        sa.Column("icon_key", sa.String(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default=sa.text("0")),
    )
    op.create_table(
        "stage_tasks",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("stage_id", sa.Integer(), sa.ForeignKey("stages.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("xp", sa.Integer(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default=sa.text("0")),
    )
    op.create_index("ix_stage_tasks_stage_id", "stage_tasks", ["stage_id"])
    stages_tbl = sa.table(
        "stages",
        sa.column("id", sa.Integer),
        sa.column("title", sa.Text),
        sa.column("short_label", sa.Text),
        sa.column("description", sa.Text),
        sa.column("xp_reward", sa.Integer),
        sa.column("reward_name", sa.Text),
        sa.column("reward_desc", sa.Text),
        sa.column("icon_key", sa.String),
        sa.column("sort_order", sa.Integer),
    )
    tasks_tbl = sa.table(
        "stage_tasks",
        sa.column("id", sa.Text),
        sa.column("stage_id", sa.Integer),
        sa.column("title", sa.Text),
        sa.column("xp", sa.Integer),
        sa.column("sort_order", sa.Integer),
    )
    op.bulk_insert(stages_tbl, [
        {"id": s[0], "title": s[1], "short_label": s[2], "description": s[3], "xp_reward": s[4], "reward_name": s[5], "reward_desc": s[6], "icon_key": s[7], "sort_order": s[8]}
        for s in STAGES
    ])
    op.bulk_insert(tasks_tbl, [
        {"id": t[0], "stage_id": t[1], "title": t[2], "xp": t[3], "sort_order": t[4]}
        for t in TASKS
    ])

def downgrade() -> None:
    op.drop_index("ix_stage_tasks_stage_id", table_name="stage_tasks")
    op.drop_table("stage_tasks")
    op.drop_table("stages")
