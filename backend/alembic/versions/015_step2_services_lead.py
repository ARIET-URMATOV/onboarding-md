"""step2: tasks 1-jira/1-figma/1-gitlab (0 XP) + users.lead_id per-employee

Revision ID: 015
Revises: 014
Create Date: 2026-09-10

Сервисы команды — отдельные задачи Step 2 (план Шаг 2.6), верификация manual/teamlead.
Lead per-employee: users.lead_id FK nullable; fallback — contacts.lead_email.
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "015"
down_revision: Union[str, None] = "014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TASKS = [
    ("1-jira", 1, "Доступ к Jira (AD-логин)", 0, 25, "manual_staff", "teamlead"),
    ("1-figma", 1, "Доступ к Figma (инвайт)", 0, 26, "manual_staff", "teamlead"),
    ("1-gitlab", 1, "Доступ к GitLab", 0, 27, "manual_staff", "teamlead"),
]


def _column_exists(conn, table: str, column: str) -> bool:
    if conn.dialect.name != "postgresql":
        cols = [r[1] for r in conn.execute(sa.text(f"PRAGMA table_info({table})")).fetchall()]
        return column in cols
    res = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name=:t AND column_name=:c"
    ), {"t": table, "c": column})
    return res.scalar() is not None


def upgrade() -> None:
    conn = op.get_bind()
    for tid, sid, title, xp, so, vt, rr in TASKS:
        conn.execute(
            sa.text(
                "INSERT INTO stage_tasks (id, stage_id, title, xp, sort_order, verification_type, responsible_role) "
                "VALUES (:id, :sid, :title, :xp, :so, :vt, :rr) "
                + ("ON CONFLICT (id) DO UPDATE SET stage_id=EXCLUDED.stage_id, "
                   "title=EXCLUDED.title, xp=EXCLUDED.xp, sort_order=EXCLUDED.sort_order, "
                   "verification_type=EXCLUDED.verification_type, responsible_role=EXCLUDED.responsible_role"
                   if conn.dialect.name == "postgresql" else
                   "ON CONFLICT(id) DO UPDATE SET stage_id=excluded.stage_id, "
                   "title=excluded.title, xp=excluded.xp, sort_order=excluded.sort_order, "
                   "verification_type=excluded.verification_type, responsible_role=excluded.responsible_role")
            ),
            {"id": tid, "sid": sid, "title": title, "xp": xp, "so": so, "vt": vt, "rr": rr},
        )
    if not _column_exists(conn, "users", "lead_id"):
        if conn.dialect.name == "postgresql":
            op.execute(sa.text("ALTER TABLE users ADD COLUMN lead_id INTEGER REFERENCES users(id) ON DELETE SET NULL"))
        else:
            op.execute(sa.text("ALTER TABLE users ADD COLUMN lead_id INTEGER REFERENCES users(id) ON DELETE SET NULL"))


def downgrade() -> None:
    op.execute(sa.text("DELETE FROM stage_tasks WHERE id IN ('1-jira','1-figma','1-gitlab')"))
