"""add_coach_profile_fields

Revision ID: 9ecb64449fbe
Revises: 
Create Date: 2026-03-31 15:18:03.062246

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9ecb64449fbe'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - Add coach profile fields to users table."""
    # Add gender column
    op.add_column('users', sa.Column('gender', sa.String(), nullable=True))
    
    # Add coach branding fields
    op.add_column('users', sa.Column('certifications', sa.JSON(), nullable=True))
    op.add_column('users', sa.Column('specialization', sa.JSON(), nullable=True))
    op.add_column('users', sa.Column('intro_video_url', sa.String(), nullable=True))
    op.add_column('users', sa.Column('profile_image_url', sa.String(), nullable=True))
    op.add_column('users', sa.Column('coach_category', sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema - Remove coach profile fields from users table."""
    # Remove coach branding fields
    op.drop_column('users', 'coach_category')
    op.drop_column('users', 'profile_image_url')
    op.drop_column('users', 'intro_video_url')
    op.drop_column('users', 'specialization')
    op.drop_column('users', 'certifications')
    
    # Remove gender column
    op.drop_column('users', 'gender')
