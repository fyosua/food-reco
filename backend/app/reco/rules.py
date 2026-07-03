"""Rules layer — condition/sex → macro targets + forbidden tags.

This is the Stage 1 hard gate. It determines:
1. What is *allowed* (health rules decide, preference only ranks the safe set)
2. Daily macro/calorie targets per condition + sex

All rules are deterministic and unit-tested with fixed fixtures.
"""

from __future__ import annotations

from dataclasses import dataclass, field

# ── Condition definitions ──────────────────────────────────────────────

# Each condition maps to: forbidden tags, special constraints, and macro targets.
# Tags use the same vocabulary as food_item.tags_json.

CONDITION_RULES: dict[str, dict] = {
    "none": {
        "label": "No specific condition",
        "sex": None,  # All sexes
        "forbidden_tags": [],  # No hard exclusions for healthy adults
        "extra_constraints": {},
        "macros": {},  # Uses general defaults
    },
    "pregnant": {
        "label": "Pregnancy",
        "sex": "female",  # Only applicable to females
        "forbidden_tags": [
            "raw",
            "high_mercury",
            "unpasteurized",
            "alcohol",
            "raw_egg",
            "raw_fish",
        ],
        "extra_constraints": {
            "max_caffeine_mg": 200,
            "folate_boost": True,
        },
        "macros": {},  # Uses general defaults + extra 300 kcal in 2nd/3rd tri
    },
    "diabetes": {
        "label": "Diabetes",
        "forbidden_tags": ["high_sugar", "high_carb_refined"],
        "extra_constraints": {
            "max_glycemic_index": 55,
            "max_sugar_g_per_meal": 15,
        },
        "macros": {
            "carbs_pct": (40, 45),
            "protein_pct": (20, 30),
            "fat_pct": (25, 35),
        },
    },
    "hypertension": {
        "label": "Hypertension",
        "forbidden_tags": ["high_sodium", "cured", "pickled"],
        "extra_constraints": {
            "max_sodium_mg_per_day": 1500,
        },
        "macros": {
            "carbs_pct": (50, 60),
            "protein_pct": (15, 20),
            "fat_pct": (20, 30),
        },
    },
    "heart_disease": {
        "label": "Heart Disease",
        "forbidden_tags": [
            "high_sodium",
            "high_saturated_fat",
            "fried",
            "cured",
            "trans_fat",
        ],
        "extra_constraints": {
            "max_sodium_mg_per_day": 1500,
            "max_saturated_fat_pct": 7,
        },
        "macros": {
            "carbs_pct": (50, 60),
            "protein_pct": (15, 20),
            "fat_pct": (20, 30),
        },
    },
    "kidney_disease": {
        "label": "Kidney Disease",
        "forbidden_tags": [
            "high_protein",
            "high_sodium",
            "high_potassium",
            "high_phosphorus",
        ],
        "extra_constraints": {
            "max_protein_g_per_kg": 0.8,
            "max_sodium_mg_per_day": 1500,
            "max_potassium_mg_per_day": 2000,
        },
        "macros": {
            "carbs_pct": (55, 65),
            "protein_pct": (10, 15),
            "fat_pct": (25, 30),
        },
    },
    "weight_loss": {
        "label": "Weight Loss",
        "forbidden_tags": ["high_sugar", "fried", "trans_fat"],
        "extra_constraints": {
            "calorie_deficit_pct": 20,
            "min_fiber_g": 25,
        },
        "macros": {
            "carbs_pct": (40, 50),
            "protein_pct": (25, 35),
            "fat_pct": (20, 30),
        },
    },
    "lactose_intolerant": {
        "label": "Lactose Intolerance",
        "forbidden_tags": ["dairy", "lactose", "cheese", "milk"],
        "extra_constraints": {},
        "macros": {},
    },
    "vegan": {
        "label": "Vegan",
        "forbidden_tags": ["meat", "chicken", "fish", "egg", "dairy", "honey", "seafood", "beef"],
        "extra_constraints": {},
        "macros": {},
    },
    "vegetarian": {
        "label": "Vegetarian (Lacto-Ovo)",
        "forbidden_tags": ["meat", "chicken", "fish", "beef", "seafood"],
        "extra_constraints": {},
        "macros": {},
    },
    "ulcer": {
        "label": "Stomach Ulcer / GERD",
        "forbidden_tags": ["spicy", "sour", "fried", "caffeine", "acidic", "carbonated"],
        "extra_constraints": {
            "max_meal_size_ml": 300,
            "min_hours_between_meals": 3,
        },
        "macros": {},
    },
    "gout": {
        "label": "Gout / High Uric Acid",
        "forbidden_tags": ["high_purine", "organ_meat", "shellfish", "alcohol", "high_fructose"],
        "extra_constraints": {
            "max_purine_mg_per_day": 400,
        },
        "macros": {
            "carbs_pct": (55, 65),
            "protein_pct": (10, 15),
            "fat_pct": (20, 30),
        },
    },
    "anemia": {
        "label": "Anemia",
        "forbidden_tags": [],  # No hard exclusions, but encourages iron-rich
        "extra_constraints": {
            "iron_boost": True,
            "min_iron_mg": 8,
            "vitamin_c_pairing": True,
        },
        "macros": {},
    },
    "breastfeeding": {
        "label": "Breastfeeding / Menyusui",
        "sex": "female",
        "forbidden_tags": [
            "high_mercury",
            "alcohol",
            "high_caffeine",
            "raw",
            "raw_egg",
        ],
        "extra_constraints": {
            "max_caffeine_mg": 300,
            "calorie_boost": 500,
            "folate_boost": True,
            "calcium_boost": True,
        },
        "macros": {
            "carbs_pct": (50, 60),
            "protein_pct": (20, 25),
            "fat_pct": (25, 30),
        },
    },
    "high_cholesterol": {
        "label": "High Cholesterol / Kolesterol Tinggi",
        "forbidden_tags": [
            "high_saturated_fat",
            "trans_fat",
            "fried",
            "organ_meat",
            "high_cholesterol",
        ],
        "extra_constraints": {
            "max_saturated_fat_pct": 7,
            "max_dietary_cholesterol_mg": 200,
            "min_fiber_g": 30,
        },
        "macros": {
            "carbs_pct": (50, 60),
            "protein_pct": (15, 20),
            "fat_pct": (20, 25),
        },
    },
    "osteoporosis": {
        "label": "Osteoporosis",
        "forbidden_tags": [
            "high_sodium",
            "high_caffeine",
            "high_sugar",
            "alcohol",
        ],
        "extra_constraints": {
            "max_sodium_mg_per_day": 1500,
            "calcium_boost": True,
            "vitamin_d_boost": True,
            "max_caffeine_mg": 200,
        },
        "macros": {
            "carbs_pct": (50, 60),
            "protein_pct": (18, 25),
            "fat_pct": (20, 30),
        },
    },
    "pcos": {
        "label": "PCOS / Sindrom Ovarium Polikistik",
        "sex": "female",
        "forbidden_tags": [
            "high_sugar",
            "high_carb_refined",
            "trans_fat",
            "fried",
        ],
        "extra_constraints": {
            "max_sugar_g_per_meal": 15,
            "max_glycemic_index": 55,
            "min_fiber_g": 30,
            "anti_inflammatory_boost": True,
        },
        "macros": {
            "carbs_pct": (35, 45),
            "protein_pct": (25, 35),
            "fat_pct": (25, 35),
        },
    },
}

