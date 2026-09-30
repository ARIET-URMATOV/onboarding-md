"""v2_onboarding_models

Revision ID: 5912251a9715
Revises: 027
Create Date: 2026-09-30 18:15:30.102767
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5912251a9715'
down_revision: Union[str, None] = '027'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add staff_role to users
    op.add_column('users', sa.Column('staff_role', sa.String(), nullable=True))
    
    # Add department to stage_tasks
    op.add_column('stage_tasks', sa.Column('department', sa.Text(), nullable=True))

    # Create candidate_applications table
    op.create_table(
        'candidate_applications',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('number', sa.String(), nullable=False),
        sa.Column('name', sa.Text(), nullable=False),
        sa.Column('email', sa.Text(), nullable=False),
        sa.Column('phone', sa.Text(), nullable=False, server_default=''),
        sa.Column('department', sa.Text(), nullable=True),
        sa.Column('position', sa.Text(), nullable=True),
        sa.Column('planned_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('lead_name', sa.Text(), nullable=False, server_default=''),
        sa.Column('status', sa.String(), nullable=False, server_default='new'),
        sa.Column('email_verified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('ad_login', sa.Text(), nullable=True),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('stage1_progress', sa.JSON(), nullable=False, server_default='{}'),
        sa.Column('consent_given', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('consent_ip', sa.Text(), nullable=False, server_default=''),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_candidate_applications_email'), 'candidate_applications', ['email'], unique=False)
    op.create_index(op.f('ix_candidate_applications_number'), 'candidate_applications', ['number'], unique=True)

    # Create application_events table
    op.create_table(
        'application_events',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('application_id', sa.Integer(), nullable=False),
        sa.Column('from_status', sa.String(), nullable=False, server_default=''),
        sa.Column('to_status', sa.String(), nullable=False),
        sa.Column('author_id', sa.Integer(), nullable=True),
        sa.Column('comment', sa.Text(), nullable=False, server_default=''),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['application_id'], ['candidate_applications.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['author_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_application_events_application_id'), 'application_events', ['application_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_application_events_application_id'), table_name='application_events')
    op.drop_table('application_events')
    op.drop_index(op.f('ix_candidate_applications_number'), table_name='candidate_applications')
    op.drop_index(op.f('ix_candidate_applications_email'), table_name='candidate_applications')
    op.drop_table('candidate_applications')
    op.drop_column('stage_tasks', 'department')
    op.drop_column('users', 'staff_role')
