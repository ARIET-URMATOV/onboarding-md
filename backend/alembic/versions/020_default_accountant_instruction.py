"""seed default accountant instruction in app_settings

Revision ID: 020
Revises: 019
Create Date: 2026-09-11

Default instruction for employee 'Доступ бухгалтеру' card.
Only inserts if key doesn't exist (existing custom text is preserved).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "020"
down_revision: Union[str, None] = "019"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DEFAULT_TEXT = (
    "Передайте бухгалтеру реквизиты для выплат: копию свидетельства ИП "
    "(или выписку из реестра), БИН/ИИН, банковские реквизиты (БИК, IBAN, "
    "наименование банка). Выплаты — с 1 по 10 число. "
    "По вопросам начислений пишите бухгалтеру (контакт — у HR)."
)


def upgrade() -> None:
    conn = op.get_bind()
    if conn.dialect.name == "postgresql":
        conn.execute(
            sa.text(
                "INSERT INTO app_settings (key, value) VALUES (:key, :value) "
                "ON CONFLICT (key) DO NOTHING"
            ),
            {"key": "instruction.accountant", "value": DEFAULT_TEXT},
        )
    else:
        conn.execute(
            sa.text(
                "INSERT OR IGNORE INTO app_settings (key, value) VALUES (:key, :value)"
            ),
            {"key": "instruction.accountant", "value": DEFAULT_TEXT},
        )


def downgrade() -> None:
    pass
