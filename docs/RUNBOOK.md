# Runbook — FoodReco Operations

## Deployment

Auto-deployed on every merge to `main`:

1. GitHub Actions builds multi-arch (`linux/amd64`, `linux/arm64`) images
2. Images pushed to GHCR with tags: `latest` and `${{ github.sha }}`
3. Self-hosted runner on Pi 5 (label `pi5`) pulls new images and restarts

## Rollback

```bash
# Pin compose to a previous SHA
docker compose -f infra/docker-compose.yml pull
# Edit docker-compose.yml to use a specific SHA tag
docker compose -f infra/docker-compose.yml up -d
```

## Local dev

```bash
# Backend
cd backend
cp ../.env.example .env  # Edit with your OpenRouter key
uv run alembic upgrade head
uv run python -m app.seed
uv run uvicorn app.main:app --reload

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

## Crawl jobs

- Crawler runs as a separate container on a cron schedule (isolated from serving path)
- Off-peak scheduling to avoid competing with request traffic
- Monitor: `docker compose logs crawler`

## Health check

```bash
curl https://food.yosuaf.com/api/health
# → {"status":"ok","app":"FoodReco","version":"0.1.0"}
```

## Troubleshooting

| Issue | Check |
|---|---|
| Backend won't start | Check `.env` has `OPENROUTER_API_KEY` |
| DB errors | Delete `data/food_reco.db`, re-run migrations + seed |
| Frontend blank page | Check browser console for CORS or API errors |
| Cloudflare tunnel down | `docker compose logs cloudflared` on the Pi |