"""stage 1 title/description: final naming «Документы и доступы»

Revision ID: 011
Revises: 010
Create Date: 2026-09-10
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "011"
down_revision: Union[str, None] = "010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(sa.text(
        "UPDATE stages SET title='Документы и доступы', "
        "description='Подписание документов, получение доступов, настройка MPulse и изучение базы знаний Confluence.' "
        "WHERE id=1"
    ))


def downgrade() -> None:
    pass
