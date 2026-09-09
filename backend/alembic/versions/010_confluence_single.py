"""confluence: 8 checklist tasks -> single 1-confluence-read x10

Revision ID: 010
Revises: 009
Create Date: 2026-09-09
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "010"
down_revision: Union[str, None] = "009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

OLD = (
    "1-confluence-vacation", "1-confluence-grading", "1-confluence-info",
    "1-confluence-rules", "1-confluence-security", "1-confluence-benefits",
    "1-confluence-contact", "1-confluence-faq",
)


def upgrade() -> None:
    conn = op.get_bind()
    placeholders = ",".join(f"'{t}'" for t in OLD)
    conn.execute(sa.text(f"DELETE FROM stage_tasks WHERE id IN ({placeholders})"))
    conn.execute(
        sa.text(
            "INSERT INTO stage_tasks (id, stage_id, title, xp, sort_order, verification_type, responsible_role) "
            "VALUES ('1-confluence-read', 1, 'Я ознакомился(ась)', 10, 24, 'technical_timer', 'system') "
            "ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, xp=EXCLUDED.xp, "
            "sort_order=EXCLUDED.sort_order, verification_type=EXCLUDED.verification_type, "
            "responsible_role=EXCLUDED.responsible_role"
        )
    )


def downgrade() -> None:
    pass
