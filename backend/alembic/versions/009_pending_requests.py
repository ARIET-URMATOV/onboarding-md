"""pending_requests: employee request -> staff verify queue (kills free checklists)

Revision ID: 009
Revises: 008
Create Date: 2026-09-09
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "009"
down_revision: Union[str, None] = "008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS pending_requests (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            task_id TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            note TEXT NOT NULL DEFAULT '',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE(user_id, task_id)
        )
    """))
    op.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_pending_status ON pending_requests(status)"))


def downgrade() -> None:
    op.execute(sa.text("DROP TABLE IF EXISTS pending_requests"))
