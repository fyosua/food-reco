"""City, Province, and PriceTierOverride models."""

from sqlalchemy import Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin


class Province(TimestampMixin, Base):
    """All 38 official Indonesian provinces with price multipliers."""

    __tablename__ = "province"

    code: Mapped[str] = mapped_column(String(50), primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    island_group: Mapped[str | None] = mapped_column(String(50), nullable=True)
    price_multiplier: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)


class PriceTierOverride(TimestampMixin, Base):
    """Special cross-province economic zones (e.g., Jabodetabek)."""

    __tablename__ = "price_tier_override"

    code: Mapped[str] = mapped_column(String(50), primary_key=True)
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    price_multiplier: Mapped[float] = mapped_column(Float, nullable=False)
    member_provinces: Mapped[str | None] = mapped_column(Text, nullable=True)  # note only


class City(TimestampMixin, Base):
    """Indonesian city with resolved price tier."""

    __tablename__ = "city"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    province_code: Mapped[str] = mapped_column(String(50), nullable=False)
    province_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_jabodetabek: Mapped[bool] = mapped_column(Integer, default=0)
    price_tier: Mapped[str] = mapped_column(String(50), nullable=False)  # province.code or 'jabodetabek'
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)