# ── Sex-based adjustments ──────────────────────────────────────────────

SEX_MACRO_ADJUSTMENTS: dict[str, dict] = {
    "male": {
        "base_calories": 2500,
        "protein_g_per_kg": 0.8,
        "fiber_g_min": 30,
        "water_ml": 3700,
    },
    "female": {
        "base_calories": 2000,
        "protein_g_per_kg": 0.8,
        "fiber_g_min": 25,
        "water_ml": 2700,
    },
}

# ── Age group adjustments ──────────────────────────────────────────────

AGE_ADJUSTMENTS: dict[str, dict] = {
    "adult": {"calorie_factor": 1.0, "protein_factor": 1.0},
    "elderly": {"calorie_factor": 0.85, "protein_factor": 1.2},
    "teen": {"calorie_factor": 1.1, "protein_factor": 1.15},
}


@dataclass
class MacroTarget:
    """Daily nutrition targets."""

    calories: float = 2000.0
    protein_g: float = 60.0
    carbs_g: float = 275.0
    fat_g: float = 65.0
    fiber_g: float = 25.0


@dataclass
class RuleResult:
    """Result of applying rules layer."""

    allowed: bool = True
    forbidden_tags: list[str] = field(default_factory=list)
    macro_target: MacroTarget = field(default_factory=MacroTarget)
    extra_constraints: dict = field(default_factory=dict)
    condition_label: str = ""


