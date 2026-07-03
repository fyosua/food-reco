"""Seed the new admin-control tables: health_condition, tag_catalog, cuisine_type.
Run once after creating the tables. Idempotent — skips existing data.
"""
import json, asyncio

from app.core.database import async_session_factory
from app.models.health_condition import HealthCondition
from app.models.tag_catalog import TagCatalog
from app.models.cuisine_type import CuisineType
from app.reco.rules import CONDITION_RULES


# ── Health conditions from current rules.py ──

HEALTH_CONDITIONS = [
    {
        "code": k,
        "name_id": v.get("label", k),
        "label_en": v.get("label", k),
        "sex": v.get("sex"),
        "forbidden_tags_json": json.dumps(v.get("forbidden_tags", [])),
        "extra_constraints_json": json.dumps(v.get("extra_constraints", {})),
        "macros_json": json.dumps(v.get("macros", {})),
        "active": True,
    }
    for k, v in CONDITION_RULES.items()
    if k != "none"  # Skip "none" — it's the default
]

# ── Tag catalog — all known tags used in the system ──

TAGS = [
    # Allergens
    {"code": "peanut", "name_id": "Kacang", "category": "allergen", "description": "Alergi kacang tanah"},
    {"code": "shellfish", "name_id": "Kerang/udang", "category": "allergen", "description": "Alergi seafood"},
    {"code": "lactose", "name_id": "Laktosa", "category": "allergen", "description": "Intoleransi laktosa"},
    {"code": "dairy", "name_id": "Susu sapi", "category": "allergen", "description": "Alergi produk susu"},
    {"code": "egg", "name_id": "Telur", "category": "allergen", "description": "Alergi telur"},
    {"code": "gluten", "name_id": "Gluten", "category": "allergen", "description": "Intoleransi gluten"},
    {"code": "seafood", "name_id": "Makanan laut", "category": "allergen", "description": "Alergi makanan laut"},
    {"code": "fish", "name_id": "Ikan", "category": "allergen", "description": "Alergi ikan"},
    {"code": "soy", "name_id": "Kedelai", "category": "allergen", "description": "Alergi kedelai"},
    {"code": "wheat", "name_id": "Gandum", "category": "allergen", "description": "Alergi gandum"},
    {"code": "tree_nuts", "name_id": "Kacang pohon", "category": "allergen", "description": "Alergi kacang almond, walnut, dll"},
    {"code": "sulfite", "name_id": "Sulfit", "category": "allergen", "description": "Alergi sulfit"},
    
    # Health tags
    {"code": "high_sugar", "name_id": "Gula tinggi", "category": "health_tag", "description": "Kandungan gula tinggi"},
    {"code": "high_sodium", "name_id": "Natrium tinggi", "category": "health_tag", "description": "Kandungan garam tinggi"},
    {"code": "high_saturated_fat", "name_id": "Lemak jenuh tinggi", "category": "health_tag", "description": "Lemak jenuh tinggi"},
    {"code": "high_mercury", "name_id": "Merkuri tinggi", "category": "health_tag", "description": "Ikan dengan merkuri tinggi"},
    {"code": "high_purine", "name_id": "Purine tinggi", "category": "health_tag", "description": "Kandungan purin tinggi"},
    {"code": "high_protein", "name_id": "Protein tinggi", "category": "health_tag", "description": "Protein tinggi"},
    {"code": "high_carb_refined", "name_id": "Karbohidrat olahan", "category": "health_tag", "description": "Karbohidrat olahan tinggi"},
    {"code": "high_cholesterol", "name_id": "Kolesterol tinggi", "category": "health_tag", "description": "Kolesterol tinggi"},
    {"code": "high_caffeine", "name_id": "Kafein tinggi", "category": "health_tag", "description": "Kandungan kafein tinggi"},
    {"code": "high_potassium", "name_id": "Kalium tinggi", "category": "health_tag", "description": "Kalium tinggi"},
    {"code": "high_phosphorus", "name_id": "Fosfor tinggi", "category": "health_tag", "description": "Fosfor tinggi"},
    {"code": "trans_fat", "name_id": "Lemak trans", "category": "health_tag", "description": "Mengandung lemak trans"},
    {"code": "raw", "name_id": "Mentah", "category": "health_tag", "description": "Makanan mentah (risiko bakteri)"},
    {"code": "raw_egg", "name_id": "Telur mentah", "category": "health_tag", "description": "Mengandung telur mentah"},
    {"code": "raw_fish", "name_id": "Ikan mentah", "category": "health_tag", "description": "Ikan mentah (sushi/sashimi)"},
    {"code": "unpasteurized", "name_id": "Tidak pasteurisasi", "category": "health_tag", "description": "Produk tidak pasteurisasi"},
    {"code": "alcohol", "name_id": "Alkohol", "category": "health_tag", "description": "Mengandung alkohol"},
    {"code": "caffeine", "name_id": "Kafein", "category": "health_tag", "description": "Mengandung kafein"},
    {"code": "acidic", "name_id": "Asam", "category": "health_tag", "description": "Makanan asam"},
    {"code": "carbonated", "name_id": "Berkarbonasi", "category": "health_tag", "description": "Minuman berkarbonasi"},
    {"code": "cured", "name_id": "Diawetkan", "category": "health_tag", "description": "Makanan yang diawetkan/diasinkan"},
    {"code": "pickled", "name_id": "Acar", "category": "health_tag", "description": "Makanan acar/fermentasi"},
    {"code": "spicy", "name_id": "Pedas", "category": "health_tag", "description": "Makanan pedas"},
    {"code": "sour", "name_id": "Asam", "category": "health_tag", "description": "Makanan asam"},
    {"code": "fried", "name_id": "Goreng", "category": "health_tag", "description": "Makanan digoreng"},
    {"code": "organ_meat", "name_id": "Jeroan", "category": "health_tag", "description": "Organ dalam hewan"},
    {"code": "high_fructose", "name_id": "Fruktosa tinggi", "category": "health_tag", "description": "Gula fruktosa tinggi"},
    
    # Dietary preferences
    {"code": "meat", "name_id": "Daging", "category": "dietary_pref", "description": "Mengandung daging"},
    {"code": "chicken", "name_id": "Ayam", "category": "dietary_pref", "description": "Mengandung ayam"},
    {"code": "beef", "name_id": "Sapi", "category": "dietary_pref", "description": "Mengandung daging sapi"},
    {"code": "pork", "name_id": "Babi", "category": "dietary_pref", "description": "Mengandung babi"},
    {"code": "lamb", "name_id": "Kambing", "category": "dietary_pref", "description": "Mengandung daging kambing"},
    {"code": "milk", "name_id": "Susu", "category": "dietary_pref", "description": "Mengandung susu"},
    {"code": "cheese", "name_id": "Keju", "category": "dietary_pref", "description": "Mengandung keju"},
    {"code": "honey", "name_id": "Madu", "category": "dietary_pref", "description": "Mengandung madu"},
    {"code": "vegetarian", "name_id": "Vegetarian", "category": "dietary_pref", "description": "Cocok untuk vegetarian"},
    {"code": "vegan", "name_id": "Vegan", "category": "dietary_pref", "description": "Cocok untuk vegan"},
    {"code": "halal", "name_id": "Halal", "category": "dietary_pref", "description": "Makanan halal"},
    
    # Prep methods
    {"code": "buy_ready", "name_id": "Siap beli", "category": "prep_method", "description": "Makanan siap santap"},
    {"code": "simple_cook", "name_id": "Masak sederhana", "category": "prep_method", "description": "Perlu dimasak sederhana"},
    
    # Cooking methods
    {"code": "bakar", "name_id": "Bakar", "category": "cooking_method", "description": "Dimasak dengan cara dibakar"},
    {"code": "goreng", "name_id": "Goreng", "category": "cooking_method", "description": "Dimasak dengan cara digoreng"},
    {"code": "kukus", "name_id": "Kukus", "category": "cooking_method", "description": "Dimasak dengan cara dikukus"},
    {"code": "rebus", "name_id": "Rebus", "category": "cooking_method", "description": "Dimasak dengan cara direbus"},
    {"code": "tumis", "name_id": "Tumis", "category": "cooking_method", "description": "Dimasak dengan cara ditumis"},
]

