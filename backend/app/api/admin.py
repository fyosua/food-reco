"""Admin API endpoints — dataset browse, verify/reject."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.routes import get_current_user
from app.core.database import get_db
from app.models.food import FoodItem
from app.models.user import User

router = APIRouter(prefix="/api/admin", tags=["admin"])


class VerifyAction(BaseModel):
    status: str  # human_verified | rejected


@router.get("/foods")
async def browse_foods(
    status_filter: str | None = Query(None, alias="status"),
    active_filter: bool | None = Query(None, alias="active"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Browse the food dataset (admin only)."""
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    stmt = select(FoodItem).order_by(FoodItem.id)

    if status_filter:
        stmt = stmt.where(FoodItem.verification_status == status_filter)
    if active_filter is not None:
        stmt = stmt.where(FoodItem.active == active_filter)

    stmt = stmt.offset(offset).limit(limit)
    result = await db.execute(stmt)
    items = result.scalars().all()

    return [
        {
            "id": item.id,
            "name_id": item.name_id,
            "category": item.category,
            "verification_status": item.verification_status,
            "active": bool(item.active),
            "source_url": item.source_url,
            "has_image": item.image_path is not None,
        }
        for item in items
    ]


@router.post("/verify/{item_id}")
async def verify_food(
    item_id: int,
    body: VerifyAction,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Promote or reject a crawled food item (admin only)."""
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    result = await db.execute(select(FoodItem).where(FoodItem.id == item_id))
    item = result.scalar_one_or_none()

    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Food item not found")

    if body.status not in ("human_verified", "rejected"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Status must be 'human_verified' or 'rejected'")

    item.verification_status = body.status
    item.verified_at = datetime.now(timezone.utc)
    item.active = body.status == "human_verified"
    await db.flush()

    return {
        "message": f"Item {item_id} set to {body.status}",
        "id": item.id,
        "active": bool(item.active),
    }