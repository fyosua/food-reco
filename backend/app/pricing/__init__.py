"""Pricing module — price-tier resolution + deterministic budget calculation.

Pricing model (Product PRD v2.1 — province-based):
  displayed_price = national_base_price × resolved_price_tier_multiplier

The price_tier is:
  - The administrative PROVINCE multiplier (38 provinces)
  - OR the 'jabodetabek' override for Greater Jakarta metro cities
    (Jakarta, Bogor, Depok, Tangerang, South Tangerang, Bekasi)

Bali/NTB/NTT are 3 distinct provinces (each their own multiplier).
Bandung = West Java rate (not Jabodetabek).
Yogyakarta (DIY) = its own rate.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from decimal import Decimal, ROUND_HALF_UP
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.food import FoodItem


@dataclass
class BudgetResult:
    """Result of budget calculation for a day plan."""

    total_cost: int = 0
    meal_costs: dict[str, int] = field(default_factory=dict)  # slot -> cost
    price_tier_label: str = ""
    multiplier: float = 1.0
    within_budget: bool = True
    remaining_budget: int = 0


def resolve_price_multiplier(
    province_code: str,
    is_jabodetabek: bool = False,
    overrides: dict[str, float] | None = None,
    provinces: dict[str, float] | None = None,
) -> tuple[float, str]:
    """Resolve the price multiplier for a city based on its province + Jabodetabek status.

    Args:
        province_code: The administrative province code (e.g. 'jawa_barat', 'dki_jakarta').
        is_jabodetabek: Whether the city is in the Jabodetabek metro zone.
        overrides: Dict of override code -> multiplier (loaded from DB or passed for testing).
        provinces: Dict of province code -> multiplier (loaded from DB or passed for testing).

    Returns:
        Tuple of (multiplier, label) where label explains the price tier.
    """
    # Default multipliers (2026 UMP-informed starting point)
    default_provinces: dict[str, float] = {
        "dki_jakarta": 1.25,
        "jawa_barat": 1.05,
        "jawa_tengah": 0.85,
        "di_yogyakarta": 0.95,
        "jawa_timur": 0.90,
        "banten": 1.00,
        "bali": 1.15,
        "ntb": 0.80,
        "ntt": 0.75,
        "sumatera_utara": 1.05,
        "sumatera_barat": 0.95,
        "sumatera_selatan": 0.90,
        "riau": 1.05,
        "kep_riau": 1.10,
        "jambi": 0.85,
        "bengkulu": 0.80,
        "lampung": 0.85,
        "bangka_belitung": 0.90,
        "kalimantan_barat": 0.95,
        "kalimantan_tengah": 0.95,
        "kalimantan_selatan": 0.90,
        "kalimantan_timur": 1.15,
        "kalimantan_utara": 1.10,
        "sulawesi_utara": 1.00,
        "sulawesi_tengah": 0.90,
        "sulawesi_selatan": 0.95,
        "sulawesi_tenggara": 0.90,
        "gorontalo": 0.85,
        "sulawesi_barat": 0.85,
        "maluku": 0.95,
        "maluku_utara": 0.90,
        "papua": 1.30,
        "papua_selatan": 1.25,
        "papua_tengah": 1.25,
        "papua_pegunungan": 1.25,
        "papua_barat": 1.20,
        "papua_barat_daya": 1.20,
        "aceh": 1.00,
    }

    # Default overrides
    default_overrides: dict[str, float] = {
        "jabodetabek": 1.20,
    }

    merged_provinces = {**default_provinces, **(provinces or {})}
    merged_overrides = {**default_overrides, **(overrides or {})}

    # 1. Check Jabodetabek override first — it takes priority
    if is_jabodetabek:
        jabodetabek_mult = merged_overrides.get("jabodetabek", 1.20)
        return (jabodetabek_mult, "jabodetabek")

    # 2. Use province multiplier
    if province_code in merged_provinces:
        mult = merged_provinces[province_code]
        return (mult, province_code)

    # 3. Fallback: national average
    return (1.0, "national_avg")


def compute_food_price(
    food_item: FoodItem,
    multiplier: float,
    price_source: str = "pasar",
) -> int:
    """Compute the displayed price for a food item.

    Uses the midpoint of the base price range × multiplier, rounded to nearest 500 IDR.

    Args:
        food_item: The food item with base price ranges.
        multiplier: The resolved price tier multiplier.
        price_source: Which price source to use ('pasar', 'market', 'warung').

    Returns:
        Displayed price in IDR.
    """
    if price_source == "market":
        p_min = food_item.price_market_min
        p_max = food_item.price_market_max
    elif price_source == "warung":
        p_min = food_item.price_warung_min
        p_max = food_item.price_warung_max
    else:
        # Default: pasar (traditional market)
        p_min = food_item.price_pasar_min
        p_max = food_item.price_pasar_max

    if p_min is None or p_max is None:
        return 0

    base_mid = (p_min + p_max) / 2
    raw = Decimal(str(base_mid)) * Decimal(str(multiplier))

    # Round to nearest 500 IDR
    rounded = round(float(raw) / 500) * 500
    return max(int(rounded), 500)  # Minimum 500 IDR


def compute_budget(
    meal_items: dict[str, list[FoodItem]],
    multiplier: float,
    daily_budget_idr: int | None = None,
    per_meal_budget_idr: int | None = None,
    price_source: str = "pasar",
) -> BudgetResult:
    """Compute the total budget for a day plan.

    Args:
        meal_items: Dict mapping slot -> list of food items for that slot.
        multiplier: The resolved price tier multiplier.
        daily_budget_idr: Optional daily budget ceiling.
        per_meal_budget_idr: Optional per-meal budget ceiling.
        price_source: Which price source to use.

    Returns:
        BudgetResult with total cost, per-meal costs, and budget status.
    """
    meal_costs: dict[str, int] = {}
    total_cost = 0
    within_budget = True

    for slot, items in meal_items.items():
        slot_cost = 0
        for item in items:
            slot_cost += compute_food_price(item, multiplier, price_source)
        meal_costs[slot] = slot_cost
        total_cost += slot_cost

        # Check per-meal budget
        if per_meal_budget_idr and slot_cost > per_meal_budget_idr:
            within_budget = False

    # Check daily budget
    remaining = 0
    if daily_budget_idr:
        remaining = daily_budget_idr - total_cost
        if total_cost > daily_budget_idr:
            within_budget = False

    return BudgetResult(
        total_cost=total_cost,
        meal_costs=meal_costs,
        multiplier=multiplier,
        within_budget=within_budget,
        remaining_budget=max(remaining, 0),
    )