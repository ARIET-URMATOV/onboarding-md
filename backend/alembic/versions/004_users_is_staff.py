"""add users.is_staff (employee + staff simplification)

Revision ID: 004
Revises: 003
Create Date: 2026-09-09
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "004"
down_revision: Union[str, None] = "003"
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
    if not _column_exists(conn, "users", "is_staff"):
        op.execute(sa.text("ALTER TABLE users ADD COLUMN is_staff BOOLEAN DEFAULT FALSE NOT NULL"))


def downgrade() -> None:
    conn = op.get_bind()
    if _column_exists(conn, "users", "is_staff"):
        op.drop_column("users", "is_staff")