# ── Cuisine types ──

CUISINE_TYPES = [
    {"code": "jawa", "name_id": "Jawa", "island_group": "Jawa"},
    {"code": "sunda", "name_id": "Sunda", "island_group": "Jawa"},
    {"code": "betawi", "name_id": "Betawi", "island_group": "Jawa"},
    {"code": "jakarta", "name_id": "Jakarta", "island_group": "Jawa"},
    {"code": "timur", "name_id": "Jawa Timur", "island_group": "Jawa"},
    {"code": "padang", "name_id": "Padang", "island_group": "Sumatra"},
    {"code": "sumatra", "name_id": "Sumatra", "island_group": "Sumatra"},
    {"code": "aceh", "name_id": "Aceh", "island_group": "Sumatra"},
    {"code": "bali", "name_id": "Bali", "island_group": "Nusa Tenggara"},
    {"code": "nusa_tenggara", "name_id": "Nusa Tenggara", "island_group": "Nusa Tenggara"},
    {"code": "kalimantan", "name_id": "Kalimantan", "island_group": "Kalimantan"},
    {"code": "sulawesi", "name_id": "Sulawesi", "island_group": "Sulawesi"},
    {"code": "maluku", "name_id": "Maluku", "island_group": "Maluku"},
    {"code": "papua", "name_id": "Papua", "island_group": "Papua"},
    {"code": "indonesia", "name_id": "Indonesia", "island_group": None},
    {"code": "chinese_indonesian", "name_id": "Chinese-Indonesian", "island_group": None},
]


async def seed_admin_tables():
    """Seed the admin-control tables idempotently."""
    async with async_session_factory() as db:
        # Check if conditions already seeded
        existing = await db.execute(
            __import__("sqlalchemy").select(HealthCondition).limit(1)
        )
        if existing.scalar_one_or_none():
            print("→ Health conditions already seeded")
        else:
            for cond in HEALTH_CONDITIONS:
                db.add(HealthCondition(**cond))
            await db.flush()
            print(f"→ Seeded {len(HEALTH_CONDITIONS)} health conditions")

        # Check if tags already seeded
        existing = await db.execute(
            __import__("sqlalchemy").select(TagCatalog).limit(1)
        )
        if existing.scalar_one_or_none():
            print("→ Tag catalog already seeded")
        else:
            for tag in TAGS:
                db.add(TagCatalog(**tag))
            await db.flush()
            print(f"→ Seeded {len(TAGS)} tags")

        # Check if cuisine types already seeded
        existing = await db.execute(
            __import__("sqlalchemy").select(CuisineType).limit(1)
        )
        if existing.scalar_one_or_none():
            print("→ Cuisine types already seeded")
        else:
            for ct in CUISINE_TYPES:
                db.add(CuisineType(**ct))
            await db.flush()
            print(f"→ Seeded {len(CUISINE_TYPES)} cuisine types")

        await db.commit()
        print("✓ Admin tables seeded successfully")


if __name__ == "__main__":
    asyncio.run(seed_admin_tables())