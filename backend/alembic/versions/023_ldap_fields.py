"""add AD/LDAP fields to users

Revision ID: 023
Revises: 022
Create Date: 2026-09-14 17:36:00
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "023"
down_revision: Union[str, None] = "022"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("ad_login", sa.Text(), nullable=True),
    )
    op.create_index("ix_users_ad_login", "users", ["ad_login"], unique=False)
    op.add_column(
        "users",
        sa.Column("department", sa.Text(), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("position", sa.Text(), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("office", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "office")
    op.drop_column("users", "position")
    op.drop_column("users", "department")
    op.drop_index("ix_users_ad_login", "users")
    op.drop_column("users", "ad_login")