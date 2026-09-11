"""telegram contacts: вариант A «Сначала Start» — связка tg_user_id ↔ username

Revision ID: 017
Revises: 016
Create Date: 2026-09-11

Webhook сохраняет контакт при /start (и любом сообщении боту).
Резолв в auto-add: 1) эта таблица, 2) getChat(@username), 3) getUpdates.
(Заменяет невыпущенный черновик 017 invites: таблица telegram_invites, если
есть от локального прогона, удаляется.)
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "017"
down_revision: Union[str, None] = "016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    # черновик invites никогда не мержился — чистим след локального прогона
    conn.execute(sa.text("DROP TABLE IF EXISTS telegram_invites"))
    op.create_table(
        "telegram_contacts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tg_user_id", sa.Integer(), nullable=False),
        sa.Column("username", sa.Text(), nullable=False, server_default=""),
        sa.Column("first_name", sa.Text(), nullable=False, server_default=""),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
    )
    op.create_unique_constraint("uq_telegram_contacts_tg_user_id", "telegram_contacts", ["tg_user_id"])
    op.create_index("ix_telegram_contacts_tg_user_id", "telegram_contacts", ["tg_user_id"])
    op.create_index("ix_telegram_contacts_username", "telegram_contacts", ["username"])


def downgrade() -> None:
    op.drop_table("telegram_contacts")
