"""Add new health conditions: breastfeeding, high_cholesterol, osteoporosis, pcos.

Each condition includes:
- forbidden_tags (what foods to exclude)
- extra_constraints (specific limits)
- macros (macro split recommendations)
- sex (optional restriction)
"""
import json, sys

# ── New conditions to add to CONDITION_RULES in rules.py ──

NEW_CONDITIONS = {
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
            "calorie_boost": 500,  # Extra 500 kcal/day for milk production
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

print("=== NEW CONDITIONS TO ADD TO rules.py ===")
for key, info in NEW_CONDITIONS.items():
    print(f"\n--- {key}: {info['label']} ---")
    print(f"  sex: {info.get('sex')}")
    print(f"  forbidden_tags: {info['forbidden_tags']}")
    print(f"  constraints: {info['extra_constraints']}")
    print(f"  macros: {info['macros']}")

# Also write to a JSON file for easy patching
import os
out_path = os.path.join(os.path.dirname(__file__), "new_conditions.json")
with open(out_path, "w") as f:
    json.dump(NEW_CONDITIONS, f, indent=2)
print(f"\nWritten to {out_path}")
print(f"\nTotal new conditions: {len(NEW_CONDITIONS)}")