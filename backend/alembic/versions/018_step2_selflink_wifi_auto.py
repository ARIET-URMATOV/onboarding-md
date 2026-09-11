"""step2: jira/figma/gitlab -> self_link, wifi -> technical_password (auto at MAC)

Revision ID: 018
Revises: 017
Create Date: 2026-09-11

Jira/GitLab/Figma: сотрудник открывает ссылку _blank → авто-зачёт (0 XP, без очереди).
Wi-Fi: отправка MAC = сразу done (сетевик задаёт пароль отдельно).
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "018"
down_revision: Union[str, None] = "017"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

CHANGES = [
    ("1-jira", "self_link", "teamlead"),
    ("1-figma", "self_link", "teamlead"),
    ("1-gitlab", "self_link", "teamlead"),
    ("1-wifi", "technical_password", "sysadmin"),
]


def upgrade() -> None:
    conn = op.get_bind()
    for tid, vt, rr in CHANGES:
        if conn.dialect.name == "postgresql":
            conn.execute(
                sa.text(
                    "UPDATE stage_tasks SET verification_type=:vt, responsible_role=:rr "
                    "WHERE id=:tid"
                ),
                {"tid": tid, "vt": vt, "rr": rr},
            )
        else:
            conn.execute(
                sa.text(
                    "UPDATE stage_tasks SET verification_type=:vt, responsible_role=:rr "
                    "WHERE id=:tid"
                ),
                {"tid": tid, "vt": vt, "rr": rr},
            )


def downgrade() -> None:
    conn = op.get_bind()
    for tid, _vt, _rr in [
        ("1-jira", "manual_staff", "teamlead"),
        ("1-figma", "manual_staff", "teamlead"),
        ("1-gitlab", "manual_staff", "teamlead"),
        ("1-wifi", "manual_staff", "sysadmin"),
    ]:
        conn.execute(
            sa.text(
                "UPDATE stage_tasks SET verification_type='manual_staff', "
                "responsible_role=CASE WHEN :tid='1-wifi' THEN 'sysadmin' ELSE 'teamlead' END "
                "WHERE id=:tid"
            ),
            {"tid": tid},
        )
