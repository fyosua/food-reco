"""Feedback API endpoint — 👍/👎 on served meals with implicit learning."""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.routes import get_current_user
from app.core.database import get_db
from app.models.meal import MealFeedback
from app.models.user import User
from app.reco.learning import process_feedback

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
    """Submit 👍 (+1) or 👎 (-1) feedback on a served meal.

    In addition to recording the feedback event, this endpoint:
    - Updates the user's taste profile (implicit learning)
    - 👍 → reinforces liking for the food item's ingredients/cuisine
    - 👎 → adds soft dislike for the food item's ingredients
    """
    # Record feedback event
    feedback = MealFeedback(
        user_id=user.id,
        food_item_id=body.food_item_id,
        plan_id=body.plan_id,
        rating=body.rating,
    )
    db.add(feedback)
    await db.flush()

    # Process implicit learning
    learning_result = await process_feedback(
        db=db,
        user_id=user.id,
        food_item_id=body.food_item_id,
        rating=body.rating,
    )

    await db.commit()

    return {
        "message": "Feedback recorded",
        "id": feedback.id,
        "rating": feedback.rating,
        "learning": learning_result,
    }