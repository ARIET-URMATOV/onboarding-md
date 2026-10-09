"""v2 hardening: email codes in DB, departments, projects, onboarding_started_at.

Revision ID: 030
Revises: 029
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "030"
down_revision: Union[str, None] = "029"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(conn, table: str) -> bool:
    if conn.dialect.name == "sqlite":
        rows = conn.execute(sa.text(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=:t"
        ), {"t": table}).fetchall()
        return len(rows) > 0
    return bool(conn.execute(sa.text("SELECT to_regclass(:t)"), {"t": table}).fetchone()[0])


def _col_exists(conn, table: str, column: str) -> bool:
    if conn.dialect.name == "sqlite":
        rows = conn.execute(sa.text(f"PRAGMA table_info({table})")).fetchall()
        return any(r[1] == column for r in rows)
    return bool(conn.execute(sa.text(
        "SELECT 1 FROM information_schema.columns WHERE table_name=:t AND column_name=:c"
    ), {"t": table, "c": column}).fetchone())


def upgrade() -> None:
    conn = op.get_bind()
    dialect = conn.dialect.name
    jsontype = sa.JSON() if dialect == "sqlite" else sa.dialects.postgresql.JSONB()

    if not _table_exists(conn, "email_verification_codes"):
        op.create_table(
            "email_verification_codes",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("email", sa.Text(), nullable=False, index=True),
            sa.Column("code", sa.String(6), nullable=False),
            sa.Column("payload", jsontype, nullable=False, server_default="{}"),
            sa.Column("ip", sa.Text(), nullable=False, server_default=""),
            sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        )

    if not _table_exists(conn, "departments"):
        op.create_table(
            "departments",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("slug", sa.String(40), nullable=False, unique=True, index=True),
            sa.Column("display_name", sa.Text(), nullable=False),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        )
        op.execute(sa.text(
            "INSERT INTO departments (slug, display_name, is_active) VALUES "
            "('frontend','Frontend',1),('backend','Backend',1),('design','Design',1)"
        ))

    if not _col_exists(conn, "users", "onboarding_started_at"):
        op.add_column("users", sa.Column("onboarding_started_at", sa.DateTime(timezone=True), nullable=True))

    if not _table_exists(conn, "projects"):
        op.create_table(
            "projects",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("name", sa.Text(), nullable=False),
            sa.Column("client", sa.Text(), nullable=False, server_default=""),
            sa.Column("category", sa.String(40), nullable=False, server_default="product"),
            sa.Column("description", sa.Text(), nullable=False, server_default=""),
            sa.Column("stack", sa.Text(), nullable=False, server_default=""),
            sa.Column("stage", sa.Text(), nullable=False, server_default=""),
            sa.Column("jira_key", sa.Text(), nullable=False, server_default=""),
            sa.Column("jira_component", sa.Text(), nullable=False, server_default=""),
            sa.Column("confluence_space", sa.Text(), nullable=False, server_default=""),
            sa.Column("links", jsontype, nullable=False, server_default="{}"),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        )

    if not _table_exists(conn, "project_members"):
        op.create_table(
            "project_members",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("role", sa.String(20), nullable=False, server_default="dev"),
            sa.Column("responsibility", sa.Text(), nullable=False, server_default=""),
            sa.Column("contact_tg", sa.Text(), nullable=False, server_default=""),
            sa.Column("is_mentor", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        )

    if not _table_exists(conn, "project_docs"):
        op.create_table(
            "project_docs",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("title", sa.Text(), nullable=False),
            sa.Column("confluence_url", sa.Text(), nullable=False, server_default=""),
            sa.Column("is_required", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        )

    if not _table_exists(conn, "project_doc_reads"):
        op.create_table(
            "project_doc_reads",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("doc_id", sa.Integer(), sa.ForeignKey("project_docs.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("opened_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        )


def downgrade() -> None:
    for t in ("project_doc_reads", "project_docs", "project_members", "projects",
              "email_verification_codes", "departments"):
        try:
            op.drop_table(t)
        except Exception:
            pass
    try:
        op.drop_column("users", "onboarding_started_at")
    except Exception:
        pass
