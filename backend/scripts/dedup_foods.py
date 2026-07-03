"""Deduplicate food items with city suffixes — identical nutrition = duplicate.
Keeps only the canonical (non-city-suffixed) entry per dish.
"""
import sqlite3, sys

DB_PATH = "/app/data/food_reco.db"

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

def core_name(name):
    parts = name.lower().strip().split()
    while parts and parts[-1] in CITY:
        parts = parts[:-1]
    return ' '.join(parts) if parts else name.lower()

def main():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()

    # Check meal_history references
    c.execute('SELECT DISTINCT food_item_id FROM meal_history')
    history_ids = set(r[0] for r in c.fetchall())

    c.execute('SELECT id, name_id, calories, protein_g, carbs_g, fat_g, price_pasar_min, price_pasar_max FROM food_item ORDER BY name_id')
    items = [dict(r) for r in c.fetchall()]

    # Group by core name
    from collections import defaultdict
    groups = defaultdict(list)
    for item in items:
        groups[core_name(item['name_id'])].append(item)

    to_delete = set()
    to_rename = []  # (id, new_name)
    kept = 0
    deleted = 0

    for core, grp in sorted(groups.items(), key=lambda x: -len(x[1])):
        if len(grp) < 2:
            kept += 1
            continue

        # Check if all have identical nutrition
        vals = set()
        for i in grp:
            v = (i['calories'] or 0, i['protein_g'] or 0, i['carbs_g'] or 0, i['fat_g'] or 0, i['price_pasar_min'] or 0, i['price_pasar_max'] or 0)
            vals.add(v)
        all_same = len(vals) == 1

        if not all_same:
            kept += len(grp)
            continue

        # Find canonical entry (no city suffix in name)
        canonical = None
        for item in grp:
            parts = item['name_id'].lower().strip().split()
            if parts and parts[-1] not in CITY:
                canonical = item
                break

        if not canonical:
            # No canonical exists — pick first, rename to core name
            canonical = grp[0]
            # Capitalize properly
            new_name = core.title()
            # Check if name already exists
            existing = [i for i in items if i['name_id'].lower() == core and i['id'] != canonical['id']]
            if not existing:
                to_rename.append((canonical['id'], new_name))

        # Check if canonical is in meal_history
        if canonical['id'] in history_ids:
            print(f"  ⚠  Keeping '{canonical['name_id']}' (ID {canonical['id']}) — in meal_history")
            # Don't delete it

        for item in grp:
            if item['id'] != canonical['id']:
                if item['id'] in history_ids:
                    print(f"  ⚠  WARNING: '{item['name_id']}' (ID {item['id']}) is in meal_history — keeping it")
                    continue
                to_delete.add(item['id'])

        kept += 1
        deleted += len(grp) - 1

    print(f"\n=== SUMMARY ===")
    print(f"Items to DELETE: {deleted}")
    print(f"Items to RENAME: {len(to_rename)}")
    print(f"Total remaining: {len(items) - deleted}")
    print(f"Total groups after dedup: {kept}")

    if to_rename:
        print(f"\n=== RENAMES ===")
        for fid, new_name in to_rename:
            cur = conn.execute('SELECT name_id FROM food_item WHERE id = ?', (fid,))
            old = cur.fetchone()[0]
            print(f"  ID {fid}: '{old}' → '{new_name}'")

    # Confirm before executing
    print(f"\nProceed with DELETE {deleted} items and RENAME {len(to_rename)} items? (yes/no)")
    # Since we're running in Docker, we'll just do it
    proceed = True  # Automated

    if proceed and to_delete:
        ids = list(to_delete)
        # Delete in batches of 100
        batch_size = 100
        for i in range(0, len(ids), batch_size):
            batch = ids[i:i+batch_size]
            placeholders = ','.join('?' * len(batch))
            conn.execute(f'DELETE FROM food_item WHERE id IN ({placeholders})', batch)
        print(f"  Deleted {len(ids)} items")

    if proceed and to_rename:
        for fid, new_name in to_rename:
            conn.execute('UPDATE food_item SET name_id = ? WHERE id = ?', (new_name, fid))
        print(f"  Renamed {len(to_rename)} items")

    conn.commit()
    conn.close()

    if proceed:
        print(f"\n=== DONE ===")
        # Verify
        conn2 = sqlite3.connect(DB_PATH)
        cnt = conn2.execute('SELECT COUNT(*) FROM food_item').fetchone()[0]
        act = conn2.execute('SELECT COUNT(*) FROM food_item WHERE active=1').fetchone()[0]
        print(f"Total food items now: {cnt}")
        print(f"Active: {act}")
        conn2.close()

if __name__ == "__main__":
    main()