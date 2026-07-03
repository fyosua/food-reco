# Runbook — FoodReco Operations

## Overview

FoodReco runs on a **Raspberry Pi 5 (8GB)** behind a Cloudflare Tunnel.
All services are containerized via Docker Compose.

## Architecture

```
Cloudflare Edge (food.yosuaf.com)
    │
    ▼ Cloudflare Tunnel (cloudflared)
    │
    ▼ nginx (:8080) → /api/* → backend (:8000)
    │                → /      → static frontend
    │
    ▼ backend (FastAPI + SQLite)
    ▼ crawler (scheduled, `docker compose --profile crawler run`)
```

## Services

| Service | Container | Port | Purpose |
|---------|-----------|------|---------|
| nginx | `food-reco-nginx` | 8080 | Reverse proxy + static files |
| backend | `food-reco-backend` | 8000 | FastAPI application |
| crawler | `food-reco-crawler` | — | On-demand data pipeline |
| cloudflared | `cloudflared` | — | Outbound tunnel to Cloudflare |

## Deploy

### Automatic (CI/CD)

Merge to `main` → GitHub Actions builds multi-arch images → pushes to GHCR →
self-hosted Pi runner pulls & restarts.

### Manual

```bash
# On the Pi, from the repo root:
cd ~/food-reco/infra
docker compose pull
docker compose up -d
```

### Rollback

```bash
# Pin to a specific SHA and restart
cd ~/food-reco/infra
TAG=<previous-commit-sha> docker compose up -d
```

Example pinning:
```bash
docker compose pull
docker compose up -d
# If issues:
docker compose down
docker compose up -d
```

## Initial Setup on Pi

### Prerequisites

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Install GitHub self-hosted runner
mkdir -p ~/actions-runner && cd ~/actions-runner
curl -o actions-runner-linux-arm64.tar.gz -L \
  https://github.com/actions/runner/releases/latest/download/actions-runner-linux-arm64-2.322.0.tar.gz
tar xzf actions-runner-linux-arm64.tar.gz
./config.sh --url https://github.com/fyosua/food-reco --token <token>
sudo ./svc.sh install
sudo ./svc.sh start

# Clone repo
cd ~
git clone https://github.com/fyosua/food-reco.git
cd food-reco

# Create .env file
cp .env.example .env
# Edit .env with real secrets:
#   OPENROUTER_API_KEY, JWT_SECRET_KEY, TUNNEL_TOKEN
```

### Cloudflare Tunnel

```bash
# Install cloudflared
sudo apt update && sudo apt install cloudflared

# Authenticate and create tunnel
cloudflared tunnel login
cloudflared tunnel create food-reco

# Configure DNS
cloudflared tunnel route dns food-reco food.yosuaf.com

# The tunnel token is stored in .env as TUNNEL_TOKEN
# On first run, the tunnel will start automatically via docker compose
```

## Crawler Operations

### Run on-demand

```bash
cd ~/food-reco/infra
docker compose --profile crawler run --rm crawler python -m app.crawler.run
```

### Schedule via cron

```bash
# Run crawler daily at 2 AM
crontab -e
# Add:
0 2 * * * cd ~/food-reco/infra && docker compose --profile crawler run --rm crawler python -m app.crawler.run
```

## Monitoring

### Health check

```bash
curl http://localhost:8080/api/health
# Expected: {"status":"ok"}
```

### View logs

```bash
# All services
docker compose -f ~/food-reco/infra/docker-compose.yml logs -f

# Specific service
docker compose -f ~/food-reco/infra/docker-compose.yml logs -f backend

# Tail (last 50 lines)
docker compose -f ~/food-reco/infra/docker-compose.yml logs --tail=50 backend
```

### Check resource usage

```bash
docker stats
```

## App Administration

### Seed admin user

The admin user is seeded automatically from `.env` variables:
```
ADMIN_EMAIL=your@email.com
ADMIN_PASSWORD=your-secure-password
```

### Admin endpoints

All admin endpoints require authentication as an admin user:
- `GET /api/admin/foods` — browse dataset
- `POST /api/admin/verify/{id}` — promote/reject crawled rows

## Data Management

### SQLite database

Located at: `~/food-reco/data/food_reco.db`

```bash
# Backup
cp ~/food-reco/data/food_reco.db ~/food-reco/data/food_reco.db.backup

# Restore
cp ~/food-reco/data/food_reco.db.backup ~/food-reco/data/food_reco.db
docker compose -f ~/food-reco/infra/docker-compose.yml restart backend
```

### Reset database
```bash
cd ~/food-reco
rm data/food_reco.db
docker compose -f infra/docker-compose.yml restart backend
# The backend will recreate tables and seed data on startup
```

## Troubleshooting

### Backend won't start

```bash
# Check logs
docker compose -f ~/food-reco/infra/docker-compose.yml logs backend

# Common issues:
# 1. SQLite file permissions — ensure data/ is writable
sudo chown -R 1000:1000 ~/food-reco/data

# 2. Port conflict — ensure port 8000 is free
sudo lsof -i :8000
```

### Tunnel not working

```bash
# Check if cloudflared is running
docker compose -f ~/food-reco/infra/docker-compose.yml ps cloudflared

# Verify tunnel token is set
grep TUNNEL_TOKEN ~/food-reco/.env

# Restart tunnel
docker compose -f ~/food-reco/infra/docker-compose.yml restart cloudflared
```

### Out of disk space

```bash
# Clean up old Docker images
docker image prune -af

# Check disk usage
df -h
du -sh ~/food-reco/data/

# Clean up old backups
rm ~/food-reco/data/*.backup
```

## Security Notes

- **No secrets in repo.** All secrets via `.env` file (gitignored) or GitHub Actions Secrets.
- **SQLite file** contains all user data — protect it.
- **Cloudflare Tunnel** provides DDoS protection and hides the Pi's IP.
- **Regular updates** for Docker images and the Pi OS.
- **Backup the database** regularly (cron recommended).

## Incident Response

### 1. App is down

```bash
# Check process status
docker compose -f ~/food-reco/infra/docker-compose.yml ps

# Restart all services
docker compose -f ~/food-reco/infra/docker-compose.yml restart

# If still down, full rebuild
docker compose -f ~/food-reco/infra/docker-compose.yml down
docker compose -f ~/food-reco/infra/docker-compose.yml up -d
```

### 2. Database corrupted

```bash
# Restore from backup
cp ~/food-reco/data/food_reco.db.backup ~/food-reco/data/food_reco.db
docker compose -f ~/food-reco/infra/docker-compose.yml restart backend
```

### 3. LLM API key expired

```bash
# Update .env with new key
nano ~/food-reco/.env
# Restart backend
docker compose -f ~/food-reco/infra/docker-compose.yml restart backend
```

---

*Last updated: 2026-07-02*