"""app_settings: контакты ответственных (HR/сетевик/лид/бухгалтер/тимлид)

Revision ID: 013
Revises: 012
Create Date: 2026-09-10

Хардкодить контакты в коде нельзя (план Шаг 2): администратор меняет в /admin.
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "013"
down_revision: Union[str, None] = "012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL DEFAULT '',
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """))


def downgrade() -> None:
    op.execute(sa.text("DROP TABLE IF EXISTS app_settings"))
