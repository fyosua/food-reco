# Architecture — FoodReco

## Component diagram

```
Cloudflare edge (food.yosuaf.com) → cloudflared Tunnel → Pi 5
  nginx (:8080) → /api/* → FastAPI (uvicorn)
                → /     → React static (Vite build)
  FastAPI → SQLite (WAL mode) + OpenRouter (DeepSeek V4 Flash / Gemini Flash)
  Crawler (separate container, scheduled, isolated from serving path)
```

## Data flow

1. User authenticates → sets condition + sex + city + taste profile
2. Backend resolves city → price_tier multiplier (province or Jabodetabek)
3. Rules layer computes macro/calorie targets + forbidden tags
4. Stage 1: Hard gates filter out allergens, condition-forbidden, out-of-budget items
5. Stage 2: Preference scorer ranks remaining candidates by taste match
6. Top-N candidates per slot → LLM assembles into a day plan (compact JSON)
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

## Performance optimizations

### SQLite WAL mode + pragmas
Applied at connection time in `backend/app/core/database.py` via `_enable_wal()`:
- `PRAGMA journal_mode=WAL` — Write-Ahead Logging for concurrent reads
- `PRAGMA synchronous=NORMAL` — balances durability vs. write speed
- `PRAGMA cache_size=-8000` — 8 MB page cache
- `PRAGMA busy_timeout=5000` — 5 s wait before failing on locked DB
- `pool_pre_ping=True` — verify connections before use (stale connection detection)

### Shared HTTP client with keep-alive
Module-level `httpx.AsyncClient` in `backend/app/llm/client.py`:
- Reused across all LLM requests to avoid connection overhead per call
- `max_keepalive_connections=5`, `keepalive_expiry=30.0`
- Explicit `close_http_client()` on app shutdown via lifespan handler

### Provider sorting
OpenRouter requests include `"provider": {"sort": "latency"}` (default in `settings.llm_provider_sort`), routing to the fastest available provider for the model.

### Batch food lookups
All food queries use `WHERE id IN (...)` via SQLAlchemy `.in_()` — single round-trip instead of N individual queries, both in plan generation (`backend/app/api/plan.py`) and data endpoints (`backend/app/api/data.py`).

### Composite indexes on meal_history
Three composite indexes defined in `backend/app/models/meal.py`:
- `ix_meal_history_user_served` on `(user_id, served_at)` — history & non-repetition queries
- `ix_meal_history_user_plan` on `(user_id, plan_id)` — chat adjustment lookups
- `ix_meal_history_user_cond` on `(user_id, condition, sex, city_id)` — preference-constrained history scans

### Compact JSON prompt
Plan candidates sent to LLM contain only essential fields — `id`, `name`, `calories`, `protein_g`, `carbs_g`, `fat_g`, `tags`, `cuisine`, `prep`. Unused fields (price, source, image, verification status, etc.) are dropped to minimise token usage. See `backend/app/api/plan.py` line ~179.

## Admin panel

8-tab CRUD interface at `/admin` (frontend) backed by `backend/app/api/admin.py`:

| Tab Key    | Label         | Icon | Resource                  |
|------------|---------------|------|---------------------------|
| makanan    | Makanan       | 🍽️  | FoodItem CRUD             |
| provinsi   | Provinsi      | 🗺️  | Province management       |
| kota       | Kota          | 🏙️  | City CRUD                 |
| override   | Override      | 💰  | Price tier overrides      |
| users      | Users         | 👥  | User listing + role/delete|
| kondisi    | Kondisi       | ❤️  | HealthCondition CRUD      |
| tags       | Tags          | 🏷️  | TagCatalog CRUD           |
| masakan    | Masakan       | 🍳  | CuisineType CRUD          |

All endpoints are under `/api/admin/` and require `role == "admin"`. The frontend has full create/edit/delete modals for each resource with server-side validation and pagination.

## Dynamic conditions

Health conditions are loaded from the database at plan-generation time via the `HealthCondition` SQLAlchemy model (`backend/app/models/health_condition.py`). The `CONDITION_RULES` dict in `backend/app/reco/rules.py` is the canonical source of truth for forbidden tags, macros, and constraints — and is seeded into DB via `backend/scripts/seed_admin_tables.py`. Admins can add, edit, or deactivate conditions through the admin panel without code changes.

## Dataset

- **573 unique food items** (deduped from 2,154 raw entries via `backend/scripts/dedup_foods_v2.py`)
- **38 provinces** with per-province price multipliers
- **16 health conditions** (excluding "none" default), including 4 added: Breastfeeding, High Cholesterol, Osteoporosis, PCOS
- Admin-managed: 51+ tags across 5 categories (allergen, health_tag, dietary_pref, prep_method, cooking_method), 16 cuisine types, plus provinces/cities/price tiers

## Authentication & user management

- **Registration disabled** — the frontend `/register` route shows a "Pendaftaran Ditutup" page with a lock icon
- **New users created via script:** `backend/scripts/create_user.py`
  ```
  docker exec infra-backend-1 python /app/scripts/create_user.py <email> <password> [--admin]
  ```
- **Password change** — dedicated `ChangePassword.tsx` page at `/change-password` route
- Standard session-based auth with bcrypt password hashing

## Frontend features

### Plan.tsx — loading skeleton
While the plan is being generated, a skeleton loader using `animate-pulse` classes renders placeholder blocks for each meal slot — mimicking the final card layout with grey shimmer animations.

### Pulse animation — plan adjustment
The chat button (ChatPanel) has a CSS `animate-[pulse_2s_ease-in-out_infinite]` animation that subtly glows when a plan is active, drawing attention to the "Sesuaikan" (adjust) feature.

### Suggestion chips — chat panel
6 predefined suggestion chips in `ChatPanel.tsx` help users quickly request adjustments:
- "Ganti lauk dengan ayam", "Bikin lebih pedas", "Tambah sayur", "Kurangi porsi karbohidrat", "Ganti dengan menu yang lebih murah", "Saya ingin menu Sunda"

### Home page — 3-step onboarding
A 3-column feature showcase on the home page (`Home.tsx`):
1. 🎯 **Preferences First** — rekomendasi berdasarkan selera
2. 🏙️ **Local Pricing** — harga disesuaikan dengan kota
3. 🔄 **Never Boring** — variasi menu setiap hari

### History — grouped by plan_id
The history page (`History.tsx`) groups entries by date, then sub-groups by `plan_id` within each date. Each plan group gets a label showing how many items it contains. This makes it easy to distinguish multiple plan generations on the same day.

### Budget input — plan page
A "Budget Harian (Rp)" text input with `inputMode="numeric"` on the plan page (`Plan.tsx`) allows users to set a daily budget before generating. The value is formatted with Indonesian locale separators and sent as `daily_budget_idr` in the plan request.