"""OIDC fields + oidc_states table

Revision ID: 025
Revises: 024
Create Date: 2026-09-21
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "025"
down_revision: Union[str, None] = "024"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(conn, table: str, column: str) -> bool:
    insp = sa.inspect(conn)
    return column in [c["name"] for c in insp.get_columns(table)]


def upgrade() -> None:
    conn = op.get_bind()

    # --- users: OIDC columns ---
    if not _column_exists(conn, "users", "oidc_sub"):
        op.add_column("users", sa.Column("oidc_sub", sa.Text, nullable=True))
        op.create_index("ix_users_oidc_sub", "users", ["oidc_sub"], unique=True)

    if not _column_exists(conn, "users", "employee_uuid"):
        op.add_column("users", sa.Column("employee_uuid", sa.Text, nullable=True))

    if not _column_exists(conn, "users", "oidc_refresh_token"):
        op.add_column("users", sa.Column("oidc_refresh_token", sa.Text, nullable=True))

    # --- oidc_states: CSRF + PKCE temp store ---
    if not _table_exists(conn, "oidc_states"):
        op.create_table(
            "oidc_states",
            sa.Column("state", sa.Text, primary_key=True),
            sa.Column("nonce", sa.Text, nullable=False),
            sa.Column("code_verifier", sa.Text, nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("used", sa.Boolean, nullable=False, server_default=sa.text("false")),
        )


def _table_exists(conn, table: str) -> bool:
    return table in sa.inspect(conn).get_table_names()


def downgrade() -> None:
    conn = op.get_bind()
    if _table_exists(conn, "oidc_states"):
        op.drop_table("oidc_states")
    if _column_exists(conn, "users", "oidc_refresh_token"):
        op.drop_column("users", "oidc_refresh_token")
    if _column_exists(conn, "users", "employee_uuid"):
        op.drop_column("users", "employee_uuid")
    if _column_exists(conn, "users", "oidc_sub"):
        op.drop_index("ix_users_oidc_sub", table_name="users")
        op.drop_column("users", "oidc_sub")
