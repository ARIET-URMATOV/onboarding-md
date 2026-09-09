"""stage_tasks meta columns + mpulse_codes table

Revision ID: 007
Revises: 006
Create Date: 2026-09-09
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "007"
down_revision: Union[str, None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# task_id -> (verification_type, responsible_role)
META: dict[str, tuple[str, str]] = {
    "1-dogovor": ("manual_hr", "hr"),
    "1-nda": ("manual_hr", "hr"),
    "1-pdp": ("manual_hr", "hr"),
    "1-ip": ("manual_hr", "hr"),
    "1-sn": ("manual_hr", "hr"),
    "1-mbusiness": ("manual_staff", "hr"),
    "1-accountant": ("manual_staff", "accountant"),
    "1-wifi": ("manual_staff", "sysadmin"),
    "1-proxy": ("manual_staff", "lead"),
    "1-telegram": ("manual_staff", "teamlead"),
    "1-mpulse": ("technical_code", "system"),
    "1-mpulse-schedule": ("technical_code", "system"),
    "1-mpulse-checkin": ("technical_code", "system"),
    "1-mpulse-code": ("technical_code", "system"),
    "1-mpulse-news": ("technical_code", "system"),
    "1-confluence-vacation": ("technical_timer", "system"),
    "1-confluence-grading": ("technical_timer", "system"),
    "1-confluence-info": ("technical_timer", "system"),
    "1-confluence-rules": ("technical_timer", "system"),
    "1-confluence-security": ("technical_timer", "system"),
    "1-confluence-benefits": ("technical_timer", "system"),
    "1-confluence-contact": ("technical_timer", "system"),
    "1-confluence-faq": ("technical_timer", "system"),
    "1-confluence-read": ("technical_timer", "system"),
}


def _column_exists(conn, table: str, column: str) -> bool:
    res = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name=:t AND column_name=:c"
    ), {"t": table, "c": column})
    return res.scalar() is not None


def upgrade() -> None:
    conn = op.get_bind()
    if not _column_exists(conn, "stage_tasks", "verification_type"):
        op.execute(sa.text("ALTER TABLE stage_tasks ADD COLUMN verification_type TEXT DEFAULT 'manual' NOT NULL"))
    if not _column_exists(conn, "stage_tasks", "responsible_role"):
        op.execute(sa.text("ALTER TABLE stage_tasks ADD COLUMN responsible_role TEXT DEFAULT '' NOT NULL"))
    for tid, (vt, rr) in META.items():
        conn.execute(
            sa.text("UPDATE stage_tasks SET verification_type=:vt, responsible_role=:rr WHERE id=:tid"),
            {"vt": vt, "rr": rr, "tid": tid},
        )
    op.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS mpulse_codes (
            id SERIAL PRIMARY KEY,
            code TEXT NOT NULL UNIQUE,
            batch_name TEXT NOT NULL DEFAULT '',
            valid_from TIMESTAMPTZ,
            valid_until TIMESTAMPTZ,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """))


def downgrade() -> None:
    op.execute(sa.text("DROP TABLE IF EXISTS mpulse_codes"))
    conn = op.get_bind()
    if _column_exists(conn, "stage_tasks", "responsible_role"):
        op.drop_column("stage_tasks", "responsible_role")
    if _column_exists(conn, "stage_tasks", "verification_type"):
        op.drop_column("stage_tasks", "verification_type")
