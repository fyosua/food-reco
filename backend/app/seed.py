"""Seed initial data — provinces, price_tier_overrides, sample cities and food."""

import csv
import os
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session_factory
from app.core.security import hash_password
from app.models.city import City, PriceTierOverride, Province
from app.models.food import FoodItem
from app.models.user import User
from app.core.config import settings

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
FALLBACK_DATA_DIR = Path("/app/seed_data")

def _get_data_path(filename: str) -> Path | None:
    """Look for data file in primary dir, then fallback (for Docker volume)."""
    for base in [DATA_DIR, FALLBACK_DATA_DIR]:
        path = base / filename
        if path.exists():
            return path
    return None


async def seed_provinces(db: AsyncSession) -> None:
    """Seed the 38 provinces with price multipliers."""
    result = await db.execute(select(Province).limit(1))
    if result.scalar_one_or_none():
        return  # Already seeded

    path = _get_data_path("provinces.csv")
    if not path:
        print("⚠️  provinces.csv not found, skipping province seed")
        return

    with open(path) as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        for row in rows:
            province = Province(
                code=row["code"],
                name=row["name"],
                island_group=row.get("island_group"),
                price_multiplier=float(row["price_multiplier"]),
            )
            db.add(province)
    await db.flush()
    print(f"✅ Seeded {len(rows)} provinces")


async def seed_price_tier_overrides(db: AsyncSession) -> None:
    """Seed price tier overrides (e.g., Jabodetabek)."""
    result = await db.execute(select(PriceTierOverride).limit(1))
    if result.scalar_one_or_none():
        return

    path = _get_data_path("price_tier_overrides.csv")
    if not path:
        print("⚠️  price_tier_overrides.csv not found, skipping")
        return

    with open(path) as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        for row in rows:
            override = PriceTierOverride(
                code=row["code"],
                label=row["label"],
                price_multiplier=float(row["price_multiplier"]),
                member_provinces=row.get("member_provinces"),
            )
            db.add(override)
    await db.flush()
    print(f"✅ Seeded {len(rows)} price tier overrides")


async def seed_cities(db: AsyncSession) -> None:
    """Seed sample cities."""
    result = await db.execute(select(City).limit(1))
    if result.scalar_one_or_none():
        return

    path = _get_data_path("cities.sample.csv")
    if not path:
        print("⚠️  cities.sample.csv not found, skipping city seed")
        return

    with open(path) as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        for row in rows:
            city = City(
                name=row["name"],
                province_code=row["province_code"],
                province_name=row.get("province_name"),
                is_jabodetabek=int(row.get("is_jabodetabek", 0)),
                price_tier=row["price_tier"],
                latitude=float(row["latitude"]) if row.get("latitude") else None,
                longitude=float(row["longitude"]) if row.get("longitude") else None,
            )
            db.add(city)
    await db.flush()
    print(f"✅ Seeded {len(rows)} cities")


async def seed_food(db: AsyncSession) -> None:
    """Seed sample food items."""
    result = await db.execute(select(FoodItem).limit(1))
    if result.scalar_one_or_none():
        return

    path = _get_data_path("food_seed.sample.csv")
    if not path:
        print("⚠️  food_seed.sample.csv not found, skipping food seed")
        return

    import json

    with open(path) as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        for row in rows:
            item = FoodItem(
                name_id=row["name_id"],
                name_en=row.get("name_en"),
                category=row.get("category"),
                prep_type=row.get("prep_type"),
                calories=float(row["calories"]) if row.get("calories") else None,
                protein_g=float(row["protein_g"]) if row.get("protein_g") else None,
                carbs_g=float(row["carbs_g"]) if row.get("carbs_g") else None,
                fat_g=float(row["fat_g"]) if row.get("fat_g") else None,
                fiber_g=float(row["fiber_g"]) if row.get("fiber_g") else None,
                price_pasar_min=int(row["price_pasar_min"]) if row.get("price_pasar_min") else None,
                price_pasar_max=int(row["price_pasar_max"]) if row.get("price_pasar_max") else None,
                tags_json=row.get("tags_json"),
                cuisine_tags_json=row.get("cuisine_tags_json"),
                verification_status=row.get("verification_status", "unverified"),
                active=bool(int(row.get("active", 0))),
            )
            db.add(item)
    await db.flush()
    print(f"✅ Seeded {len(rows)} food items")


async def seed_admin(db: AsyncSession) -> None:
    """Seed admin user from env vars ADMIN_EMAIL and ADMIN_PASSWORD."""
    admin_email = settings.admin_email
    admin_password = settings.admin_password
    if not admin_email or not admin_password:
        print("⚠️  ADMIN_EMAIL or ADMIN_PASSWORD not set, skipping admin seed")
        return

    result = await db.execute(select(User).where(User.email == admin_email))
    if result.scalar_one_or_none():
        print(f"ℹ️  Admin user {admin_email} already exists, skipping")
        return

    user = User(
        email=admin_email,
        password_hash=hash_password(admin_password),
        role="admin",
        email_verified=True,
    )
    db.add(user)
    await db.flush()
    print(f"✅ Admin user created: {admin_email}")


async def main():
    """Run all seeders."""
    async with async_session_factory() as db:
        await seed_provinces(db)
        await seed_price_tier_overrides(db)
        await seed_cities(db)
        await seed_food(db)
        await seed_admin(db)
        await db.commit()
    print("🎉 Seeding complete!")


if __name__ == "__main__":
    import asyncio

    asyncio.run(main())