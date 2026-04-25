"""add status to logged_meals

Revision ID: add_status_logged_meals
Revises: <your_previous_revision_id>
Create Date: 2026-04-24

Replace <your_previous_revision_id> with the output of:
    alembic heads
"""

from alembic import op
import sqlalchemy as sa

revision = 'add_status_logged_meals'
down_revision = '<your_previous_revision_id>'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'logged_meals',
        sa.Column(
            'status',
            sa.String(20),
            nullable=False,
            server_default='logged',   # all existing rows become "logged"
        )
    )


def downgrade() -> None:
    op.drop_column('logged_meals', 'status')


# ── Run with: ─────────────────────────────────────────────────────────────────
#   alembic revision --autogenerate -m "add status to logged_meals"
#   alembic upgrade head
#
# OR apply manually in psql:
#   ALTER TABLE logged_meals ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'logged';