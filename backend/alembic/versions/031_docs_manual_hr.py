"""docs back to manual_hr: HR verifies document package by request.

Revision ID: 031
Revises: 030
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "031"
down_revision: Union[str, None] = "030"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DOC_IDS = "'1-dogovor','1-nda','1-pdp','1-ip','1-sn'"


def upgrade() -> None:
    op.execute(sa.text(
        f"UPDATE stage_tasks SET verification_type = 'manual_hr' WHERE id IN ({DOC_IDS})"
    ))


def downgrade() -> None:
    op.execute(sa.text(
        f"UPDATE stage_tasks SET verification_type = 'info_read' WHERE id IN ({DOC_IDS})"
    ))
