"""Plan generation endpoints — /api/plan and /api/chat.

These are the core recommendation endpoints that exercise the full pipeline:
  rules → filter → score → LLM → post-process
"""

from __future__ import annotations

import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.auth.routes import get_current_user
from app.core.database import get_db
from app.llm.client import LLMClient, DayPlan, PlanMeal
from app.models.city import City, Province
from app.models.food import FoodItem
from app.models.meal import MealHistory, MealFeedback
from app.models.prefs import UserPref, UserTaste
from app.models.rate_limit import RateLimitBucket
from app.models.user import User
from app.pricing import resolve_price_multiplier, compute_food_price, compute_budget
from app.reco.filter import filter_candidates, parse_json_tags
from app.reco.rules import get_combined_rule_result, get_available_conditions
from app.reco.weights import DEFAULT_WEIGHTS
from app.core.config import settings

router = APIRouter(tags=["plan"])


# ── Request/Response models ──


class PlanRequest(BaseModel):
    conditions: list[str] = Field(default=["none"], description="Health conditions (list of condition IDs)")
    sex: str = Field(default="male", description="Sex: male or female")
    city_id: int = Field(..., description="City ID for price tier resolution")
    age_group: str = Field(default="adult", description="Age group: adult, elderly, teen")
    daily_budget_idr: int | None = Field(default=None, description="Optional daily budget override")


class ChatRequest(BaseModel):
    plan_id: str = Field(..., description="Plan ID to adjust")
    message: str = Field(..., description="User's adjustment request")
    history: list[dict] | None = Field(default=None, description="Conversation history")


class FeedbackRequest(BaseModel):
    food_item_id: int = Field(..., description="Food item ID to rate")
    plan_id: str | None = Field(default=None, description="Plan ID")
    rating: int = Field(..., ge=-1, le=1, description="Rating: +1 (like) or -1 (dislike)")


class MealResponse(BaseModel):
    slot: str
    name: str
    name_en: str | None = None
    description: str
    ingredients: list[str]
    nutrition: dict[str, float]
    prep_type: str
    dataset_item_ids: list[int]
    price_idr: int = 0
    image_url: str | None = None


class PlanResponse(BaseModel):
    plan_id: str
    meals: list[MealResponse]
    budget: dict
    macro_targets: dict
    notes: str | None = None


class ConditionsResponse(BaseModel):
    conditions: list[dict]


# ── Endpoints ──


@router.get("/api/plan/conditions")
async def list_conditions() -> ConditionsResponse:
    """List all available health conditions with labels."""
    return ConditionsResponse(conditions=get_available_conditions())


