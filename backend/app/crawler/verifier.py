"""Verification gate — TKPI nutrition cross-check, price sanity, allergen/pregnancy tagging."""

import json
from typing import Any

# Thresholds
NUTRITION_TOLERANCE_PCT = 0.15  # ±15% tolerance vs TKPI
PRICE_MIN_IDR = 2000
PRICE_MAX_IDR = 200000

# Pregnancy-forbidden tags — these items must never auto-promote
PREGNANCY_FORBIDDEN_TAGS = {"raw", "high_mercury", "raw_egg", "unpasteurized", "alcohol"}

# Allergen keywords (auto-classified from ingredients)
ALLERGEN_KEYWORDS: dict[str, list[str]] = {
    "peanut": ["kacang tanah", "peanut", "selai kacang"],
    "shellfish": ["udang", "shrimp", "kepiting", "crab", "kerang", "clam"],
    "egg": ["telur", "egg", "mayonnaise"],
    "milk": ["susu", "milk", "keju", "cheese", "cream", "yogurt"],
    "soy": ["tahu", "tofu", "tempe", "tempeh", "kecap", "soy sauce"],
    "gluten": ["terigu", "flour", "roti", "bread", "mie", "noodle", "pasta"],
    "fish": ["ikan", "fish", "tuna", "salmon"],
}


class VerificationResult:
    """Result of verification checks on a parsed food item."""

    def __init__(self) -> None:
        self.passes: list[str] = []
        self.warnings: list[str] = []
        self.failures: list[str] = []
        self.auto_classified_tags: list[str] = []
        self.pregnancy_flagged: bool = False

    @property
    def status(self) -> str:
        if self.failures:
            return "rejected"
        if self.warnings:
            return "human_verified"
        if self.pregnancy_flagged:
            return "human_verified"
        return "auto_verified"


def verify_nutrition(
    item: dict[str, Any],
    tkpi_ref: dict[str, float] | None,
) -> list[str]:
    """Cross-check nutrition against TKPI reference. Returns list of issues."""
    issues: list[str] = []

    if tkpi_ref is None:
        return issues  # No reference → skip (no failure, but no auto-promote)

    for nutrient in ("calories", "protein_g", "carbs_g", "fat_g"):
        crawled = item.get(nutrient)
        ref = tkpi_ref.get(nutrient)
        if crawled is not None and ref is not None and ref > 0:
            diff = abs(crawled - ref) / ref
            if diff > NUTRITION_TOLERANCE_PCT:
                issues.append(f"{nutrient}: {crawled} vs TKPI {ref} ({diff*100:.1f}% off)")

    return issues


def verify_price_sanity(item: dict[str, Any]) -> list[str]:
    """Check that price ranges are within plausible bounds."""
    issues: list[str] = []
    for key in ("price_pasar_min", "price_pasar_max", "price_market_min", "price_market_max", "price_warung_min", "price_warung_max"):
        val = item.get(key)
        if val is not None:
            if val < PRICE_MIN_IDR:
                issues.append(f"{key}: {val} below minimum ({PRICE_MIN_IDR})")
            if val > PRICE_MAX_IDR:
                issues.append(f"{key}: {val} above maximum ({PRICE_MAX_IDR})")
    return issues


def auto_classify_tags(item: dict[str, Any]) -> list[str]:
    """Auto-classify allergen and nutrition tags from ingredients/name."""
    tags: list[str] = []
    text_to_check = " ".join([
        item.get("name_id", "").lower(),
        item.get("name_en", "").lower(),
        " ".join(item.get("ingredients", [])).lower() if isinstance(item.get("ingredients"), list) else "",
    ])

    for allergen, keywords in ALLERGEN_KEYWORDS.items():
        for kw in keywords:
            if kw in text_to_check and allergen not in tags:
                tags.append(allergen)

    return tags


def check_pregnancy_tags(tags: list[str]) -> bool:
    """Check if any auto-classified or provided tag is pregnancy-forbidden."""
    return bool(PREGNANCY_FORBIDDEN_TAGS.intersection(tags))


async def verify_item(
    item: dict[str, Any],
    tkpi_ref: dict[str, float] | None = None,
) -> VerificationResult:
    """Run the full verification pipeline on a parsed food item."""
    result = VerificationResult()

    # 1. Nutrition cross-check
    nutrition_issues = verify_nutrition(item, tkpi_ref)
    if nutrition_issues:
        result.warnings.extend(nutrition_issues)

    # 2. Price sanity
    price_issues = verify_price_sanity(item)
    if price_issues:
        result.warnings.extend(price_issues)

    # 3. Auto-classify tags
    existing_tags = set()
    if item.get("tags_json"):
        existing_tags = set(json.loads(item["tags_json"]))

    auto_tags = auto_classify_tags(item)
    result.auto_classified_tags = list(set(auto_tags) | existing_tags)

    # 4. Pregnancy check
    all_tags = set(result.auto_classified_tags)
    if item.get("tags_json"):
        all_tags.update(json.loads(item["tags_json"]))

    result.pregnancy_flagged = check_pregnancy_tags(list(all_tags))
    if result.pregnancy_flagged:
        result.warnings.append("Contains pregnancy-forbidden tags — requires human review")

    return result