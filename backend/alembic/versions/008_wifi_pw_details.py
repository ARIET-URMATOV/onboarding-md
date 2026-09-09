"""wifi per-user encrypted passwords + verification details JSON

Revision ID: 008
Revises: 007
Create Date: 2026-09-09
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "008"
down_revision: Union[str, None] = "007"
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
    if not _column_exists(conn, "verification_log", "details"):
        op.execute(sa.text("ALTER TABLE verification_log ADD COLUMN details TEXT DEFAULT '{}' NOT NULL"))
    op.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS wifi_passwords (
            user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            password_encrypted TEXT NOT NULL,
            set_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """))


def downgrade() -> None:
    op.execute(sa.text("DROP TABLE IF EXISTS wifi_passwords"))
    conn = op.get_bind()
    if _column_exists(conn, "verification_log", "details"):
        op.drop_column("verification_log", "details")
