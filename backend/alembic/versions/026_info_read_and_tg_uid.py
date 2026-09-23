"""Add telegram_contacts.user_id + info_read verification types

Revision ID: 026
Revises: 025
Create Date: 2026-09-23
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "026"
down_revision: Union[str, None] = "025"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

INFO_READ_TASKS = [
    # Step 1: Документы (было manual_hr)
    "1-dogovor", "1-nda", "1-pdp", "1-ip", "1-sn",
    # Step 2: Доступы (было manual_staff / technical_password / self_link)
    "1-mbusiness", "1-accountant", "1-wifi", "1-proxy",
    "1-jira", "1-figma", "1-gitlab",
    # Step 3: MPulse (было technical_code)
    "1-mpulse", "1-mpulse-schedule", "1-mpulse-checkin", "1-mpulse-code", "1-mpulse-news",
]


def _column_exists(conn, table: str, column: str) -> bool:
    insp = sa.inspect(conn)
    return column in [c["name"] for c in insp.get_columns(table)]


def _table_exists(conn, table: str) -> bool:
    return table in sa.inspect(conn).get_table_names()


def upgrade() -> None:
    conn = op.get_bind()

    # --- telegram_contacts: user_id column for Start-based linking ---
    if _table_exists(conn, "telegram_contacts") and not _column_exists(conn, "telegram_contacts", "user_id"):
        op.add_column("telegram_contacts", sa.Column("user_id", sa.Integer, nullable=True))
        op.create_index("ix_telegram_contacts_user_id", "telegram_contacts", ["user_id"])

    # --- stage_tasks: switch doc/access/mpulse tasks to info_read ---
    if _table_exists(conn, "stage_tasks"):
        for tid in INFO_READ_TASKS:
            op.execute(
                sa.text("UPDATE stage_tasks SET verification_type = 'info_read' WHERE id = :tid"),
                {"tid": tid},
            )


def downgrade() -> None:
    conn = op.get_bind()

    if _table_exists(conn, "stage_tasks"):
        # Revert to old verification types
        revert_map = {
            "1-dogovor": "manual_hr", "1-nda": "manual_hr", "1-pdp": "manual_hr",
            "1-ip": "manual_hr", "1-sn": "manual_hr",
            "1-mbusiness": "manual_staff", "1-accountant": "manual_staff",
            "1-wifi": "technical_password", "1-proxy": "manual_staff",
            "1-jira": "self_link", "1-figma": "self_link", "1-gitlab": "self_link",
            "1-mpulse": "technical_code", "1-mpulse-schedule": "technical_code",
            "1-mpulse-checkin": "technical_code", "1-mpulse-code": "technical_code",
            "1-mpulse-news": "technical_code",
        }
        for tid, vtype in revert_map.items():
            op.execute(
                sa.text("UPDATE stage_tasks SET verification_type = :vtype WHERE id = :tid"),
                {"tid": tid, "vtype": vtype},
            )

    if _table_exists(conn, "telegram_contacts") and _column_exists(conn, "telegram_contacts", "user_id"):
        op.drop_index("ix_telegram_contacts_user_id", table_name="telegram_contacts")
        op.drop_column("telegram_contacts", "user_id")
