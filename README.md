# Indonesia Healthy Food Recommendation Web App

**Local, budget-aware, non-repetitive meal planning — powered by your taste, informed by nutrition.**

**`https://food.yosuaf.com`** · API: `https://foodapi.yosuaf.com`

---

## What this is

A free web app that generates daily meal plans for Indonesia — personalized by province/city pricing, your taste profile, health conditions, and budget. Unlike generic diet apps (Sirka, Fita), this is:

- **Local** — prices adjust to your city's province multiplier (38 provinces + Jabodetabek metro zone)
- **Preference-first** — health rules are absolute gates, but taste (cuisines, spice, liked ingredients) decides what's chosen among safe options
- **Non-repetitive** — variety window avoids repeats within 7 days
- **Free** — no paywall; LLM costs covered by per-user daily caps

## Features

- **Two-stage preference engine** — hard health gates (allergens, conditions) → weighted taste scoring (liked ingredients, cuisines, spice, prep type)
- **16 health conditions** — Diabetes, Hypertension, Heart Disease, Kidney Disease, Weight Loss, Lactose Intolerant, Vegan, Vegetarian, Ulcer/GERD, Gout, Anemia, Pregnancy, Breastfeeding, High Cholesterol, Osteoporosis, PCOS
- **573 curated food items** — verified, tagged with allergens, cuisines, and nutrition data (TKPI-referenced)
- **Province-based pricing** — base price × province multiplier (38 provinces + Jabodetabek override)
- **Chat adjustment** — converse with the LLM to refine your plan
- **Meal feedback** — 👍/👎 ratings drive implicit learning
- **Admin panel** — 8 CRUD tabs: Foods, Provinces, Cities, Price Tiers, Users, Health Conditions, Tags, Cuisine Types
- **Mobile-responsive** — Tailwind green theme, works on phone and desktop

## Tech stack

| Layer | Stack |
|-------|-------|
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS |
| Backend | FastAPI + Pydantic v2 + SQLAlchemy 2.0 + Alembic |
| Database | SQLite (WAL mode — `synchronous=NORMAL`, `cache_size=-8000`, `busy_timeout=5000`) |
| LLM | DeepSeek V4 Flash (primary) / Gemini Flash (failover) via OpenRouter |
| Container | Docker Compose, multi-arch (arm64) |
| Host | Raspberry Pi 5 (8GB), Cloudflare Tunnel |
| CI/CD | GitHub Actions → multi-arch arm64 → GHCR → auto-deploy on merge to main |

## Quick start (local dev)

```bash
git clone https://github.com/fyosua/food-reco.git
cd food-reco
cp .env.example .env
# Edit .env with your OpenRouter API key and JWT secret
docker compose -f infra/docker-compose.yml up -d
```

The backend auto-seeds on first run: admin user, 38 provinces, 10 sample cities, 573 food items, 16 health conditions, 57 tags, 16 cuisine types.

### Creating users (registration is disabled for public access)

```bash
# Create a regular user
docker exec infra-backend-1 python /app/scripts/create_user.py email@example.com password123

# Create an admin user
docker exec infra-backend-1 python /app/scripts/create_user.py admin@example.com password123 --admin
```

## Docs

[Full architecture →](docs/ARCHITECTURE.md) · [API reference →](docs/API.md) · [Kanban →](docs/KANBAN.md) · [Runbook →](docs/RUNBOOK.md)

## Performance optimizations

- **SQLite WAL mode** — concurrent reads, no writer lock contention
- **Shared httpx client** — module-level keep-alive (5 connections, 30s expiry) to OpenRouter
- **provider.sort: latency** — OpenRouter auto-selects fastest provider per request
- **Batch food lookups** — `WHERE id IN (...)` kills N+1 queries in plan + chat
- **Composite indexes** — `meal_history` (user_id+served_at), (user_id+plan_id), (user_id+condition+sex+city_id)
- **Compact LLM prompt** — drops unused fields, sends deduplicated candidate pool
- **Frontend loading skeleton** — animated pulse placeholders during plan generation

## Security note

- **Public repo:** portfolio-friendly code only
- **Private data:** full crawled dataset, pricing data, and secrets are **never committed**
- **Auth:** argon2 passwords, httpOnly JWT cookies, per-user rate limits, CSRF protection
- **PII:** minimal collection — email + hashed password + taste preferences only
- See [CONTRIBUTING.md](CONTRIBUTING.md) and [PRD §9](PRD_TECHNICAL_HERMES.md) for the full security and privacy stance

---

*Built autonomously by `foodreco-dev` · Owner: Yosua*