"""HTML parser — extract food data from crawled pages."""

import json
import re
from typing import Any

from app.crawler.normalizer import canonicalize_ingredient, extract_numeric, normalize_price


def parse_schema_org(html: str) -> list[dict[str, Any]]:
    """Extract structured data (schema.org Recipe) from HTML."""
    items: list[dict[str, Any]] = []

    # Look for JSON-LD script tags
    pattern = r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>'
    matches = re.findall(pattern, html, re.DOTALL | re.IGNORECASE)

    for match in matches:
        try:
            data = json.loads(match.strip())
        except json.JSONDecodeError:
            continue

        # Handle single object or array
        entries = data if isinstance(data, list) else [data]

        for entry in entries:
            if not isinstance(entry, dict):
                continue
            if entry.get("@type") == "Recipe":
                item = _extract_recipe(entry)
                if item:
                    items.append(item)

    return items


def _extract_recipe(data: dict) -> dict[str, Any] | None:
    """Extract food item fields from a schema.org Recipe object."""
    name = data.get("name", "")
    if not name:
        return None

    ingredients = []
    raw_ingredients = data.get("recipeIngredient", [])
    if isinstance(raw_ingredients, list):
        ingredients = [canonicalize_ingredient(i) for i in raw_ingredients]
    elif isinstance(raw_ingredients, str):
        ingredients = [canonicalize_ingredient(raw_ingredients)]

    # Nutrition
    nutrition = data.get("nutrition", {}) or {}
    if isinstance(nutrition, dict):
        calories = extract_numeric(nutrition.get("calories"))
        protein = extract_numeric(nutrition.get("protein", nutrition.get("proteinContent")))
        carbs = extract_numeric(nutrition.get("carbohydrates", nutrition.get("carbohydrateContent")))
        fat = extract_numeric(nutrition.get("fat", nutrition.get("fatContent")))
        fiber = extract_numeric(nutrition.get("fiber", nutrition.get("fiberContent")))
    else:
        calories = protein = carbs = fat = fiber = None

    # Image
    image = None
    raw_image = data.get("image")
    if isinstance(raw_image, str):
        image = raw_image
    elif isinstance(raw_image, dict):
        image = raw_image.get("url")
    elif isinstance(raw_image, list):
        if raw_image:
            first = raw_image[0]
            image = first if isinstance(first, str) else (first.get("url") if isinstance(first, dict) else None)

    return {
        "name_id": name,
        "name_en": data.get("name", ""),
        "ingredients": ingredients,
        "calories": calories,
        "protein_g": protein,
        "carbs_g": carbs,
        "fat_g": fat,
        "fiber_g": fiber,
        "image_url": image,
        "source_url": data.get("url", data.get("mainEntityOfPage")),
    }


def parse_simple_html(html: str) -> list[dict[str, Any]]:
    """Fallback parser — extract food info from plain HTML using heuristics."""
    items: list[dict[str, Any]] = []

    # Try schema.org first — this is the best-structured data
    schema_items = parse_schema_org(html)
    items.extend(schema_items)

    return items