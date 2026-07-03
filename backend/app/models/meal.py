"""Meal history and feedback models."""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin


class MealHistory(TimestampMixin, Base):
    """Log of every served meal for non-repetition and history."""

    __tablename__ = "meal_history"

    __table_args__ = (
        # Composite indexes for common queries
        __import__("sqlalchemy").Index("ix_meal_history_user_served", "user_id", "served_at"),
        __import__("sqlalchemy").Index("ix_meal_history_user_plan", "user_id", "plan_id"),
        __import__("sqlalchemy").Index("ix_meal_history_user_cond", "user_id", "condition", "sex", "city_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    food_item_id: Mapped[int] = mapped_column(ForeignKey("food_item.id"), nullable=False)
    served_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    slot: Mapped[str] = mapped_column(String(20), nullable=False)  # breakfast | lunch | dinner | snack
    condition: Mapped[str | None] = mapped_column(String(100), nullable=True)
    sex: Mapped[str | None] = mapped_column(String(10), nullable=True)
    city_id: Mapped[int | None] = mapped_column(ForeignKey("city.id"), nullable=True)
    plan_id: Mapped[str | None] = mapped_column(String(50), nullable=True)


class MealFeedback(TimestampMixin, Base):
    """User 👍/👎 feedback on served meals for implicit learning."""

    __tablename__ = "meal_feedback"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    food_item_id: Mapped[int] = mapped_column(ForeignKey("food_item.id"), nullable=False)
    plan_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)  # +1 (like) or -1 (dislike)