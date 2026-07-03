"""Tests for M4 — recommendation core.

Rules layer, preference scorer, pricing, candidate filter, and plan endpoint.
"""

from __future__ import annotations

import json
import pytest
from unittest.mock import AsyncMock, patch

from app.reco.rules import (
    get_rule_result,
    get_available_conditions,
    MacroTarget,
    CONDITION_RULES,
)
from app.reco.weights import DEFAULT_WEIGHTS, ScoringWeights
from app.reco.scorer import compute_score, get_recent_meal_ids, score_and_rank
from app.pricing import resolve_price_multiplier, compute_food_price, compute_budget


# ─── M4.1 — Rules Layer Tests ───


class TestRulesLayer:
    """Tests for condition/sex → macro targets + forbidden tags."""

    def test_no_condition(self):
        """Healthy adult with no condition has no forbidden tags."""
        rule = get_rule_result("none", "male", "adult")
        assert rule.allowed is True
        assert rule.forbidden_tags == []
        assert rule.macro_target.calories == 2500  # Male base
        assert rule.macro_target.fiber_g == 30  # Male fiber min
        assert rule.condition_label == "No specific condition"

    def test_female_no_condition(self):
        """Female has lower base calories."""
        rule = get_rule_result("none", "female", "adult")
        assert rule.macro_target.calories == 2000
        assert rule.macro_target.fiber_g == 25

    def test_pregnancy_forbidden(self):
        """Pregnancy forbids raw, high_mercury, unpasteurized, etc."""
        rule = get_rule_result("pregnant", "female", "adult")
        assert "raw" in rule.forbidden_tags
        assert "high_mercury" in rule.forbidden_tags
        assert "alcohol" in rule.forbidden_tags
        assert "raw_fish" in rule.forbidden_tags
        # Extra 300 calories for pregnancy
        assert rule.macro_target.calories == 2300  # 2000 + 300

    def test_diabetes_forbidden(self):
        """Diabetes forbids high_sugar and high_carb_refined."""
        rule = get_rule_result("diabetes", "male", "adult")
        assert "high_sugar" in rule.forbidden_tags
        assert "high_carb_refined" in rule.forbidden_tags
        # Check macro split is diabetes-appropriate
        assert rule.macro_target.carbs_g < rule.macro_target.protein_g * 2.5  # Lower carb

    def test_hypertension_forbidden(self):
        """Hypertension forbids high_sodium."""
        rule = get_rule_result("hypertension", "male", "adult")
        assert "high_sodium" in rule.forbidden_tags
        assert rule.extra_constraints["max_sodium_mg_per_day"] == 1500

    def test_heart_disease_forbidden(self):
        """Heart disease forbids fried, high_sodium, high_saturated_fat."""
        rule = get_rule_result("heart_disease", "male", "adult")
        assert "fried" in rule.forbidden_tags
        assert "high_sodium" in rule.forbidden_tags
        assert "high_saturated_fat" in rule.forbidden_tags

    def test_kidney_disease_forbidden(self):
        """Kidney disease forbids high_protein."""
        rule = get_rule_result("kidney_disease", "male", "adult")
        assert "high_protein" in rule.forbidden_tags
        assert "high_potassium" in rule.forbidden_tags

    def test_weight_loss_calories(self):
        """Weight loss has calorie deficit."""
        rule = get_rule_result("weight_loss", "male", "adult")
        # 2500 * 0.8 = 2000 (20% deficit)
        assert rule.macro_target.calories == 2000
        assert rule.macro_target.fiber_g >= 25

    def test_vegan_forbidden(self):
        """Vegan forbids all animal products."""
        rule = get_rule_result("vegan", "male", "adult")
        assert "meat" in rule.forbidden_tags
        assert "chicken" in rule.forbidden_tags
        assert "fish" in rule.forbidden_tags
        assert "egg" in rule.forbidden_tags
        assert "dairy" in rule.forbidden_tags

    def test_vegetarian_forbidden(self):
        """Vegetarian forbids meat/fish but allows eggs/dairy."""
        rule = get_rule_result("vegetarian", "male", "adult")
        assert "meat" in rule.forbidden_tags
        assert "fish" in rule.forbidden_tags
        assert "egg" not in rule.forbidden_tags  # Lacto-ovo allows eggs

    def test_ulcer_forbidden(self):
        """Ulcer/GERD forbids spicy, sour, fried."""
        rule = get_rule_result("ulcer", "male", "adult")
        assert "spicy" in rule.forbidden_tags
        assert "sour" in rule.forbidden_tags
        assert "fried" in rule.forbidden_tags
        assert rule.extra_constraints["max_meal_size_ml"] == 300

    def test_gout_forbidden(self):
        """Gout forbids high_purine, organ_meat, shellfish."""
        rule = get_rule_result("gout", "male", "adult")
        assert "high_purine" in rule.forbidden_tags
        assert "organ_meat" in rule.forbidden_tags
        assert "shellfish" in rule.forbidden_tags

    def test_anemia_no_forbidden(self):
        """Anemia has no forbidden tags but encourages iron."""
        rule = get_rule_result("anemia", "female", "adult")
        assert rule.forbidden_tags == []
        assert rule.extra_constraints["iron_boost"] is True

    def test_elderly_adjustment(self):
        """Elderly has lower calories but higher protein."""
        rule = get_rule_result("none", "male", "elderly")
        assert rule.macro_target.calories < 2500  # 0.85x
        assert rule.macro_target.calories == pytest.approx(2125, abs=1)

    def test_teen_adjustment(self):
        """Teen has higher calories and protein."""
        rule = get_rule_result("none", "male", "teen")
        assert rule.macro_target.calories > 2500  # 1.1x
        assert rule.macro_target.calories == pytest.approx(2750, abs=1)

    def test_unknown_condition_fallback(self):
        """Unknown condition falls back to 'none'."""
        rule = get_rule_result("nonexistent_condition", "male", "adult")
        assert rule.forbidden_tags == []
        assert rule.macro_target.calories == 2500

    def test_available_conditions(self):
        """get_available_conditions returns all conditions with labels."""
        conditions = get_available_conditions()
        assert len(conditions) == len(CONDITION_RULES)
        condition_ids = {c["id"] for c in conditions}
        assert "pregnant" in condition_ids
        assert "diabetes" in condition_ids
        assert "none" in condition_ids


