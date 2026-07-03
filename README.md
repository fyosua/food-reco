# Indonesia Healthy Food Recommendation Web App

**Local, budget-aware, non-repetitive meal planning — powered by your taste, informed by nutrition.**

**`https://food.yosuaf.com`**

---

## What this is

A free web app that generates daily meal plans for Indonesia — personalized by province/city pricing, your taste profile, health conditions, and budget. Unlike generic diet apps (Sirka, Fita), this is:

- **Local** — prices adjust to your city's province multiplier (38 provinces + Jabodetabek metro zone)
- **Preference-first** — health rules are absolute gates, but taste (cuisines, spice, liked ingredients) decides what's chosen among safe options
- **Non-repetitive** — variety window avoids repeats within 7 days
- **Free** — no paywall; LLM costs covered by per-user daily caps

## Tech stack

| Layer | Stack |
|-------|-------|
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS |
| Backend | FastAPI + Pydantic v2 + SQLAlchemy 2.0 + Alembic |
| Database | SQLite (WAL mode) |
| LLM | DeepSeek V4 Flash (primary) / Gemini Flash (failover) via OpenRouter |
| Host | Raspberry Pi 5 (8GB), Docker Compose, Cloudflare Tunnel |
| CI/CD | GitHub Actions → multi-arch arm64 → GHCR → auto-deploy on merge to main |

## Quick start (local dev)

```bash
cp .env.example .env
# Edit .env with your OpenRouter API key
docker compose -f infra/docker-compose.yml up -d
```

[Full architecture →](docs/ARCHITECTURE.md) · [API reference →](docs/API.md) · [Kanban →](docs/KANBAN.md)

## Security note

- Public repo: portfolio-friendly code only
- Private data: full crawled dataset, pricing data, and secrets are **never committed**
- Auth: argon2 passwords, httpOnly JWT cookies, per-user rate limits, CSRF protection
- See [CONTRIBUTING.md](CONTRIBUTING.md) and [PRD §9](PRD_TECHNICAL_HERMES.md) for the full security and privacy stance

---

*Built autonomously by `foodreco-dev` · Owner: Yosua (ferdianyosua@gmail.com)*