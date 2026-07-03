"""Crawl source config and crawl record audit trail."""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin


class CrawlSource(TimestampMixin, Base):
    """Crawler config and provenance tracking."""

    __tablename__ = "crawl_source"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    domain: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    allowed: Mapped[bool] = mapped_column(Boolean, default=False)
    robots_ok: Mapped[bool] = mapped_column(Boolean, default=False)
    last_crawled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class CrawlRecord(TimestampMixin, Base):
    """Raw crawl audit trail — every fetch is logged."""

    __tablename__ = "crawl_record"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    crawl_source_id: Mapped[int] = mapped_column(Integer, nullable=False)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    raw_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    parsed_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="fetched")  # fetched | parsed | verified | rejected