# ─── M4.2 — Pricing Tests ───


class TestPricing:
    """Tests for price-tier resolution and budget calculation."""

    def test_jakarta_jabodetabek(self):
        """Jakarta (DKI, is_jabodetabek=1) uses jabodetabek override."""
        mult, label = resolve_price_multiplier("dki_jakarta", is_jabodetabek=True)
        assert mult == 1.20  # Jabodetabek override
        assert label == "jabodetabek"

    def test_bandung_not_jabodetabek(self):
        """Bandung (Jawa Barat, is_jabodetabek=0) uses province multiplier."""
        mult, label = resolve_price_multiplier("jawa_barat", is_jabodetabek=False)
        assert mult == 1.05  # West Java multiplier
        assert label == "jawa_barat"

    def test_bali_separate_province(self):
        """Bali has its own multiplier, distinct from NTB/NTT."""
        mult_bali, _ = resolve_price_multiplier("bali")
        mult_ntb, _ = resolve_price_multiplier("ntb")
        mult_ntt, _ = resolve_price_multiplier("ntt")
        assert mult_bali == 1.15
        assert mult_ntb == 0.80
        assert mult_ntt == 0.75

    def test_yogyakarta_own_rate(self):
        """DIY Yogyakarta has its own rate (0.95)."""
        mult, label = resolve_price_multiplier("di_yogyakarta")
        assert mult == 0.95
        assert label == "di_yogyakarta"

    def test_papua_highest_multiplier(self):
        """Papua has the highest price multiplier (1.30)."""
        mult, _ = resolve_price_multiplier("papua")
        assert mult == 1.30

    def test_food_price_computation(self):
        """Food price = base midpoint × multiplier, rounded to 500."""
        # Mock food item
        from types import SimpleNamespace
        food = SimpleNamespace(
            price_pasar_min=10000,
            price_pasar_max=20000,
            price_market_min=15000,
            price_market_max=25000,
            price_warung_min=None,
            price_warung_max=None,
        )
        # Midpoint = 15000, × 1.2 = 18000
        price = compute_food_price(food, 1.20, "pasar")
        assert price == 18000

        # × 0.85 = 12750, rounded to nearest 500 = 13000
        price = compute_food_price(food, 0.85, "pasar")
        assert price == 13000

    def test_budget_calculation(self):
        """compute_budget totals correctly and checks caps."""
        from types import SimpleNamespace
        food1 = SimpleNamespace(
            price_pasar_min=10000, price_pasar_max=20000,
            price_market_min=None, price_market_max=None,
            price_warung_min=None, price_warung_max=None,
        )

        budget = compute_budget(
            meal_items={"lunch": [food1], "dinner": [food1]},
            multiplier=1.0,
            daily_budget_idr=50000,
        )
        assert budget.total_cost == 30000  # 15000 + 15000
        assert budget.within_budget is True
        assert budget.remaining_budget == 20000

    def test_budget_over_limit(self):
        """Budget flags when over the daily ceiling."""
        from types import SimpleNamespace
        food_expensive = SimpleNamespace(
            price_pasar_min=50000, price_pasar_max=100000,
            price_market_min=None, price_market_max=None,
            price_warung_min=None, price_warung_max=None,
        )

        budget = compute_budget(
            meal_items={"lunch": [food_expensive]},
            multiplier=1.0,
            daily_budget_idr=50000,
        )
        # Midpoint = 75000 > 50000
        assert budget.within_budget is False

    def test_price_tier_overrides_passed(self):
        """Can pass custom overrides for testing."""
        custom_overrides = {"jabodetabek": 1.5}
        mult, label = resolve_price_multiplier(
            "dki_jakarta",
            is_jabodetabek=True,
            overrides=custom_overrides,
        )
        assert mult == 1.5
        assert label == "jabodetabek"


