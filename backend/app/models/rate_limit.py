"""Per-user daily rate limit bucket."""

from datetime import date

from sqlalchemy import Date, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin


class RateLimitBucket(TimestampMixin, Base):
    """Per-user daily request accounting."""

    __tablename__ = "rate_limit_bucket"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    day: Mapped[date] = mapped_column(Date, nullable=False)
    plan_count: Mapped[int] = mapped_column(Integer, default=0)
    chat_count: Mapped[int] = mapped_column(Integer, default=0)