"""Feedback API endpoint — 👍/👎 on served meals."""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.routes import get_current_user
from app.core.database import get_db
from app.models.meal import MealFeedback
from app.models.user import User

router = APIRouter(prefix="/api", tags=["feedback"])


class FeedbackRequest(BaseModel):
    food_item_id: int
    plan_id: str | None = None
    rating: int = Field(..., ge=-1, le=1)  # +1 = like, -1 = dislike


@router.post("/feedback")
async def submit_feedback(
    body: FeedbackRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit 👍 (+1) or 👎 (-1) feedback on a served meal."""
    feedback = MealFeedback(
        user_id=user.id,
        food_item_id=body.food_item_id,
        plan_id=body.plan_id,
        rating=body.rating,
    )
    db.add(feedback)
    await db.flush()

    return {"message": "Feedback recorded", "id": feedback.id, "rating": feedback.rating}