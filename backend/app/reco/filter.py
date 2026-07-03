"""Candidate filter — the full recommendation pipeline.

Applies Stage 1 hard gates, then Stage 2 preference scoring + ranking,
then returns the top-N candidates per meal slot.

Flow:
  candidate foods (dataset, active=1)
      │
      ▼  STAGE 1 — HARD GATES (deterministic, non-negotiable)
   filter out: allergens, disliked-hard exclusions, condition-forbidden,
   out-of-budget, wrong prep availability
      │
      ▼  STAGE 2 — PREFERENCE SCORING (deterministic weighted rank)
   score each surviving item; sort; take top-N per meal slot
      │
      ▼  Send ranked, safe candidates → LLM for assembly + explanation
"""

from __future__ import annotations

import json
from typing import TYPE_CHECKING

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.food import FoodItem
from app.models.meal import MealHistory
from app.models.prefs import UserPref, UserTaste
from app.reco.rules import RuleResult, get_combined_rule_result
from app.reco.scorer import score_and_rank, get_recent_meal_ids
from app.reco.weights import DEFAULT_WEIGHTS, ScoringWeights

if TYPE_CHECKING:
    from app.models.user import User


def parse_json_tags(tags_json: str | None) -> set[str]:
    """Parse a JSON tag list into a set of lowercase strings."""
    if not tags_json:
        return set()
    try:
        parsed = json.loads(tags_json)
        if isinstance(parsed, list):
            return {str(t).lower().strip() for t in parsed}
        return set()
    except (json.JSONDecodeError, TypeError):
        return set()


async def filter_candidates(
    db: AsyncSession,
    user: User,
    conditions: list[str],
    sex: str,
    age_group: str = "adult",
    weights: ScoringWeights = DEFAULT_WEIGHTS,
    top_n_per_slot: int = 10,
    slots: list[str] | None = None,
) -> dict[str, list[tuple[FoodItem, float]]]:
    """Run the full recommendation pipeline and return ranked candidates per slot.

    Args:
        db: Database session.
        user: The user requesting recommendations.
        conditions: Health conditions (e.g. ['pregnant', 'diabetes'], ['none']).
        sex: 'male' or 'female'.
        age_group: 'adult', 'elderly', or 'teen'.
        weights: Scoring weights configuration.
        top_n_per_slot: Max candidates to return per meal slot.
        slots: Which meal slots to generate for. Default: breakfast, lunch, dinner.

    Returns:
        Dict mapping slot -> list of (food_item, score) tuples, sorted by score.
    """
    if slots is None:
        slots = ["breakfast", "lunch", "dinner"]

    # 1. Get combined rule result (Stage 1 hard gate definitions)
    rule = get_combined_rule_result(conditions, sex, age_group)

    # 2. Load user preferences and tastes
    prefs_result = await db.execute(
        select(UserPref).where(UserPref.user_id == user.id)
    )
    prefs = prefs_result.scalar_one_or_none()

    tastes_result = await db.execute(
        select(UserTaste).where(UserTaste.user_id == user.id)
    )
    tastes = list(tastes_result.scalars().all())

    # 3. Get recent meal IDs for variety/non-repetition
    history_result = await db.execute(
        select(MealHistory).where(MealHistory.user_id == user.id)
    )
    recent_meals = list(history_result.scalars().all())
    recent_meal_ids = get_recent_meal_ids(
        recent_meals,
        window_days=weights.recency_window_days,
    )

    # 4. Load all active food items
    foods_result = await db.execute(
        select(FoodItem).where(FoodItem.active == True)
    )
    all_foods = list(foods_result.scalars().all())

    # 5. STAGE 1 — HARD GATES
    forbidden_tags = set(rule.forbidden_tags)
    hard_exclusions = parse_json_tags(prefs.exclusions_json) if prefs else set()

    candidates = []
    for food in all_foods:
        food_tags = parse_json_tags(food.tags_json)

        # 5a. Check condition-forbidden tags
        if forbidden_tags & food_tags:
            continue  # Excluded by condition

        # 5b. Check hard exclusions (allergens, hard dislikes)
        if hard_exclusions & food_tags:
            continue  # Excluded by user preference

        # 5c. Check budget (per-meal ceiling)
        if prefs and prefs.per_meal_budget_idr and food.price_pasar_max:
            if food.price_pasar_max > prefs.per_meal_budget_idr:
                continue  # Over budget

        # Passed all hard gates
        candidates.append(food)

    # 6. STAGE 2 — PREFERENCE SCORING
    # Score and rank all candidates (variety/non-repetition is handled inside scorer)
    ranked = score_and_rank(
        candidates=candidates,
        prefs=prefs,
        tastes=tastes,
        rule=rule,
        recent_meal_ids=recent_meal_ids,
        weights=weights,
        top_n=top_n_per_slot,
    )

    # 7. Distribute across slots
    result: dict[str, list[tuple[FoodItem, float]]] = {}
    for slot in slots:
        result[slot] = ranked

    return result


async def get_candidate_ids(
    db: AsyncSession,
    user: User,
    conditions: list[str],
    sex: str,
    age_group: str = "adult",
    top_n: int = 10,
) -> list[int]:
    """Get the top-N candidate food item IDs for LLM prompt assembly.

    This is a convenience wrapper that returns just the IDs.
    Used by the LLM prompt builder to reference dataset items.
    """
    ranked = await filter_candidates(
        db=db,
        user=user,
        conditions=conditions,
        sex=sex,
        age_group=age_group,
        top_n_per_slot=top_n,
    )
    # Collect all ranked item IDs across all slots
    ids: set[int] = set()
    for slot_items in ranked.values():
        for food, _score in slot_items:
            ids.add(food.id)
    return list(ids)