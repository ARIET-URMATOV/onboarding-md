"""telegram: users.telegram_username + settings seed (groups_json)

Revision ID: 014
Revises: 013
Create Date: 2026-09-10

@username обязателен для auto-add через Bot API (username -> user_id -> addChatMember).
Группы хранятся в app_settings[telegram.groups_json] = [{title, chat_id}],
меняются из /admin без кода и редеплоя.
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "014"
down_revision: Union[str, None] = "013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(conn, table: str, column: str) -> bool:
    res = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name=:t AND column_name=:c"
    ), {"t": table, "c": column})
    return res.scalar() is not None


def upgrade() -> None:
    conn = op.get_bind()
    dialect = conn.dialect.name
    if dialect == "postgresql":
        if not _column_exists(conn, "users", "telegram_username"):
            op.execute(sa.text("ALTER TABLE users ADD COLUMN telegram_username TEXT DEFAULT '' NOT NULL"))
    else:
        # sqlite (тесты): information_schema нет — через pragma
        cols = [r[1] for r in conn.execute(sa.text("PRAGMA table_info(users)")).fetchall()]
        if "telegram_username" not in cols:
            op.execute(sa.text("ALTER TABLE users ADD COLUMN telegram_username TEXT DEFAULT '' NOT NULL"))
    # seed настроек telegram (идемпотентно)
    conn.execute(sa.text(
        "INSERT INTO app_settings (key, value) VALUES ('telegram.groups_json', '[]') "
        "ON CONFLICT (key) DO NOTHING" if dialect == "postgresql"
        else "INSERT OR IGNORE INTO app_settings (key, value) VALUES ('telegram.groups_json', '[]')"
    ))


def downgrade() -> None:
    op.execute(sa.text("DELETE FROM app_settings WHERE key = 'telegram.groups_json'"))
    conn = op.get_bind()
    if conn.dialect.name == "postgresql":
        if _column_exists(conn, "users", "telegram_username"):
            op.drop_column("users", "telegram_username")