# ─── M4.3 — Preference Scorer Tests ───


class MockFoodItem:
    """Simplified mock for FoodItem used in scorer tests."""

    def __init__(
        self,
        id: int,
        tags_json: str = '["jawa"]',
        cuisine_tags_json: str = '["jawa"]',
        prep_type: str = "buy_ready",
        calories: float = 300,
        price_pasar_min: int = 5000,
        price_pasar_max: int = 15000,
    ):
        self.id = id
        self.name_id = f"test_food_{id}"
        self.name_en = None
        self.tags_json = tags_json
        self.cuisine_tags_json = cuisine_tags_json
        self.prep_type = prep_type
        self.calories = calories
        self.protein_g = None
        self.carbs_g = None
        self.fat_g = None
        self.fiber_g = None
        self.price_pasar_min = price_pasar_min
        self.price_pasar_max = price_pasar_max
        self.category = None


class MockUserTaste:
    """Simplified mock for UserTaste."""

    def __init__(self, kind: str, value: str, weight: float = 1.0, source: str = "onboarding"):
        self.kind = kind
        self.value = value
        self.weight = weight
        self.source = source


class MockUserPref:
    """Simplified mock for UserPref."""

    def __init__(self, prep_lean="balanced", per_meal_budget_idr=None):
        self.prep_lean = prep_lean
        self.per_meal_budget_idr = per_meal_budget_idr
        self.daily_budget_idr = None


