"""telegram role groups seed: frontend/backend chat_ids

Revision ID: 016
Revises: 015
Create Date: 2026-09-10

Группы по ролям: [{title, chat_id, roles:[...]}]. Пустой roles = для всех.
HR меняет через /admin без редеплоя.
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "016"
down_revision: Union[str, None] = "015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SEED = (
    '[{"title": "Frontend Team", "chat_id": "-5444132439", "roles": ["frontend"]}, '
    '{"title": "Backend Team", "chat_id": "-5114175931", "roles": ["backend"]}]'
)


def upgrade() -> None:
    conn = op.get_bind()
    if conn.dialect.name == "postgresql":
        conn.execute(
            sa.text(
                "INSERT INTO app_settings (key, value) VALUES ('telegram.groups_json', :v) "
                "ON CONFLICT (key) DO NOTHING"
            ),
            {"v": SEED},
        )
    else:
        conn.execute(
            sa.text("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('telegram.groups_json', :v)"),
            {"v": SEED},
        )


def downgrade() -> None:
    pass