@router.post("/api/plan", response_model=PlanResponse)
async def generate_plan(
    request: PlanRequest,
    user: User = Depends(get_current_user),
    db=Depends(get_db),
):
    """Generate a day plan based on user's condition, sex, and city.

    Runs the full pipeline:
      1. Rate limit check
      2. Resolve city → price_tier
      3. Rules layer (condition/sex → targets + forbidden)
      4. Candidate filter (hard gates + preference scoring)
      5. LLM assembly
      6. Budget computation from IDs
      7. Persist meal history
    """
    # ── 1. Rate limit check ──
    today = datetime.now(timezone.utc).date()
    result = await db.execute(
        select(RateLimitBucket).where(
            RateLimitBucket.user_id == user.id,
            RateLimitBucket.day == today,
        )
    )
    bucket = result.scalar_one_or_none()
    if bucket and bucket.plan_count >= settings.daily_plan_limit:
        raise HTTPException(
            status_code=429,
            detail=f"Daily plan limit reached ({settings.daily_plan_limit}). Try again tomorrow.",
        )

    # ── 2. Resolve city → price_tier ──
    city_result = await db.execute(select(City).where(City.id == request.city_id))
    city = city_result.scalar_one_or_none()
    if not city:
        raise HTTPException(status_code=404, detail="City not found")

    # Load province and override data
    province_result = await db.execute(select(Province))
    provinces_map = {p.code: p.price_multiplier for p in province_result.scalars().all()}

    multiplier, price_tier_label = resolve_price_multiplier(
        province_code=city.province_code,
        is_jabodetabek=bool(city.is_jabodetabek),
        provinces=provinces_map,
    )

    # ── 3. Rules layer ──
    rule = get_combined_rule_result(request.conditions, request.sex, request.age_group)
    macro_target = rule.macro_target

    # ── 4. Candidate filter (hard gates + preference scoring) ──
    ranked = await filter_candidates(
        db=db,
        user=user,
        conditions=request.conditions,
        sex=request.sex,
        age_group=request.age_group,
        weights=DEFAULT_WEIGHTS,
        top_n_per_slot=10,
        slots=["breakfast", "lunch", "dinner"],
    )

    # Flatten candidates for LLM prompt
    candidate_dicts: dict[str, list[dict]] = {}
    for slot, items in ranked.items():
        candidate_dicts[slot] = []
        for food, score in items:
            candidate_dicts[slot].append({
                "id": food.id,
                "name_id": food.name_id,
                "name_en": food.name_en,
                "category": food.category,
                "prep_type": food.prep_type,
                "calories": food.calories,
                "protein_g": food.protein_g,
                "carbs_g": food.carbs_g,
                "fat_g": food.fat_g,
                "fiber_g": food.fiber_g,
                "tags": parse_json_tags(food.tags_json),
                "cuisine": parse_json_tags(food.cuisine_tags_json),
                "score": round(score, 2),
            })

    # ── 5. Check if we have enough candidates ──
    total_candidates = sum(len(items) for items in candidate_dicts.values())
    if total_candidates == 0:
        raise HTTPException(
            status_code=400,
            detail=(
                "No suitable food items found for your current preferences and conditions. "
                "Try adjusting your filters or expanding your preferences."
            ),
        )

    # ── 6. LLM assembly ──
    # Build user info and prompts
    recent_meals_result = await db.execute(
        select(MealHistory).where(
            MealHistory.user_id == user.id,
            MealHistory.served_at >= datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0),
        )
    )
    recent_meals = [m.slot for m in recent_meals_result.scalars().all()]

    # Check if user already generated a plan today with the same params
    # Only block the most recent plan's foods (not all history) so foods can repeat after 1 skip
    already_suggested_ids: list[str] = []
    most_recent_same = await db.execute(
        select(MealHistory)
        .where(
            MealHistory.user_id == user.id,
            MealHistory.condition == "+".join(request.conditions),
            MealHistory.sex == request.sex,
            MealHistory.city_id == request.city_id,
            MealHistory.served_at >= datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0),
        )
        .order_by(MealHistory.served_at.desc())
        .limit(1)
    )
    most_recent_entry = most_recent_same.scalar_one_or_none()
    if most_recent_entry:
        # Get all food IDs from that same plan (not forever, just the most recent)
        plan_entries = await db.execute(
            select(MealHistory).where(
                MealHistory.user_id == user.id,
                MealHistory.plan_id == most_recent_entry.plan_id,
            )
        )
        already_suggested_ids = [str(m.food_item_id) for m in plan_entries.scalars().all()]

    user_info = {
        "condition": "+".join(request.conditions),
        "sex": request.sex,
        "city": city.name,
        "price_tier": price_tier_label,
        "multiplier": multiplier,
    }

    macro_dict = {
        "calories": macro_target.calories,
        "protein_g": macro_target.protein_g,
        "carbs_g": macro_target.carbs_g,
        "fat_g": macro_target.fat_g,
        "fiber_g": macro_target.fiber_g,
    }

    # Try LLM generation
    llm = LLMClient()
    system_prompt, user_prompt = LLMClient.build_plan_prompt(
        user_info=user_info,
        macro_target=macro_dict,
        candidates=candidate_dicts,
        forbidden_tags=rule.forbidden_tags,
        recent_meals=recent_meals,
        already_suggested_ids=already_suggested_ids,
    )

    plan_data = await llm.generate_plan(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        response_model=DayPlan,
    )
    await llm.close()

    if plan_data is None:
        # Fallback: deterministic plan without LLM
        plan_data = await _build_deterministic_plan(
            ranked, macro_dict, multiplier, city.id
        )

    # ── 7. Post-process ──
    plan_id = f"plan_{user.id}_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"

    # Build meals with prices
    meals = []
    total_budget = 0
    for meal_data in plan_data.get("meals", []):
        if not meal_data.get("dataset_item_ids"):
            continue

        # Compute price from IDs (never from model text)
        meal_price = 0
        for item_id in meal_data["dataset_item_ids"]:
            food_result = await db.execute(
                select(FoodItem).where(FoodItem.id == item_id)
            )
            food = food_result.scalar_one_or_none()
            if food:
                meal_price += compute_food_price(food, multiplier)

        meal_resp = MealResponse(
            slot=meal_data.get("slot", "lunch"),
            name=meal_data.get("name", "Unknown"),
            name_en=meal_data.get("name_en"),
            description=meal_data.get("description", ""),
            ingredients=meal_data.get("ingredients", []),
            nutrition=meal_data.get("nutrition", {}),
            prep_type=meal_data.get("prep_type", "buy_ready"),
            dataset_item_ids=meal_data.get("dataset_item_ids", []),
            price_idr=meal_price,
        )
        meals.append(meal_resp)
        total_budget += meal_price

        # Log to meal_history
        for item_id in meal_data["dataset_item_ids"]:
            history = MealHistory(
                user_id=user.id,
                food_item_id=item_id,
                served_at=datetime.now(timezone.utc),
                slot=meal_data.get("slot", "lunch"),
                condition="+".join(request.conditions),
                sex=request.sex,
                city_id=request.city_id,
                plan_id=plan_id,
            )
            db.add(history)

    # ── 8. Update rate limit bucket ──
    if bucket:
        bucket.plan_count += 1
    else:
        bucket = RateLimitBucket(
            user_id=user.id,
            day=today,
            plan_count=1,
            chat_count=0,
        )
        db.add(bucket)

    await db.commit()

    return PlanResponse(
        plan_id=plan_id,
        meals=meals,
        budget={
            "total_cost_idr": total_budget,
            "multiplier": multiplier,
            "price_tier": price_tier_label,
            "city": city.name,
        },
        macro_targets=macro_dict,
        notes=plan_data.get("notes"),
    )


