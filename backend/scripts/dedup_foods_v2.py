"""Deduplicate food items with city suffixes — part 2.
This handles the case where a generic item has different nutrition than city variants.
City variants with identical nutrition among themselves should be deduped to one entry.
Also handles "Kulon Progo" (two words) as a city suffix.
"""
import sqlite3

DB_PATH = "/app/data/food_reco.db"

# Two-word city names that need handling
TWO_WORD_CITIES = {
    "kulon", "progo",  # -> Kulon Progo
}

# Single-word city suffixes
CITY = [
    'ajibarang','ambarawa','ambengan','bangkalan','bangkong','banjarnegara',
    'bantul','banyumas','banyuwangi','batang','blitar','bojonegoro','boyolali',
    'brebes','cilacap','gombong','grabag','jember','jepara','jombang','karangan',
    'karanganyar','kebumen','kediri','kendal','klaten','kroya','kudus','kutoarjo',
    'lamongan','lumajang','madiun','madura','magelang','magetan','majenang',
    'malang','meneng','mojokerto','mungkid','muntilan','nanggulan','ngawi',
    'pacitan','pamekasan','parakan','pasuruan','pekalongan','pemalang','ponorogo',
    'pring','probolinggo','purbalingga','purwokerto','purworejo','salaman',
    'salatiga','sampang','secang','semarang','sidareja','slawi','sleman',
    'sokaraja','sragen','sukoharjo','sumenep','surabaya','tegal','temanggung',
    'trenggalek','tuban','ungaran','wangon','wates','welahan','wonogiri',
    'wonosari','wonosobo',
]

def has_city_suffix(name):
    """Check if the name ends with a city suffix (handling multi-word cities)."""
    parts = name.lower().strip().split()
    if not parts:
        return False
    # Check for two-word city ("Kulon Progo")
    if len(parts) >= 2:
        if parts[-1] == "progo" and parts[-2] == "kulon":
            return True
    # Check single-word city
    return parts[-1] in CITY

def strip_city(name):
    """Remove the city suffix from a name."""
    parts = name.lower().strip().split()
    if not parts:
        return name
    # Handle "Kulon Progo" (two words)
    if len(parts) >= 2 and parts[-1] == "progo" and parts[-2] == "kulon":
        parts = parts[:-2]
    elif parts[-1] in CITY:
        parts = parts[:-1]
    return ' '.join(parts) if parts else name.lower()

def main():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()

    c.execute('SELECT DISTINCT food_item_id FROM meal_history')
    history_ids = set(r[0] for r in c.fetchall())

    # Get all items that have a city suffix
    c.execute('SELECT id, name_id, calories, protein_g, carbs_g, fat_g, price_pasar_min, price_pasar_max, cuisine_tags_json, tags_json FROM food_item ORDER BY name_id')
    items = [dict(r) for r in c.fetchall()]

    # Separate items into canonical (no city) and variant (has city suffix)
    canonical_map = {}  # core_name -> item
    variant_groups = {}  # core_name -> [items with city suffix]

    for item in items:
        if has_city_suffix(item['name_id']):
            core = strip_city(item['name_id'])
            if core not in variant_groups:
                variant_groups[core] = []
            variant_groups[core].append(item)
        else:
            core = item['name_id'].lower().strip()
            canonical_map[core] = item

    to_delete = set()
    to_rename = []

    print("=== ANALYSIS ===")
    for core, variants in sorted(variant_groups.items(), key=lambda x: -len(x[1])):
        if len(variants) < 2:
            # Single variant — check if a canonical exists
            existing = canonical_map.get(core)
            if existing:
                v = variants[0]
                if v['id'] not in history_ids:
                    print(f"  ✓ '{core}' (ID {existing['id']}) exists — deleting single variant '{v['name_id']}' (ID {v['id']})")
                    to_delete.add(v['id'])
                else:
                    print(f"  ⚠  '{v['name_id']}' (ID {v['id']}) in history — keeping")
            continue

        # Check if all variants have identical nutrition
        vals = set()
        for v in variants:
            vals.add((v['calories'] or 0, v['protein_g'] or 0, v['carbs_g'] or 0, v['fat_g'] or 0))
        all_same = len(vals) == 1

        if not all_same:
            print(f"  ⚠  '{core}' has {len(variants)} variants with DIFFERENT nutrition — skipping")
            continue

        # Check if a canonical version already exists
        existing = canonical_map.get(core)
        if existing:
            # Canonical exists — keep it, delete all city variants
            print(f"  ✓ '{core}' (ID {existing['id']}) exists — deleting {len(variants)} city variants")
            for v in variants:
                if v['id'] in history_ids:
                    print(f"    ⚠  ID {v['id']} '{v['name_id']}' in history — keeping")
                    continue
                to_delete.add(v['id'])
        else:
            # No canonical — keep the first variant, rename it to canonical name
            keep = variants[0]
            print(f"  ➜ '{core}' — keeping ID {keep['id']} '{keep['name_id']}', renaming to '{core.title()}', deleting {len(variants)-1}")
            to_rename.append((keep['id'], core.title()))
            for v in variants[1:]:
                if v['id'] in history_ids:
                    print(f"    ⚠  ID {v['id']} '{v['name_id']}' in history — keeping")
                    continue
                to_delete.add(v['id'])

    print(f"\n=== SUMMARY ===")
    print(f"To delete: {len(to_delete)}")
    print(f"To rename: {len(to_rename)}")

    # Execute
    if to_delete:
        ids = list(to_delete)
        batch_size = 100
        for i in range(0, len(ids), batch_size):
            batch = ids[i:i+batch_size]
            placeholders = ','.join('?' * len(batch))
            conn.execute(f'DELETE FROM food_item WHERE id IN ({placeholders})', batch)
        print(f"Deleted {len(ids)} items")

    if to_rename:
        for fid, new_name in to_rename:
            conn.execute('UPDATE food_item SET name_id = ? WHERE id = ?', (new_name, fid))
        print(f"Renamed {len(to_rename)} items")

    conn.commit()
    conn.close()

    # Verify
    conn2 = sqlite3.connect(DB_PATH)
    cnt = conn2.execute('SELECT COUNT(*) FROM food_item').fetchone()[0]
    act = conn2.execute('SELECT COUNT(*) FROM food_item WHERE active=1').fetchone()[0]
    print(f"\nTotal food items: {cnt}")
    print(f"Active: {act}")

    # Show remaining Soto dishes
    c2 = conn2.cursor()
    c2.execute("SELECT name_id FROM food_item WHERE name_id LIKE 'Soto%' ORDER BY name_id")
    soto = [r[0] for r in c2.fetchall()]
    print(f"\nSoto dishes: {len(soto)}")
    for s in soto:
        print(f"  {s}")
    conn2.close()

if __name__ == "__main__":
    main()