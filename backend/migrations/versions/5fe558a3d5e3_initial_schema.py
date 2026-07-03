"""initial schema

Revision ID: 5fe558a3d5e3
Revises: 
Create Date: 2026-07-03 08:26:26.143519

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5fe558a3d5e3'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create all tables."""
    # ── Users ──
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('email_verified', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('role', sa.String(20), nullable=False, server_default=sa.text("'user'")),
        sa.Column('display_name', sa.String(100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email'),
    )
    op.create_index('ix_users_email', 'users', ['email'])

    # ── Food items ──
    op.create_table(
        'food_item',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name_id', sa.String(255), nullable=False),
        sa.Column('name_en', sa.String(255), nullable=True),
        sa.Column('category', sa.String(100), nullable=True),
        sa.Column('prep_type', sa.String(20), nullable=True),
        sa.Column('calories', sa.Float(), nullable=True),
        sa.Column('protein_g', sa.Float(), nullable=True),
        sa.Column('carbs_g', sa.Float(), nullable=True),
        sa.Column('fat_g', sa.Float(), nullable=True),
        sa.Column('fiber_g', sa.Float(), nullable=True),
        sa.Column('micros_json', sa.Text(), nullable=True),
        sa.Column('price_pasar_min', sa.Integer(), nullable=True),
        sa.Column('price_pasar_max', sa.Integer(), nullable=True),
        sa.Column('price_market_min', sa.Integer(), nullable=True),
        sa.Column('price_market_max', sa.Integer(), nullable=True),
        sa.Column('price_warung_min', sa.Integer(), nullable=True),
        sa.Column('price_warung_max', sa.Integer(), nullable=True),
        sa.Column('tags_json', sa.Text(), nullable=True),
        sa.Column('cuisine_tags_json', sa.Text(), nullable=True),
        sa.Column('image_path', sa.String(255), nullable=True),
        sa.Column('source_url', sa.Text(), nullable=True),
        sa.Column('verification_status', sa.String(20), nullable=False, server_default=sa.text("'unverified'")),
        sa.Column('verified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('active', sa.Boolean(), nullable=False, server_default=sa.text('0')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_food_item_name_id', 'food_item', ['name_id'])
    op.create_index('ix_food_item_active', 'food_item', ['active'])

    # ── Province ──
    op.create_table(
        'province',
        sa.Column('code', sa.String(50), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('island_group', sa.String(50), nullable=True),
        sa.Column('price_multiplier', sa.Float(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('code'),
    )

    # ── Price tier override ──
    op.create_table(
        'price_tier_override',
        sa.Column('code', sa.String(50), nullable=False),
        sa.Column('label', sa.String(100), nullable=False),
        sa.Column('price_multiplier', sa.Float(), nullable=False),
        sa.Column('member_provinces', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('code'),
    )

    # ── City ──
    op.create_table(
        'city',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('province_code', sa.String(50), nullable=False),
        sa.Column('province_name', sa.String(100), nullable=True),
        sa.Column('is_jabodetabek', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('price_tier', sa.String(50), nullable=False),
        sa.Column('latitude', sa.Float(), nullable=True),
        sa.Column('longitude', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_city_name', 'city', ['name'])

    # ── Meal history ──
    op.create_table(
        'meal_history',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('food_item_id', sa.Integer(), nullable=False),
        sa.Column('served_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('slot', sa.String(20), nullable=False),
        sa.Column('condition', sa.String(50), nullable=True),
        sa.Column('sex', sa.String(10), nullable=True),
        sa.Column('city_id', sa.Integer(), nullable=True),
        sa.Column('plan_id', sa.String(50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['food_item_id'], ['food_item.id'], ),
        sa.ForeignKeyConstraint(['city_id'], ['city.id'], ),
    )
    op.create_index('ix_meal_history_user_id', 'meal_history', ['user_id'])

    # ── Meal feedback ──
    op.create_table(
        'meal_feedback',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('food_item_id', sa.Integer(), nullable=False),
        sa.Column('plan_id', sa.String(50), nullable=True),
        sa.Column('rating', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['food_item_id'], ['food_item.id'], ),
    )
    op.create_index('ix_meal_feedback_user_id', 'meal_feedback', ['user_id'])

    # ── User preference ──
    op.create_table(
        'user_pref',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('default_condition', sa.String(50), nullable=True),
        sa.Column('default_sex', sa.String(10), nullable=True),
        sa.Column('default_city_id', sa.Integer(), nullable=True),
        sa.Column('daily_budget_idr', sa.Integer(), nullable=True),
        sa.Column('per_meal_budget_idr', sa.Integer(), nullable=True),
        sa.Column('variety_appetite', sa.Float(), nullable=True),
        sa.Column('prep_lean', sa.String(20), nullable=True),
        sa.Column('exclusions_json', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.UniqueConstraint('user_id'),
        sa.ForeignKeyConstraint(['default_city_id'], ['city.id'], ),
    )

    # ── User taste ──
    op.create_table(
        'user_taste',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('kind', sa.String(20), nullable=False),
        sa.Column('value', sa.String(100), nullable=False),
        sa.Column('weight', sa.Float(), nullable=False, server_default=sa.text('1.0')),
        sa.Column('source', sa.String(20), nullable=False, server_default=sa.text("'onboarding'")),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    )
    op.create_index('ix_user_taste_user_id', 'user_taste', ['user_id'])

    # ── Crawl source ──
    op.create_table(
        'crawl_source',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('domain', sa.String(255), nullable=False),
        sa.Column('allowed', sa.Boolean(), nullable=False, server_default=sa.text('0')),
        sa.Column('robots_ok', sa.Boolean(), nullable=False, server_default=sa.text('0')),
        sa.Column('last_crawled_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('domain'),
    )

    # ── Crawl record ──
    op.create_table(
        'crawl_record',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('crawl_source_id', sa.Integer(), nullable=False),
        sa.Column('url', sa.Text(), nullable=False),
        sa.Column('fetched_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('raw_hash', sa.String(64), nullable=True),
        sa.Column('parsed_json', sa.Text(), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default=sa.text("'fetched'")),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
    )

    # ── Rate limit bucket ──
    op.create_table(
        'rate_limit_bucket',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('day', sa.Date(), nullable=False),
        sa.Column('plan_count', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('chat_count', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    )
    op.create_index('ix_rate_limit_bucket_user_id', 'rate_limit_bucket', ['user_id'])


def downgrade() -> None:
    """Drop all tables."""
    op.drop_table('rate_limit_bucket')
    op.drop_table('crawl_record')
    op.drop_table('crawl_source')
    op.drop_table('user_taste')
    op.drop_table('user_pref')
    op.drop_table('meal_feedback')
    op.drop_table('meal_history')
    op.drop_table('city')
    op.drop_table('price_tier_override')
    op.drop_table('province')
    op.drop_table('food_item')
    op.drop_table('users')