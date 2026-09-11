"""external_services: add details column for modal instructions

Revision ID: 021
Revises: 020
Create Date: 2026-09-11

details = plain text, shown in ServiceModal when user clicks "Подробнее".
Seed default details for jira/gitlab/figma access services.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "021"
down_revision: Union[str, None] = "020"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SEED_DETAILS = {
    "jira": (
        "Jira — корпоративный трекер задач MDIGITAL.\n\n"
        "Как войти:\n"
        "1. Откройте ссылку и нажмите «Войти».\n"
        "2. Используйте ваш корпоративный логин и пароль (LDAP).\n"
        "3. Если пароль не подходит — обратитесь к HR или системному администратору.\n\n"
        "После входа вы увидите доску задач вашей команды. "
        "Задачи распределяются тимлидом."
    ),
    "gitlab": (
        "GitLab — хранилище кода MDIGITAL.\n\n"
        "Как войти:\n"
        "1. Откройте ссылку и нажмите «Sign in».\n"
        "2. Используйте корпоративный логин (LDAP) или примите приглашение на почту.\n"
        "3. Если приглашение не пришло — обратитесь к тимлиду.\n\n"
        "Ваш тимлид пригласит вас в нужные репозитории после входа."
    ),
    "figma": (
        "Figma — инструмент дизайна MDIGITAL.\n\n"
        "Figma не поддерживает LDAP-вход. Приглашение отправляется на вашу корпоративную почту.\n\n"
        "Что делать:\n"
        "1. Нажмите «Отправить приглашение» (если ещё не отправлено).\n"
        "2. Проверьте входящие на вашей почте.\n"
        "3. Примите приглашение и войдите.\n\n"
        "Если приглашение не пришло — обратитесь к HR."
    ),
}


def upgrade() -> None:
    op.add_column(
        "external_services",
        sa.Column("details", sa.Text(), nullable=False, server_default=""),
    )
    conn = op.get_bind()
    for key, details in SEED_DETAILS.items():
        conn.execute(
            sa.text(
                "UPDATE external_services SET details = :details "
                "WHERE key = :key AND (details IS NULL OR details = '')"
            ),
            {"key": key, "details": details},
        )


def downgrade() -> None:
    op.drop_column("external_services", "details")
