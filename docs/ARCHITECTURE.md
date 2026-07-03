# Architecture — FoodReco

## Component diagram

```
Cloudflare edge (food.yosuaf.com) → cloudflared Tunnel → Pi 5
  nginx (:8080) → /api/* → FastAPI (uvicorn)
                → /     → React static (Vite build)
  FastAPI → SQLite (WAL) + OpenRouter (DeepSeek V4 Flash / Gemini Flash)
  Crawler (separate container, scheduled, isolated from serving path)
```

## Data flow

1. User authenticates → sets condition + sex + city + taste profile
2. Backend resolves city → price_tier multiplier (province or Jabodetabek)
3. Rules layer computes macro/calorie targets + forbidden tags
4. Stage 1: Hard gates filter out allergens, condition-forbidden, out-of-budget items
5. Stage 2: Preference scorer ranks remaining candidates by taste match
6. Top-N candidates per slot → LLM assembles into a day plan (JSON)
7. Budget computed deterministically from dataset IDs × multiplier
8. Plan persisted to meal_history; user can rate and chat-adjust

## Preference two-stage model

- **Stage 1 — Hard gates (absolute):** allergens, hard dislikes, condition-forbidden, out-of-budget, wrong prep type
- **Stage 2 — Weighted scoring (deterministic):** liked ingredients, cuisine affinity, spice fit, prep fit, variety penalty, budget pressure
- LLM receives already-safe, already-ranked candidates — never invents dishes or prices

## Pricing model (v2.1 — province-based)

- One national base price per food item × city's resolved price_tier multiplier
- 38 provinces + Jabodetabek override for Greater Jakarta metro cities
- Multipliers in `data/provinces.csv` and `data/price_tier_overrides.csv`
- Nutrition reference: TKPI (Tabel Komposisi Pangan Indonesia)