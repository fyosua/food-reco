"""Food item model — the core dataset entity."""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin


class FoodItem(TimestampMixin, Base):
    __tablename__ = "food_item"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    name_en: Mapped[str | None] = mapped_column(String(255), nullable=True)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    prep_type: Mapped[str | None] = mapped_column(String(20), nullable=True)  # buy_ready | simple_cook

    # Nutrition
    calories: Mapped[float | None] = mapped_column(Float, nullable=True)
    protein_g: Mapped[float | None] = mapped_column(Float, nullable=True)
    carbs_g: Mapped[float | None] = mapped_column(Float, nullable=True)
    fat_g: Mapped[float | None] = mapped_column(Float, nullable=True)
    fiber_g: Mapped[float | None] = mapped_column(Float, nullable=True)
    micros_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Price — national base (IDR)
    price_pasar_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    price_pasar_max: Mapped[int | None] = mapped_column(Integer, nullable=True)
    price_market_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    price_market_max: Mapped[int | None] = mapped_column(Integer, nullable=True)
    price_warung_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    price_warung_max: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Tags
    tags_json: Mapped[str | None] = mapped_column(Text, nullable=True)  # e.g. ["high_protein","raw","peanut"]
    cuisine_tags_json: Mapped[str | None] = mapped_column(Text, nullable=True)  # e.g. ["padang","sunda"]

    # Provenance
    image_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    verification_status: Mapped[str] = mapped_column(
        String(20), default="unverified"
    )  # unverified | auto_verified | human_verified | rejected
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=False, index=True)