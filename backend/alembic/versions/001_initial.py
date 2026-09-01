"""initial schema — users + progress

Revision ID: 001
Revises:
Create Date: 2026-09-01
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("role", sa.String(), nullable=True),
        sa.Column("avatar", sa.Text(), nullable=True),
        sa.Column("intro_seen", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("voice_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    # JSONB on Postgres, JSON fallback on SQLite is handled by SQLAlchemy variant;
    # alembic renders the base type (JSONB) — SQLite will accept JSON.
    op.create_table(
        "progress",
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column(
            "done_tasks",
            postgresql.JSONB().with_variant(sa.JSON(), "sqlite"),
            nullable=False,
            server_default=sa.text("'{\"1\": [], \"2\": [], \"3\": [], \"4\": [], \"5\": []}'"),
        ),
        sa.Column("xp", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("progress")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
