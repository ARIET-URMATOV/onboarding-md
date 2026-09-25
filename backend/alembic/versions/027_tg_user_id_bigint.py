"""telegram_contacts.tg_user_id INTEGER -> BIGINT (TG ids exceed int32)

Revision ID: 027
Revises: 026
Create Date: 2026-09-25
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "027"
down_revision: Union[str, None] = "026"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(conn, table: str) -> bool:
    return table in sa.inspect(conn).get_table_names()


def upgrade() -> None:
    conn = op.get_bind()
    if not _table_exists(conn, "telegram_contacts"):
        return
    cols = {c["name"]: c for c in sa.inspect(conn).get_columns("telegram_contacts")}
    col = cols.get("tg_user_id")
    if col is None:
        return
    # Уже BIGINT — нечего делать (SQLite отдаёт INTEGER всегда, пропускаем там)
    if conn.dialect.name != "postgresql":
        return
    if isinstance(col["type"], sa.BigInteger):
        return
    op.alter_column("telegram_contacts", "tg_user_id", type_=sa.BigInteger())


def downgrade() -> None:
    conn = op.get_bind()
    if not _table_exists(conn, "telegram_contacts"):
        return
    if conn.dialect.name != "postgresql":
        return
    op.alter_column("telegram_contacts", "tg_user_id", type_=sa.Integer())
