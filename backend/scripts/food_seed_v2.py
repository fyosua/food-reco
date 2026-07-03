"""
Seed script — insert ~200 diverse Indonesian foods into the database.
Run inside container: python3 /app/scripts/food_seed_v2.py
"""
import json
import sqlite3
from food_seed_data import FOODS

DB_PATH = "/app/data/food_reco.db"

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

# Check existing count
cur.execute("SELECT COUNT(*) FROM food_item")
existing = cur.fetchone()[0]
print(f"Existing food items: {existing}")

# Insert each food
inserted = 0
skipped = 0
for food in FOODS:
    # Check if name already exists
    cur.execute("SELECT id FROM food_item WHERE name_id = ?", (food[0],))
    if cur.fetchone():
        skipped += 1
        continue

    cur.execute(
        """
        INSERT INTO food_item
            (name_id, name_en, category, prep_type, calories, protein_g, carbs_g, fat_g, fiber_g,
             price_pasar_min, price_pasar_max, tags_json, cuisine_tags_json, active,
             verification_status, source_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'auto_verified', 'seed_v2')
        """,
        (
            food[0],          # name_id
            None,             # name_en
            food[1],          # category
            food[2],          # prep_type
            food[3],          # calories
            food[4],          # protein_g
            food[5],          # carbs_g
            food[6],          # fat_g
            food[7],          # fiber_g
            food[8],          # price_pasar_min
            food[9],          # price_pasar_max
            json.dumps(food[10]),  # tags_json
            json.dumps(food[11]),  # cuisine_tags_json
        ),
    )
    inserted += 1

conn.commit()

# Final count
cur.execute("SELECT COUNT(*) FROM food_item")
total = cur.fetchone()[0]
cur.execute("SELECT COUNT(*) FROM food_item WHERE active=1")
active = cur.fetchone()[0]
cur.execute("SELECT COUNT(*) FROM food_item WHERE cuisine_tags_json LIKE '%bali%'")
bali_count = cur.fetchone()[0]
cur.execute("SELECT COUNT(*) FROM food_item WHERE cuisine_tags_json LIKE '%jakarta%'")
jakarta_count = cur.fetchone()[0]

conn.close()

print(f"\nInserted: {inserted} new items")
print(f"Skipped: {skipped} (already exist)")
print(f"Total food items: {total}")
print(f"Active: {active}")
print(f"Bali-cuisine foods: {bali_count}")
print(f"Jakarta-cuisine foods: {jakarta_count}")

print(f"\nFirst 5 items:")
for f in FOODS[:5]:
    print(f"  {f[0]} ({f[1]}) — cuisine: {f[11]}")