"""Preference scorer — deterministic weighted ranking of food items.

Implements the Stage 2 scoring function from §3.3 of the PRD.

For each candidate food item `f` and user `u`:

    score(f, u) =
        w_like    * likes_match(f, u)
      - w_soft    * soft_dislike_match(f, u)
      + w_cuisine * cuisine_affinity(f, u)
      + w_spice   * spice_fit(f, u)
      + w_prep    * prep_fit(f, u)
      + w_nutri   * nutrition_fit(f, condition)
      - w_repeat  * recency_penalty(f, u)
      - w_budget  * budget_pressure(f, u)
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import TYPE_CHECKING

from app.reco.rules import RuleResult, MacroTarget
from app.reco.weights import DEFAULT_WEIGHTS, ScoringWeights

if TYPE_CHECKING:
    from app.models.food import FoodItem
    from app.models.prefs import UserPref, UserTaste
    from app.models.meal import MealHistory


def parse_json_list(value: str | None) -> list[str]:
    """Parse a JSON string list, returning empty list on failure."""
    if not value:
        return []
    try:
        parsed = json.loads(value)
        if isinstance(parsed, list):
            return parsed
        return []
    except (json.JSONDecodeError, TypeError):
        return []


def compute_score(
    food: FoodItem,
    prefs: UserPref | None,
    tastes: list[UserTaste],
    rule: RuleResult,
    recent_meal_ids: set[int],
    weights: ScoringWeights = DEFAULT_WEIGHTS,
) -> float:
    """Compute the preference score for a food item for a user.

    Args:
        food: The food item to score.
        prefs: The user's preference settings (budget, prep_lean, etc.).
        tastes: The user's taste profile rows (likes, dislikes, cuisines, spice).
        rule: The rule result for this user's condition + sex.
        recent_meal_ids: Set of food_item_ids served in the recent window.
        weights: Scoring weights (defaults from weights.py).

    Returns:
        Float score. Higher = better match.
    """
    score = 0.0

    # Parse tags
    food_tags = set(parse_json_list(food.tags_json))
    food_cuisine_tags = set(parse_json_list(food.cuisine_tags_json))

    # Decompose tastes into categories
    liked_ingredients: set[str] = set()
    soft_dislikes: set[str] = set()
    liked_cuisines: set[str] = set()
    spice_tolerance: float | None = None
    learned_bonus: dict[str, float] = {}

    for t in tastes:
        val = t.value.lower().strip()
        if t.kind == "like":
            liked_ingredients.add(val)
            if t.source == "feedback" and t.weight > 0:
                learned_bonus[val] = t.weight
        elif t.kind == "soft_dislike":
            soft_dislikes.add(val)
        elif t.kind == "cuisine":
            liked_cuisines.add(val)
        elif t.kind == "spice":
            try:
                spice_tolerance = float(t.value)
            except (ValueError, TypeError):
                spice_tolerance = 3.0
        elif t.kind == "learned":
            learned_bonus[val] = t.weight

    # ── w_like: liked ingredient/cuisine/protein hits ──
    likes_match = 0.0
    for liked in liked_ingredients:
        if liked in food_tags or liked in food_cuisine_tags:
            likes_match += 1.0
            # Extra bonus from learned feedback
            if liked in learned_bonus:
                likes_match += learned_bonus[liked] * 0.5
    score += weights.w_like * likes_match

    # ── w_soft: soft-dislike penalties ──
    soft_match = 0.0
    for disliked in soft_dislikes:
        if disliked in food_tags or disliked in food_cuisine_tags:
            soft_match += 1.0
    score -= weights.w_soft * soft_match

    # ── w_cuisine: preferred-cuisine bonus ──
    cuisine_match = 0.0
    for cuisine in liked_cuisines:
        if cuisine in food_cuisine_tags:
            cuisine_match += 1.0
    score += weights.w_cuisine * cuisine_match

    # ── w_spice: spice tolerance fit ──
    food_spice = 3.0  # Default medium spice
    if "spicy" in food_tags:
        food_spice = 4.0
    if "mild" in food_tags:
        food_spice = 1.0

    if spice_tolerance is not None:
        spice_gap = abs(spice_tolerance - food_spice)
        if spice_gap == 0:
            score += weights.spice_perfect_match_bonus
        else:
            # Penalty proportional to gap, max at spice_max_penalty
            penalty = min(spice_gap / 5.0 * weights.spice_max_penalty, weights.spice_max_penalty)
            score -= penalty
    else:
        # No spice preference, neutral
        pass

    # ── w_prep: prep preference match ──
    if prefs and prefs.prep_lean:
        prep_lean = prefs.prep_lean.lower()
        if prep_lean == "balanced":
            score += weights.w_prep * 0.5  # Neutral
        elif prep_lean == food.prep_type:
            score += weights.w_prep * 1.0  # Perfect match
        elif food.prep_type:
            score -= weights.w_prep * 0.5  # Mismatch

    # ── w_nutri: nutrition fit ──
    if food.calories and rule.macro_target.calories:
        # How close is this item's caloric density to a balanced meal?
        # A single meal should be ~25-35% of daily target
        meal_target = rule.macro_target.calories * 0.3
        cal_ratio = food.calories / meal_target if meal_target > 0 else 1.0
        if 0.7 <= cal_ratio <= 1.3:
            score += weights.w_nutri * 1.0  # Good portion fit
        elif 0.4 <= cal_ratio <= 1.6:
            score += weights.w_nutri * 0.5  # Acceptable
        # else: no bonus (still acceptable, just not ideal)

    # ── w_repeat: recency penalty (scaled by variety_appetite) ──
    if food.id in recent_meal_ids:
        repeat_penalty = weights.w_repeat
        # Scale by variety appetite (0..1). Higher appetite = bigger penalty.
        if prefs and prefs.variety_appetite is not None:
            repeat_penalty *= prefs.variety_appetite
        score -= repeat_penalty  # Big penalty for recent items

    # ── w_budget: budget pressure ──
    if prefs and prefs.per_meal_budget_idr and food.price_pasar_max:
        if food.price_pasar_max > prefs.per_meal_budget_idr:
            score -= weights.w_budget * 2.0  # Over per-meal budget
        elif food.price_pasar_max > prefs.per_meal_budget_idr * 0.8:
            score -= weights.w_budget * 0.5  # Near per-meal budget

    return score


def get_recent_meal_ids(
    meal_history: list[MealHistory],
    window_days: int = 7,
) -> set[int]:
    """Get the set of food_item_ids served in the recent window.

    Args:
        meal_history: List of MealHistory rows for the user.
        window_days: How many days back to consider.

    Returns:
        Set of food_item_ids that were served recently.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=window_days)
    return {
        m.food_item_id
        for m in meal_history
        if m.served_at and m.served_at >= cutoff
    }


def score_and_rank(
    candidates: list[FoodItem],
    prefs: UserPref | None,
    tastes: list[UserTaste],
    rule: RuleResult,
    recent_meal_ids: set[int],
    weights: ScoringWeights = DEFAULT_WEIGHTS,
    top_n: int = 10,
) -> list[tuple[FoodItem, float]]:
    """Score all candidates and return the top-N ranked.

    Args:
        candidates: List of candidate food items (already through Stage 1 hard gates).
        prefs: User preference settings.
        tastes: User taste profile rows.
        rule: Rule result with macro targets.
        recent_meal_ids: IDs of recently served meals.
        weights: Scoring weights.
        top_n: Max number of items to return per slot.

    Returns:
        List of (food_item, score) tuples, sorted by score descending, top-N.
    """
    scored = []
    for food in candidates:
        s = compute_score(food, prefs, tastes, rule, recent_meal_ids, weights)
        scored.append((food, s))

    # Sort by score descending
    scored.sort(key=lambda x: x[1], reverse=True)
    return scored[:top_n]