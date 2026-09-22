"""xp rebalance 2,3,4 -> 5xp single task, bonuses 0

Revision ID: 024
Revises: 023
Create Date: 2026-09-15
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "024"
down_revision: Union[str, None] = "023"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # bonuses -> 0 for stages 2,3,4
    op.execute("UPDATE stages SET xp_reward=0 WHERE id IN (2,3,4)")
    # remove old tasks
    op.execute(
        "DELETE FROM stage_tasks WHERE id IN "
        "('2-studio','2-profiles','2-lead','2-chat',"
        "'4-workspace','4-repo','4-figma','4-mail','4-messenger','4-style')"
    )
    # set remaining to 5 xp
    op.execute("UPDATE stage_tasks SET xp=5 WHERE id IN ('3-watch')")
    # ensure single tasks exist for 2 and 4
    # stage 2: 2-team-read
    op.execute(
        """
        INSERT INTO stage_tasks (id, stage_id, title, xp, sort_order, verification_type, responsible_role)
        VALUES ('2-team-read', 2, 'Ознакомился с командой', 5, 1, 'self', '')
        ON CONFLICT (id) DO UPDATE SET xp=5, stage_id=2, title='Ознакомился с командой'
        """
    )
    # stage 4: 4-ready
    op.execute(
        """
        INSERT INTO stage_tasks (id, stage_id, title, xp, sort_order, verification_type, responsible_role)
        VALUES ('4-ready', 4, 'Чек-лист пройден', 5, 1, 'self', '')
        ON CONFLICT (id) DO UPDATE SET xp=5, stage_id=4, title='Чек-лист пройден'
        """
    )
    # stage 3 ensure title/xp
    op.execute(
        "UPDATE stage_tasks SET title='Досмотреть видео до конца', xp=5 WHERE id='3-watch'"
    )


def downgrade() -> None:
    op.execute("UPDATE stages SET xp_reward=150 WHERE id=2")
    op.execute("UPDATE stages SET xp_reward=100 WHERE id=3")
    op.execute("UPDATE stages SET xp_reward=150 WHERE id=4")
    op.execute("DELETE FROM stage_tasks WHERE id IN ('2-team-read','4-ready')")
    # restore original tasks (xp values from before)
    for q in [
        "INSERT INTO stage_tasks (id, stage_id, title, xp, sort_order, verification_type) VALUES ('2-studio',2,'Студия у лида: знакомство',40,1,'self') ON CONFLICT DO NOTHING",
        "INSERT INTO stage_tasks (id, stage_id, title, xp, sort_order, verification_type) VALUES ('2-profiles',2,'Прочитать профили команды',40,2,'self') ON CONFLICT DO NOTHING",
        "INSERT INTO stage_tasks (id, stage_id, title, xp, sort_order, verification_type) VALUES ('2-lead',2,'Познакомиться с тимлидом',40,3,'self') ON CONFLICT DO NOTHING",
        "INSERT INTO stage_tasks (id, stage_id, title, xp, sort_order, verification_type) VALUES ('2-chat',2,'Задать вопрос в чат команды',30,4,'self') ON CONFLICT DO NOTHING",
        "INSERT INTO stage_tasks (id, stage_id, title, xp, sort_order, verification_type) VALUES ('4-workspace',4,'Рабочее место готово',25,1,'self') ON CONFLICT DO NOTHING",
        "INSERT INTO stage_tasks (id, stage_id, title, xp, sort_order, verification_type) VALUES ('4-repo',4,'Доступ к репозиторию',25,2,'self') ON CONFLICT DO NOTHING",
        "INSERT INTO stage_tasks (id, stage_id, title, xp, sort_order, verification_type) VALUES ('4-figma',4,'Доступ к Figma',25,3,'self') ON CONFLICT DO NOTHING",
        "INSERT INTO stage_tasks (id, stage_id, title, xp, sort_order, verification_type) VALUES ('4-mail',4,'Корпоративная почта',25,4,'self') ON CONFLICT DO NOTHING",
        "INSERT INTO stage_tasks (id, stage_id, title, xp, sort_order, verification_type) VALUES ('4-messenger',4,'Мессенджер настроен',25,5,'self') ON CONFLICT DO NOTHING",
        "INSERT INTO stage_tasks (id, stage_id, title, xp, sort_order, verification_type) VALUES ('4-style',4,'Прочитать инструкцию по стилю кода',25,6,'self') ON CONFLICT DO NOTHING",
    ]:
        op.execute(q)
    op.execute("UPDATE stage_tasks SET xp=100 WHERE id='3-watch'")
