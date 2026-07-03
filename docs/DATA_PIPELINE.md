# Data Pipeline — Crawl + Verify

## Overview

Food data is acquired through a **crawl + verify** pipeline. The key design
principle: **no unverified data ever reaches a user.** Every `food_item` starts
with `active=0` and only flips to `1` after passing verification.

## Pipeline stages

```
[1 DISCOVER] → [2 FETCH] → [3 PARSE] → [4 NORMALIZE] → [5 VERIFY] → [6 STATUS] → [7 PROMOTE]
```

1. **DISCOVER** — Whitelisted sources from `crawl_source` table (robots.txt & ToS respected)
2. **FETCH** — httpx GET with polite delay, rate-limited, UA identifies the bot
3. **PARSE** — Extract dish name, ingredients, nutrition, price, image URL
4. **NORMALIZE** — Convert units to grams/IDR, dedupe by name+hash
5. **VERIFY** — Cross-check nutrition vs TKPI within tolerance; price sanity; allergen/tag classification
6. **STATUS** — Pass → `auto_verified`; ambiguous → `human_verified`; fail → `rejected` (never active)
7. **PROMOTE** — `auto_verified` (high confidence) or `human_verified` → `active=1`

## Source whitelist

- TKPI / Kemenkes food composition data (authoritative reference)
- Reputable Indonesian recipe sites with permissive terms
- Public market-price references for indicative national base prices
- Only permissively-licensed / own-shot / CC images

## Verification rules

- **Nutrition tolerance:** ±15% of nearest TKPI reference (tunable)
- **Price sanity:** Base price ranges must fall inside configured bounds per category
- **Allergen/tag:** Keyword + ingredient rules; pregnancy tags double-checked

## Privacy

- Full crawled dataset is **private** — never committed to the public repo
- Provenance mandatory: every `food_item` keeps `source_url` + `crawl_record` link