@router.post("/api/chat", response_model=PlanResponse)
async def chat_adjust_plan(
    request: ChatRequest,
    user: User = Depends(get_current_user),
    db=Depends(get_db),
):
    """Adjust an existing plan via conversational chat.

    Takes the current plan and a user message, returns the adjusted plan.
    """
    # Rate limit check
    today = datetime.now(timezone.utc).date()
    result = await db.execute(
        select(RateLimitBucket).where(
            RateLimitBucket.user_id == user.id,
            RateLimitBucket.day == today,
        )
    )
    bucket = result.scalar_one_or_none()
    if bucket and bucket.chat_count >= settings.daily_chat_limit:
        raise HTTPException(
            status_code=429,
            detail=f"Daily chat limit reached ({settings.daily_chat_limit}). Try again tomorrow.",
        )

    # Get the most recent plan from meal_history
    history_result = await db.execute(
        select(MealHistory)
        .where(MealHistory.user_id == user.id, MealHistory.plan_id == request.plan_id)
        .limit(10)
    )
    history_entries = list(history_result.scalars().all())
    if not history_entries:
        raise HTTPException(status_code=404, detail="Plan not found")

    # Get the first entry's metadata and resolve city
    entry = history_entries[0]
    city_result = await db.execute(select(City).where(City.id == entry.city_id))
    orig_city = city_result.scalar_one_or_none()
    province_result = await db.execute(select(Province))
    provinces_map = {p.code: p.price_multiplier for p in province_result.scalars().all()}

    # Build current plan data from history
    current_plan = {"meals": [], "notes": "Adjusted plan"}
    for slot in ["breakfast", "lunch", "dinner"]:
        slot_entries = [h for h in history_entries if h.slot == slot]
        for h in slot_entries:
            food_result = await db.execute(
                select(FoodItem).where(FoodItem.id == h.food_item_id)
            )
            food = food_result.scalar_one_or_none()
            if food:
                current_plan["meals"].append({
                    "slot": slot,
                    "name": food.name_id,
                    "name_en": food.name_en,
                    "description": "From plan",
                    "ingredients": [],
                    "nutrition": {},
                    "prep_type": food.prep_type or "buy_ready",
                    "dataset_item_ids": [food.id],
                })

    # Call LLM for adjustment
    llm = LLMClient()
    adjusted = await llm.chat_adjust(
        plan=current_plan,
        message=request.message,
        history=request.history,
    )
    await llm.close()

    if adjusted is None:
        raise HTTPException(
            status_code=500,
            detail="Failed to adjust plan. Please try again.",
        )

    # Build response — compute real data from DB item IDs
    new_plan_id = f"plan_{user.id}_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
    meals = []
    total_budget = 0
    total_nutrition = {"calories": 0.0, "protein_g": 0.0, "carbs_g": 0.0, "fat_g": 0.0, "fiber_g": 0.0}

    for meal_data in adjusted.get("meals", []):
        item_ids = meal_data.get("dataset_item_ids", [])
        if not item_ids:
            continue

        # Look up real food data from DB
        food_result = await db.execute(
            select(FoodItem).where(FoodItem.id.in_(item_ids))
        )
        food_items = list(food_result.scalars().all())
        if not food_items:
            continue

        # Use the first item for display, or combine multiple
        primary = food_items[0]

        # ── BUG FIX: LLM often changes name but keeps old IDs ──
        # If the LLM's name doesn't match the DB item, try to find the
        # correct item by name from the DB
        llm_name = (meal_data.get("name") or "").strip().lower()
        db_name = (primary.name_id or "").strip().lower()
        if llm_name and llm_name != db_name:
            # Search DB for a food item matching the LLM's name
            name_search = await db.execute(
                select(FoodItem).where(FoodItem.name_id.ilike(f"%{llm_name}%"))
            )
            matched = name_search.scalar_one_or_none()
            if matched:
                primary = matched
                item_ids = [matched.id]
            # else: keep the old item but use LLM's name for display

        item_prices = [f.price_pasar_min or 0 for f in food_items]

        # Resolve price multiplier from the original plan's city
        mult, _ = resolve_price_multiplier(
            province_code=orig_city.province_code if orig_city else "",
            is_jabodetabek=bool(orig_city and orig_city.is_jabodetabek),
            provinces=provinces_map,
        )

        item_price_idr = int(min(item_prices) * mult) if item_prices else 0
        total_budget += item_price_idr

        # Build nutrition from real data
        nutrition = {
            "calories": primary.calories or 0,
            "protein_g": primary.protein_g or 0,
            "carbs_g": primary.carbs_g or 0,
            "fat_g": primary.fat_g or 0,
            "fiber_g": primary.fiber_g or 0,
        }
        for k in total_nutrition:
            total_nutrition[k] += nutrition.get(k, 0)

        meal_resp = MealResponse(
            slot=meal_data.get("slot", "lunch"),
            name=primary.name_id or meal_data.get("name", "Unknown"),
            name_en=primary.name_en or meal_data.get("name_en"),
            description=meal_data.get("description", "") or primary.name_id or "",
            ingredients=[primary.name_id] if primary.name_id else [],
            nutrition=nutrition,
            prep_type=primary.prep_type or "buy_ready",
            dataset_item_ids=item_ids,
            price_idr=item_price_idr,
            image_url=None,
        )
        meals.append(meal_resp)

        # Log to meal_history
        for item_id in meal_data["dataset_item_ids"]:
            history = MealHistory(
                user_id=user.id,
                food_item_id=item_id,
                served_at=datetime.now(timezone.utc),
                slot=meal_data.get("slot", "lunch"),
                condition=entry.condition or "none",
                sex=entry.sex or "male",
                city_id=entry.city_id,
                plan_id=new_plan_id,
            )
            db.add(history)

    # Update rate limit
    if bucket:
        bucket.chat_count += 1
    else:
        bucket = RateLimitBucket(
            user_id=user.id,
            day=today,
            plan_count=0,
            chat_count=1,
        )
        db.add(bucket)

    await db.commit()

    return PlanResponse(
        plan_id=new_plan_id,
        meals=meals,
        budget={
            "total_cost_idr": total_budget,
            "note": "Recalculated from database",
            "city": orig_city.name if orig_city else None,
        },
        macro_targets=total_nutrition,
        notes=adjusted.get("notes"),
    )


