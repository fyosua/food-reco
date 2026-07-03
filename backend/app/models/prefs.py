"""User preference and taste profile models."""

from sqlalchemy import Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin


class UserPref(TimestampMixin, Base):
    """Per-user aggregated preference settings (one row per user)."""

    __tablename__ = "user_pref"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, nullable=False)

    # Defaults for plan generation
    default_condition: Mapped[str | None] = mapped_column(String(50), nullable=True)
    default_sex: Mapped[str | None] = mapped_column(String(10), nullable=True)
    default_city_id: Mapped[int | None] = mapped_column(ForeignKey("city.id"), nullable=True)

    # Budget
    daily_budget_idr: Mapped[int | None] = mapped_column(Integer, nullable=True)
    per_meal_budget_idr: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Taste
    variety_appetite: Mapped[float | None] = mapped_column(Float, nullable=True)  # 0..1
    prep_lean: Mapped[str | None] = mapped_column(String(20), nullable=True)  # buy_ready | simple_cook | balanced
    exclusions_json: Mapped[str | None] = mapped_column(Text, nullable=True)  # hard allergen/dislike list


class UserTaste(TimestampMixin, Base):
    """Rich preference — multi-row per user for fine-grained taste."""

    __tablename__ = "user_taste"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    kind: Mapped[str] = mapped_column(String(20), nullable=False)  # like | soft_dislike | cuisine | spice | learned
    value: Mapped[str] = mapped_column(String(100), nullable=False)  # ingredient/cuisine/tag
    weight: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)  # signed magnitude
    source: Mapped[str] = mapped_column(String(20), default="onboarding")  # onboarding | feedback