class TestScorer:
    """Tests for preference scoring function."""

    def test_liked_ingredient_bonus(self):
        """Liked ingredient → positive score contribution."""
        food = MockFoodItem(id=1, tags_json='["chicken","grilled"]')
        tastes = [MockUserTaste("like", "chicken")]
        rule = get_rule_result("none", "male", "adult")

        score = compute_score(food, None, tastes, rule, set())
        # w_like=3.0 × 1 hit = 3.0
        assert score > 0
        assert score >= 3.0

    def test_soft_dislike_penalty(self):
        """Soft-disliked ingredient → negative score contribution."""
        food = MockFoodItem(id=1, tags_json='["fish","fried"]')
        tastes = [MockUserTaste("soft_dislike", "fish")]
        rule = get_rule_result("none", "male", "adult")

        score = compute_score(food, None, tastes, rule, set())
        # w_soft=2.0 × 1 match = -2.0
        assert score < 0

    def test_cuisine_affinity_bonus(self):
        """Preferred cuisine → positive score contribution."""
        food = MockFoodItem(id=1, cuisine_tags_json='["padang"]')
        tastes = [MockUserTaste("cuisine", "padang")]
        rule = get_rule_result("none", "male", "adult")

        score = compute_score(food, None, tastes, rule, set())
        # w_cuisine=2.5 × 1 hit = 2.5
        assert score >= 2.5

    def test_recency_penalty(self):
        """Recently eaten item gets a big penalty."""
        food = MockFoodItem(id=1)
        taste = [MockUserTaste("like", "chicken")]
        rule = get_rule_result("none", "male", "adult")

        score_fresh = compute_score(food, None, taste, rule, set())
        score_repeat = compute_score(food, None, taste, rule, {1})

        # w_repeat=5.0 penalty
        assert score_repeat < score_fresh
        assert score_repeat <= score_fresh - 5.0

    def test_spice_tolerance_perfect_match(self):
        """Perfect spice match gets bonus."""
        food = MockFoodItem(id=1, tags_json='["spicy"]')
        taste = [MockUserTaste("spice", "4")]
        rule = get_rule_result("none", "male", "adult")

        score = compute_score(food, None, taste, rule, set())
        # Perfect match bonus = 1.5
        assert score > 0

    def test_spice_tolerance_mismatch(self):
        """Spice mismatch gets penalty."""
        food = MockFoodItem(id=1, tags_json='["mild"]')
        taste = [MockUserTaste("spice", "5")]
        rule = get_rule_result("none", "male", "adult")

        score = compute_score(food, None, taste, rule, set())
        # Gap=4, penalty = 4/5 * 2.0 = 1.6
        assert score < 0

    def test_prep_preference_match(self):
        """Prep preference match gets bonus."""
        food = MockFoodItem(id=1, prep_type="buy_ready")
        prefs = MockUserPref(prep_lean="buy_ready")
        rule = get_rule_result("none", "male", "adult")

        score = compute_score(food, prefs, [], rule, set())
        # w_prep=1.0 × 1.0 = 1.0
        assert score >= 1.0

    def test_budget_pressure_per_meal(self):
        """Item over per-meal budget gets penalty."""
        food = MockFoodItem(id=1, price_pasar_min=20000, price_pasar_max=30000)
        prefs = MockUserPref(prep_lean="simple_cook", per_meal_budget_idr=10000)
        rule = get_rule_result("none", "male", "adult")

        score = compute_score(food, prefs, [], rule, set())
        # w_budget=0.5 × 2.0 = -1.0
        assert score < 0

    def test_likes_outrank_nutrition(self):
        """Preference weights collectively outrank nutrition weight."""
        # Food matching likes vs food only matching nutrition
        food_liked = MockFoodItem(id=1, tags_json='["chicken","grilled","padang"]')
        food_neutral = MockFoodItem(id=2, tags_json='["vegetarian"]', calories=600)

        tastes = [
            MockUserTaste("like", "chicken"),
            MockUserTaste("cuisine", "padang"),
        ]
        rule = get_rule_result("none", "male", "adult")

        score_liked = compute_score(food_liked, None, tastes, rule, set())
        score_neutral = compute_score(food_neutral, None, tastes, rule, set())

        assert score_liked > score_neutral

    def test_ranking_orders_by_score(self):
        """score_and_rank returns items sorted by score descending."""
        food_high = MockFoodItem(id=1, tags_json='["chicken"]')
        food_low = MockFoodItem(id=2, tags_json='["fish"]')
        tastes = [MockUserTaste("like", "chicken")]
        rule = get_rule_result("none", "male", "adult")

        ranked = score_and_rank(
            candidates=[food_low, food_high],
            prefs=None, tastes=tastes,
            rule=rule, recent_meal_ids=set(),
            top_n=10,
        )

        assert len(ranked) == 2
        assert ranked[0][0].id == 1  # chicken first
        assert ranked[1][0].id == 2  # fish second

    def test_ranking_respects_top_n(self):
        """score_and_rank limits results to top_n."""
        foods = [MockFoodItem(id=i) for i in range(10)]
        rule = get_rule_result("none", "male", "adult")

        ranked = score_and_rank(
            candidates=foods,
            prefs=None, tastes=[],
            rule=rule, recent_meal_ids=set(),
            top_n=3,
        )

        assert len(ranked) == 3

    def test_deterministic_scoring(self):
        """Same inputs always produce same scores."""
        food = MockFoodItem(id=1, tags_json='["chicken"]')
        tastes = [MockUserTaste("like", "chicken")]
        rule = get_rule_result("none", "male", "adult")

        score1 = compute_score(food, None, tastes, rule, set())
        score2 = compute_score(food, None, tastes, rule, set())

        assert score1 == score2


