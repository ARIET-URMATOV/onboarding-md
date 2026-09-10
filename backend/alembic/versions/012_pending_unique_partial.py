"""pending_requests: unique только для status='pending' (история rejected хранится)

Revision ID: 012
Revises: 011
Create Date: 2026-09-10

Было: UNIQUE(user_id, task_id) — повторный request после reject падал 500
(IntegrityError). Стало: partial unique index только на pending; rejected —
история для HR-аудита. Resubmit делает UPDATE rejected->pending, не INSERT.
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "012"
down_revision: Union[str, None] = "011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    dialect = conn.dialect.name
    if dialect == "postgresql":
        # снять полный unique constraint (имя автогенерации postgres)
        res = conn.execute(sa.text("""
            SELECT conname FROM pg_constraint
            WHERE conrelid = 'pending_requests'::regclass AND contype = 'u'
        """))
        for (name,) in res.fetchall():
            conn.execute(sa.text(f'ALTER TABLE pending_requests DROP CONSTRAINT "{name}"'))
    # partial unique: только одна pending-строка на (user, task).
    # sqlite (тесты) partial index поддерживает; UNIQUE в create_table sqlite
    # остаётся, но тесты идут через models create_all без этого constraint —
    # см. models.PendingRequest без UniqueConstraint.
    op.execute(sa.text("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_pending_user_task
        ON pending_requests (user_id, task_id) WHERE status = 'pending'
    """))


def downgrade() -> None:
    op.execute(sa.text("DROP INDEX IF EXISTS uq_pending_user_task"))
