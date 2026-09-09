"""verification_log + wifi_macs audit tables

Revision ID: 006
Revises: 005
Create Date: 2026-09-09
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS verification_log (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            task_id TEXT NOT NULL,
            verified_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            method TEXT NOT NULL DEFAULT 'manual',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """))
    op.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_verification_log_user ON verification_log(user_id)"))
    op.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS wifi_macs (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            mac TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE(user_id, mac)
        )
    """))


def downgrade() -> None:
    op.execute(sa.text("DROP TABLE IF EXISTS wifi_macs"))
    op.execute(sa.text("DROP TABLE IF EXISTS verification_log"))