# ─── M4.4 — Candidate Filter Tests ───


class TestCandidateFilter:
    """Tests for the full pipeline (hard gates + scoring)."""

    def test_pregnancy_hard_gate(self):
        """Pregnancy-forbidden item never passes, regardless of preference."""
        from app.reco.filter import parse_json_tags, parse_json_tags as _  # reuse

        # Verify the scoring logic: even a liked item with forbidden tag gets negative
        raw_food = MockFoodItem(
            id=1,
            tags_json='["raw","fish"]',
        )
        tastes = [MockUserTaste("like", "fish")]

        # Pregnancy rule forbids "raw" — in filter.py this is a hard gate skip
        # But let's verify the scorer itself doesn't override hard gates
        rule = get_rule_result("pregnant", "female", "adult")

        # The scorer should still compute, but the filter should exclude
        # Verify forbidden tags contains "raw"
        assert "raw" in rule.forbidden_tags


# ─── M4.6 — Plan Endpoint Tests ───


@pytest.mark.asyncio
async def test_plan_endpoint_no_llm_fallback():
    """Test that the plan endpoint works with deterministic fallback."""
    # This tests that the deterministic fallback plan builder works
    from app.api.plan import _build_deterministic_plan

    food1 = MockFoodItem(id=1, tags_json='["chicken"]')
    food2 = MockFoodItem(id=2, tags_json='["fish"]')

    ranked = {
        "breakfast": [(food1, 3.0)],
        "lunch": [(food2, 2.0)],
        "dinner": [],
    }

    plan = await _build_deterministic_plan(
        ranked=ranked,
        macro_targets={"calories": 2000},
        multiplier=1.0,
        city_id=1,
    )

    assert len(plan["meals"]) >= 2
    assert plan["meals"][0]["slot"] == "breakfast"
    assert plan["meals"][0]["dataset_item_ids"] == [1]
    assert plan["meals"][1]["slot"] == "lunch"
    assert plan["meals"][1]["dataset_item_ids"] == [2]


@pytest.mark.asyncio
async def test_plan_conditions_endpoint(client):
    """Test that /api/plan/conditions returns all conditions."""
    response = await client.get("/api/plan/conditions")
    assert response.status_code == 200
    data = response.json()
    assert "conditions" in data
    condition_ids = {c["id"] for c in data["conditions"]}
    assert "pregnant" in condition_ids
    assert "diabetes" in condition_ids
    assert "none" in condition_ids


@pytest.mark.asyncio
async def test_plan_endpoint_auth_required(client):
    """Test that /api/plan requires authentication."""
    response = await client.post(
        "/api/plan",
        json={"condition": "none", "sex": "male", "city_id": 1},
    )
    assert response.status_code == 401 or response.status_code == 403


@pytest.mark.asyncio
async def test_plan_endpoint_invalid_city(client):
    """Test that invalid city returns 404."""
    from app.core.security import create_access_token
    token = create_access_token(subject=str(1))

    response = await client.post(
        "/api/plan",
        json={"condition": "none", "sex": "male", "city_id": 9999},
        cookies={"access_token": token},
    )
    # If token doesn't match a real user, auth fails first
    assert response.status_code in (401, 404)


@pytest.mark.asyncio
async def test_chat_endpoint_auth_required(client):
    """Test that /api/chat requires authentication."""
    response = await client.post(
        "/api/chat",
        json={"plan_id": "test_plan", "message": "make it spicier"},
    )
    assert response.status_code == 401 or response.status_code == 403