async def _build_deterministic_plan(
    ranked: dict[str, list[tuple[FoodItem, float]]],
    macro_targets: dict,
    multiplier: float,
    city_id: int,
) -> dict:
    """Build a deterministic plan without LLM (fallback).

    Simply picks the top-scored item per slot.
    """
    meals = []
    slots_used = set()

    for slot in ["breakfast", "lunch", "dinner"]:
        items = ranked.get(slot, [])
        if not items:
            continue

        # Pick top item
        best_food, _score = items[0]

        meal = {
            "slot": slot,
            "name": best_food.name_id,
            "name_en": best_food.name_en,
            "description": f"Recommended {best_food.name_id} based on your preferences",
            "ingredients": [],
            "nutrition": {
                "calories": best_food.calories or 0,
                "protein_g": best_food.protein_g or 0,
                "carbs_g": best_food.carbs_g or 0,
                "fat_g": best_food.fat_g or 0,
                "fiber_g": best_food.fiber_g or 0,
            },
            "prep_type": best_food.prep_type or "buy_ready",
            "dataset_item_ids": [best_food.id],
        }
        meals.append(meal)
        slots_used.add(slot)

    # If we have fewer than 3 meals, pick more from remaining candidates
    for slot in ["breakfast", "lunch", "dinner"]:
        if slot not in slots_used:
            # Pick from any slot
            for other_slot in ranked:
                for food, _score in ranked[other_slot]:
                    if food.id not in {m["dataset_item_ids"][0] for m in meals}:
                        meal = {
                            "slot": slot,
                            "name": food.name_id,
                            "name_en": food.name_en,
                            "description": f"Recommended {food.name_id}",
                            "ingredients": [],
                            "nutrition": {
                                "calories": food.calories or 0,
                                "protein_g": food.protein_g or 0,
                                "carbs_g": food.carbs_g or 0,
                                "fat_g": food.fat_g or 0,
                                "fiber_g": food.fiber_g or 0,
                            },
                            "prep_type": food.prep_type or "buy_ready",
                            "dataset_item_ids": [food.id],
                        }
                        meals.append(meal)
                        break

    return {
        "meals": meals,
        "notes": "This is a deterministic plan based on your preferences. Enable LLM for more varied suggestions.",
    }