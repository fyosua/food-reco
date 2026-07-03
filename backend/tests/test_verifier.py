"""Tests for the verification pipeline."""

import json

import pytest

from app.crawler.verifier import (
    auto_classify_tags,
    check_pregnancy_tags,
    verify_item,
    verify_nutrition,
    verify_price_sanity,
)


class TestVerifyNutrition:
    """Nutrition cross-check against TKPI reference."""

    def test_within_tolerance_passes(self):
        item = {"calories": 380, "protein_g": 8.5, "carbs_g": 55.0, "fat_g": 12.0}
        ref = {"calories": 400, "protein_g": 9.0, "carbs_g": 50.0, "fat_g": 13.0}
        issues = verify_nutrition(item, ref)
        assert len(issues) == 0

    def test_outside_tolerance_fails(self):
        item = {"calories": 500, "protein_g": 8.5, "carbs_g": 55.0, "fat_g": 12.0}
        ref = {"calories": 400, "protein_g": 9.0, "carbs_g": 50.0, "fat_g": 13.0}
        issues = verify_nutrition(item, ref)
        assert any("calories" in i for i in issues)

    def test_no_reference_skips(self):
        item = {"calories": 9999}
        issues = verify_nutrition(item, None)
        assert len(issues) == 0


class TestVerifyPriceSanity:
    """Price range plausibility checks."""

    def test_reasonable_price_passes(self):
        item = {"price_pasar_min": 5000, "price_pasar_max": 15000}
        issues = verify_price_sanity(item)
        assert len(issues) == 0

    def test_too_cheap_fails(self):
        item = {"price_pasar_min": 100}
        issues = verify_price_sanity(item)
        assert any("below minimum" in i for i in issues)

    def test_too_expensive_fails(self):
        item = {"price_pasar_max": 9999999}
        issues = verify_price_sanity(item)
        assert any("above maximum" in i for i in issues)


class TestAutoClassifyTags:
    """Ingredient-based tag auto-classification."""

    def test_peanut_detected(self):
        item = {"name_id": "Gado-Gado", "name_en": "Gado-Gado", "ingredients": ["kacang tanah", "tahu", "sayur"]}
        tags = auto_classify_tags(item)
        assert "peanut" in tags

    def test_shellfish_detected(self):
        item = {"name_id": "Udang Goreng", "ingredients": ["udang", "bawang putih"]}
        tags = auto_classify_tags(item)
        assert "shellfish" in tags

    def test_no_tags_for_plain_item(self):
        item = {"name_id": "Nasi Putih", "ingredients": ["beras", "air"]}
        tags = auto_classify_tags(item)
        assert len(tags) == 0


class TestCheckPregnancyTags:
    """Pregnancy-forbidden tag detection."""

    def test_raw_tag_flagged(self):
        assert check_pregnancy_tags(["raw", "high_protein"])

    def test_high_mercury_flagged(self):
        assert check_pregnancy_tags(["fish", "high_mercury"])

    def test_safe_tags_not_flagged(self):
        assert not check_pregnancy_tags(["high_protein", "vegetarian"])


class TestVerifyItem:
    """Full verification pipeline integration."""

    @pytest.mark.asyncio
    async def test_clean_item_auto_verified(self):
        item = {
            "name_id": "Nasi Goreng",
            "calories": 380,
            "protein_g": 8.5,
            "carbs_g": 55.0,
            "fat_g": 12.0,
            "price_pasar_min": 15000,
            "price_pasar_max": 25000,
        }
        ref = {"calories": 400, "protein_g": 9.0, "carbs_g": 50.0, "fat_g": 13.0}
        result = await verify_item(item, ref)
        assert result.status == "auto_verified"

    @pytest.mark.asyncio
    async def test_bad_nutrition_routed_to_human(self):
        item = {
            "name_id": "Nasi Goreng X",
            "calories": 9999,
            "protein_g": 999,
            "carbs_g": 999,
            "fat_g": 999,
        }
        ref = {"calories": 400, "protein_g": 9.0, "carbs_g": 50.0, "fat_g": 13.0}
        result = await verify_item(item, ref)
        assert result.status == "human_verified"

    @pytest.mark.asyncio
    async def test_raw_tag_pregnancy_flagged(self):
        item = {"name_id": "Sashimi", "tags_json": json.dumps(["raw", "fish"])}
        result = await verify_item(item)
        assert result.pregnancy_flagged
        assert result.status == "human_verified"