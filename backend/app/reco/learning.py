"""Implicit learning engine — learns user preferences from feedback.

When a user rates a meal 👍 or 👎, this module:
1. Identifies the food item's tags and cuisine tags
2. For 👍 (+1): adds/reinforces a 'learned' like entry in user_taste
3. For 👎 (-1): adds a 'learned' soft-dislike entry in user_taste
4. Decays old learned signals to keep the system responsive

The learned signals are additive to explicit onboarding preferences.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import select, delete

from app.models.food import FoodItem
from app.models.prefs import UserTaste

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


# ── Learning parameters ──

LEARNED_WEIGHT_INCREMENT = 0.5  # How much each 👍 adds to weight
LEARNED_WEIGHT_DECAY = 0.1      # How much each 👍 decays over time
MAX_LEARNED_WEIGHT = 3.0        # Cap on learned weight
MAX_LEARNED_ENTRIES = 50        # Max learned entries per user
LEARNED_DISLIKE_WEIGHT = 1.0    # Weight for a 👎 learned dislike


def parse_tags(tags_json: str | None) -> list[str]:
    """Parse a JSON tag list, returning empty list on failure."""
    if not tags_json:
        return []
    try:
        parsed = json.loads(tags_json)
        if isinstance(parsed, list):
            return [str(t).lower().strip() for t in parsed]
        return []
    except (json.JSONDecodeError, TypeError):
        return []


async def process_feedback(
    db: AsyncSession,
    user_id: int,
    food_item_id: int,
    rating: int,
) -> dict:
    """Process user feedback and update learned preferences.

    Args:
        db: Database session.
        user_id: The user who gave feedback.
        food_item_id: The food item that was rated.
        rating: +1 for like, -1 for dislike.

    Returns:
        Dict with summary of what was learned.
    """
    # Load the food item to get its tags
    result = await db.execute(
        select(FoodItem).where(FoodItem.id == food_item_id)
    )
    food = result.scalar_one_or_none()
    if not food:
        return {"error": "Food item not found"}

    tags = parse_tags(food.tags_json)
    cuisine_tags = parse_tags(food.cuisine_tags_json)
    actions = []

    if rating == 1:
        # 👍 — reinforce likes
        for tag in tags:
            if tag in ("fried", "grilled", "stir_fry", "soup", "raw", "buy_ready"):
                continue  # Skip prep/style tags — not meaningful preferences
            action = await _reinforce_like(db, user_id, tag, source="feedback")
            if action:
                actions.append(action)

        for cuisine in cuisine_tags:
            action = await _reinforce_cuisine(db, user_id, cuisine, source="feedback")
            if action:
                actions.append(action)

        # Also reinforce the food item's name as a learned preference
        if food.name_id:
            action = await _reinforce_like(db, user_id, food.name_id.lower(), source="feedback")
            if action:
                actions.append(action)

    elif rating == -1:
        # 👎 — add soft dislike
        for tag in tags:
            if tag in ("fried", "grilled", "stir_fry", "soup", "raw"):
                continue
            action = await _add_soft_dislike(db, user_id, tag, source="feedback")
            if action:
                actions.append(action)

        if food.name_id:
            action = await _add_soft_dislike(db, user_id, food.name_id.lower(), source="feedback")
            if action:
                actions.append(action)

    # Enforce max learned entries
    await _enforce_max_learned(db, user_id)

    await db.flush()
    return {
        "actions": actions,
        "food_item_id": food_item_id,
        "rating": rating,
    }


async def _reinforce_like(
    db: AsyncSession,
    user_id: int,
    value: str,
    source: str = "feedback",
) -> dict | None:
    """Reinforce a liked ingredient/tag in user_taste.

    If an existing 'learned' entry exists, increment its weight.
    Otherwise, if an onboarding 'like' entry exists, add a learned bonus.
    Otherwise, create a new 'learned' entry.
    """
    # Check for existing learned entry
    result = await db.execute(
        select(UserTaste).where(
            UserTaste.user_id == user_id,
            UserTaste.kind == "learned",
            UserTaste.value == value,
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        # Increment weight
        existing.weight = min(
            existing.weight + LEARNED_WEIGHT_INCREMENT,
            MAX_LEARNED_WEIGHT,
        )
        existing.source = source
        return {"action": "reinforced", "value": value, "new_weight": existing.weight}

    # Check for onboarding like
    result = await db.execute(
        select(UserTaste).where(
            UserTaste.user_id == user_id,
            UserTaste.kind == "like",
            UserTaste.value == value,
        )
    )
    onboarding = result.scalar_one_or_none()

    if onboarding:
        # Add a learned bonus that stacks with the onboarding like
        entry = UserTaste(
            user_id=user_id,
            kind="learned",
            value=value,
            weight=LEARNED_WEIGHT_INCREMENT,
            source=source,
        )
        db.add(entry)
        return {"action": "bonus_added", "value": value, "weight": LEARNED_WEIGHT_INCREMENT}

    # Create new learned entry
    entry = UserTaste(
        user_id=user_id,
        kind="learned",
        value=value,
        weight=LEARNED_WEIGHT_INCREMENT,
        source=source,
    )
    db.add(entry)
    return {"action": "new_like", "value": value, "weight": LEARNED_WEIGHT_INCREMENT}


async def _reinforce_cuisine(
    db: AsyncSession,
    user_id: int,
    value: str,
    source: str = "feedback",
) -> dict | None:
    """Reinforce a liked cuisine, similar to _reinforce_like but for cuisine kind."""
    result = await db.execute(
        select(UserTaste).where(
            UserTaste.user_id == user_id,
            UserTaste.kind == "learned",
            UserTaste.value == value,
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        existing.weight = min(
            existing.weight + LEARNED_WEIGHT_INCREMENT,
            MAX_LEARNED_WEIGHT,
        )
        existing.source = source
        return {"action": "reinforced", "value": value, "new_weight": existing.weight}

    entry = UserTaste(
        user_id=user_id,
        kind="learned",
        value=value,
        weight=LEARNED_WEIGHT_INCREMENT,
        source=source,
    )
    db.add(entry)
    return {"action": "new_cuisine", "value": value, "weight": LEARNED_WEIGHT_INCREMENT}


async def _add_soft_dislike(
    db: AsyncSession,
    user_id: int,
    value: str,
    source: str = "feedback",
) -> dict | None:
    """Add a soft dislike from negative feedback."""
    result = await db.execute(
        select(UserTaste).where(
            UserTaste.user_id == user_id,
            UserTaste.kind == "soft_dislike",
            UserTaste.value == value,
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        if existing.source == "feedback":
            existing.weight = min(existing.weight + 0.3, 2.0)
        return {"action": "reinforced_dislike", "value": value, "new_weight": existing.weight}

    # Only add if not already a liked item
    result = await db.execute(
        select(UserTaste).where(
            UserTaste.user_id == user_id,
            UserTaste.kind.in_(["like", "learned"]),
            UserTaste.value == value,
        )
    )
    if result.scalar_one_or_none():
        return {"action": "skipped_conflict", "value": value, "reason": "already liked"}

    entry = UserTaste(
        user_id=user_id,
        kind="soft_dislike",
        value=value,
        weight=LEARNED_DISLIKE_WEIGHT,
        source=source,
    )
    db.add(entry)
    return {"action": "new_dislike", "value": value, "weight": LEARNED_DISLIKE_WEIGHT}


async def _enforce_max_learned(db: AsyncSession, user_id: int) -> None:
    """Ensure the user doesn't have too many learned entries."""
    result = await db.execute(
        select(UserTaste).where(
            UserTaste.user_id == user_id,
            UserTaste.kind == "learned",
        ).order_by(UserTaste.weight.asc())
    )
    entries = list(result.scalars().all())

    if len(entries) > MAX_LEARNED_ENTRIES:
        # Remove the lowest-weight entries
        to_remove = len(entries) - MAX_LEARNED_ENTRIES
        for entry in entries[:to_remove]:
            await db.delete(entry)