def get_rule_result(condition: str, sex: str, age_group: str = "adult") -> RuleResult:
    """Compute the rule result for a given condition + sex + age group.

    Args:
        condition: One of the keys in CONDITION_RULES.
        sex: 'male' or 'female'.
        age_group: 'adult', 'elderly', or 'teen'.

    Returns:
        RuleResult with forbidden tags (Stage 1), macro targets, and constraints.
    """
    condition = condition.lower().strip() if condition else "none"
    sex = sex.lower().strip() if sex else "male"
    age_group = age_group.lower().strip() if age_group else "adult"

    # Fallback to "none" for unknown conditions
    rule = CONDITION_RULES.get(condition, CONDITION_RULES["none"])
    sex_adj = SEX_MACRO_ADJUSTMENTS.get(sex, SEX_MACRO_ADJUSTMENTS["male"])
    age_adj = AGE_ADJUSTMENTS.get(age_group, AGE_ADJUSTMENTS["adult"])

    forbidden_tags = list(rule["forbidden_tags"])
    extra = dict(rule.get("extra_constraints", {}))
    condition_label = rule["label"]

    # Base calories from sex
    base_calories = sex_adj["base_calories"] * age_adj["calorie_factor"]

    # Build macro targets
    macro_config = rule.get("macros", {})
    if macro_config:
        # Condition-specific macro split
        carbs_pct = macro_config.get("carbs_pct", (50, 60))
        protein_pct = macro_config.get("protein_pct", (15, 20))
        fat_pct = macro_config.get("fat_pct", (20, 30))

        # Use midpoint of ranges
        carbs_ratio = (carbs_pct[0] + carbs_pct[1]) / 2 / 100
        protein_ratio = (protein_pct[0] + protein_pct[1]) / 2 / 100
        fat_ratio = (fat_pct[0] + fat_pct[1]) / 2 / 100
    else:
        # Standard: 50% carbs, 20% protein, 30% fat
        carbs_ratio = 0.50
        protein_ratio = 0.20
        fat_ratio = 0.30

    # Calorie adjustment from extra_constraints (e.g. breastfeeding: +500, pregnant: +300)
    calorie_boost = rule.get("extra_constraints", {}).get("calorie_boost", 0)
    if isinstance(calorie_boost, (int, float)):
        base_calories += calorie_boost

    # Calorie adjustment for pregnancy (legacy explicit check)
    if condition == "pregnant":
        base_calories += 300  # Extra for 2nd/3rd trimester

    # Calorie adjustment for weight_loss
    if condition == "weight_loss":
        deficit = rule["extra_constraints"].get("calorie_deficit_pct", 20)
        base_calories *= (100 - deficit) / 100

    protein_g = (base_calories * protein_ratio) / 4  # 4 cal/g
    carbs_g = (base_calories * carbs_ratio) / 4  # 4 cal/g
    fat_g = (base_calories * fat_ratio) / 9  # 9 cal/g

    # Protein floor from body-weight based (assume 60kg if not specified)
    protein_floor = sex_adj["protein_g_per_kg"] * 60 * age_adj["protein_factor"]
    protein_g = max(protein_g, protein_floor)

    macro = MacroTarget(
        calories=round(base_calories, 0),
        protein_g=round(protein_g, 1),
        carbs_g=round(carbs_g, 1),
        fat_g=round(fat_g, 1),
        fiber_g=sex_adj["fiber_g_min"],
    )

    return RuleResult(
        allowed=True,
        forbidden_tags=forbidden_tags,
        macro_target=macro,
        extra_constraints=extra,
        condition_label=condition_label,
    )


