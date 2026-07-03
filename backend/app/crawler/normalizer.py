"""Data normalizer — unit conversion, canonical names, deduplication."""

import hashlib
import json
import re
from typing import Any


# Common Indonesian ingredient canonicalization map
_CANONICAL_INGREDIENTS: dict[str, str] = {
    "ayam": "chicken",
    "daging sapi": "beef",
    "daging": "beef",
    "bawang merah": "shallot",
    "bawang putih": "garlic",
    "cabai": "chili",
    "cabe": "chili",
    "kentang": "potato",
    "wortel": "carrot",
    "tahu": "tofu",
    "tempe": "tempeh",
    "telur": "egg",
    "ikan": "fish",
    "udang": "shrimp",
    "kacang tanah": "peanut",
    "santan": "coconut milk",
    "kelapa": "coconut",
    "beras": "rice",
}

# Unit conversion to grams
_UNIT_TO_GRAM: dict[str, float] = {
    "g": 1.0,
    "gram": 1.0,
    "kg": 1000.0,
    "kilogram": 1000.0,
    "ml": 1.0,  # Assume 1ml ≈ 1g for simplicity
    "l": 1000.0,
    "sdm": 15.0,  # tablespoon
    "sdt": 5.0,  # teaspoon
    "cangkir": 240.0,  # cup
    "buah": 100.0,  # approximate
}


def normalize_unit(value: float | str | None, unit: str | None) -> float | None:
    """Convert a value to grams. Returns None if conversion is impossible."""
    if value is None:
        return None
    val = float(value)
    if not unit:
        return val  # Assume already in grams
    unit_key = unit.lower().strip()
    multiplier = _UNIT_TO_GRAM.get(unit_key)
    if multiplier:
        return round(val * multiplier, 2)
    return val  # Unknown unit, return as-is


def canonicalize_ingredient(name: str) -> str:
    """Map an ingredient name to its canonical English form."""
    key = name.lower().strip()
    return _CANONICAL_INGREDIENTS.get(key, key)


def compute_item_hash(
    name_id: str,
    ingredients: list[str] | None = None,
    source_url: str | None = None,
) -> str:
    """Compute a deterministic hash for deduplication."""
    raw = f"{name_id.lower().strip()}|{json.dumps(sorted(ingredients or []), sort_keys=True)}|{source_url or ''}"
    return hashlib.sha256(raw.encode()).hexdigest()


def extract_numeric(value: str | None) -> float | None:
    """Extract a numeric value from a string like '1500 IDR' or '200 g'."""
    if not value:
        return None
    match = re.search(r"(\d+(?:[.,]\d+)?)", value.replace(",", ""))
    if match:
        return float(match.group(1).replace(",", "."))
    return None


def normalize_price(value: str | None) -> int | None:
    """Extract price in IDR from a string."""
    val = extract_numeric(value)
    if val is None:
        return None
    return int(val)