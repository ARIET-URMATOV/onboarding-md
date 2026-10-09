"""add users.is_lead (department lead per FR-407)

Revision ID: 029
Revises: 028
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "029"
down_revision: Union[str, None] = "028"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(conn, table: str, column: str) -> bool:
    if conn.dialect.name == "sqlite":
        rows = conn.execute(sa.text(f"PRAGMA table_info({table})")).fetchall()
        return any(r[1] == column for r in rows)
    return bool(
        conn.execute(
            sa.text(
                "SELECT 1 FROM information_schema.columns WHERE table_name=:t AND column_name=:c"
            ),
            {"t": table, "c": column},
        ).fetchone()
    )


def upgrade() -> None:
    conn = op.get_bind()
    if not _column_exists(conn, "users", "is_lead"):
        op.execute(sa.text("ALTER TABLE users ADD COLUMN is_lead BOOLEAN DEFAULT FALSE NOT NULL"))


def downgrade() -> None:
    conn = op.get_bind()
    if _column_exists(conn, "users", "is_lead"):
        op.drop_column("users", "is_lead")