def get_combined_rule_result(
    conditions: list[str], sex: str, age_group: str = "adult"
) -> RuleResult:
    """Compute the combined rule result for multiple health conditions.

    Args:
        conditions: List of condition IDs (keys in CONDITION_RULES).
        sex: 'male' or 'female'.
        age_group: 'adult', 'elderly', or 'teen'.

    Returns:
        RuleResult with:
          - UNION of all forbidden_tags (deduplicated)
          - Most restrictive macro targets (lowest calories, lowest protein/carbs/fat,
            highest fiber)
          - Merged extra_constraints (most restrictive per key)
          - Combined condition_label
    """
    if not conditions:
        conditions = ["none"]

    # Filter out "none" if mixed with real conditions
    real_conditions = [c for c in conditions if c != "none"]
    if real_conditions:
        conditions = real_conditions

    # Get individual rule results
    results: list[RuleResult] = []
    for cond in conditions:
        results.append(get_rule_result(cond, sex, age_group))

    if not results:
        return get_rule_result("none", sex, age_group)

    # UNION of forbidden tags
    all_forbidden: set[str] = set()
    for r in results:
        all_forbidden.update(r.forbidden_tags)

    # Most restrictive macro targets
    # "Most restrictive" = lowest calories, lowest protein, lowest carbs, lowest fat,
    # highest fiber
    macro = MacroTarget(
        calories=min(r.macro_target.calories for r in results),
        protein_g=min(r.macro_target.protein_g for r in results),
        carbs_g=min(r.macro_target.carbs_g for r in results),
        fat_g=min(r.macro_target.fat_g for r in results),
        fiber_g=max(r.macro_target.fiber_g for r in results),
    )

    # Merge extra_constraints: most restrictive per key
    # For max_* keys: take the minimum value
    # For min_* keys: take the maximum value
    # For boolean flags: True wins
    merged_constraints: dict = {}
    for r in results:
        for key, val in r.extra_constraints.items():
            if key not in merged_constraints:
                merged_constraints[key] = val
            else:
                existing = merged_constraints[key]
                if isinstance(val, bool):
                    merged_constraints[key] = existing or val
                elif key.startswith("max_"):
                    merged_constraints[key] = min(existing, val)
                elif key.startswith("min_"):
                    merged_constraints[key] = max(existing, val)
                elif isinstance(val, (int, float)):
                    # For generic numeric keys, prefer lower (more restrictive)
                    merged_constraints[key] = min(existing, val)
                else:
                    merged_constraints[key] = val

    # Combined label
    labels = [r.condition_label for r in results if r.condition_label]
    label = " + ".join(labels) if labels else ""

    return RuleResult(
        allowed=True,
        forbidden_tags=sorted(all_forbidden),
        macro_target=macro,
        extra_constraints=merged_constraints,
        condition_label=label,
    )


def get_available_conditions() -> list[dict]:
    """Return all available conditions with labels for UI selection.

    The "none" condition is omitted — it's the default when no conditions are selected.
    Each condition includes an optional "sex" field for sex-specific filtering.
    """
    return [
        {"id": key, "label": info["label"], "sex": info.get("sex")}
        for key, info in CONDITION_RULES.items()
        if key != "none"
    ]