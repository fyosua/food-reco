"""City search / type-ahead and meal history endpoints."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.routes import get_current_user
from app.core.database import get_db
from app.models.city import City
from app.models.food import FoodItem
from app.models.meal import MealHistory
from app.models.user import User

router = APIRouter(tags=["data"])


@router.get("/api/cities")
async def search_cities(
    q: str = Query("", min_length=0, max_length=100),
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """Type-ahead city search by name."""
    stmt = select(City).order_by(City.name)

    if q:
        stmt = stmt.where(City.name.ilike(f"%{q}%"))

    stmt = stmt.limit(limit)
    result = await db.execute(stmt)
    cities = result.scalars().all()

    return [
        {
            "id": c.id,
            "name": c.name,
            "province_code": c.province_code,
            "province_name": c.province_name,
            "is_jabodetabek": bool(c.is_jabodetabek),
            "price_tier": c.price_tier,
        }
        for c in cities
    ]


@router.get("/api/history")
async def get_meal_history(
    limit: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return recent served meals for the authenticated user with food details."""
    stmt = (
        select(MealHistory)
        .where(MealHistory.user_id == user.id)
        .order_by(MealHistory.served_at.desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    meals = result.scalars().all()

    # Fetch food item details for each meal
    food_ids = {m.food_item_id for m in meals}
    if food_ids:
        food_result = await db.execute(
            select(FoodItem).where(FoodItem.id.in_(food_ids))
        )
        food_map = {f.id: f for f in food_result.scalars().all()}
    else:
        food_map = {}

    return [
        {
            "id": m.id,
            "food_item_id": m.food_item_id,
            "food_name": food_map[m.food_item_id].name_id if m.food_item_id in food_map else None,
            "food_category": food_map[m.food_item_id].category if m.food_item_id in food_map else None,
            "calories": food_map[m.food_item_id].calories if m.food_item_id in food_map else None,
            "served_at": m.served_at.isoformat(),
            "slot": m.slot,
            "condition": m.condition,
            "plan_id": m.plan_id,
        }
        for m in meals
    ]