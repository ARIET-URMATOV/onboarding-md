"""add progress.completed_at / updated_at if missing (safe for prod)

Revision ID: 003
Revises: 002
Create Date: 2026-09-07
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "003"
down_revision: Union[str, None] = "002"
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
    # IF NOT EXISTS is Postgres 9.6+ safe, but check via information_schema for extra safety
    # (alembic's op.add_column has no IF NOT EXISTS, so raw SQL is safest).
    if not _column_exists(conn, "progress", "completed_at"):
        op.execute(sa.text("ALTER TABLE progress ADD COLUMN completed_at TIMESTAMPTZ"))
    if not _column_exists(conn, "progress", "updated_at"):
        op.execute(sa.text("ALTER TABLE progress ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now() NOT NULL"))
        # backfill existing rows where updated_at is null (if column added nullable first)
        op.execute(sa.text("UPDATE progress SET updated_at = now() WHERE updated_at IS NULL"))


def downgrade() -> None:
    conn = op.get_bind()
    if _column_exists(conn, "progress", "completed_at"):
        op.drop_column("progress", "completed_at")
    if _column_exists(conn, "progress", "updated_at"):
        op.drop_column("progress", "updated_at")
