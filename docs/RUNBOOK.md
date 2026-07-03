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
    │                → /      → static frontend (SPA)
    │
    ▼ backend (FastAPI + SQLite)
    ▼ crawler (scheduled, `docker compose --profile crawler run`)
```

**SPA routing:** nginx is configured to fall back to `index.html` for all non-file routes,
enabling client-side routing (React Router) without server-side URL rewriting.
See `infra/nginx/nginx.conf` — the `try_files $uri $uri/ /index.html;` directive handles this.

## Services

| Service | Container | Port (Host) | Port (Container) | Purpose |
|---------|-----------|-------------|-------------------|---------|
| nginx | `infra-nginx-1` | 8080 | 8080 | Reverse proxy + static files |
| backend | `infra-backend-1` | — | 8000 | FastAPI application (internal only) |
| crawler | `infra-crawler-1` | — | — | On-demand data pipeline |
| cloudflared | `infra-cloudflared-1` | — | — | Outbound tunnel to Cloudflare |

> **Note:** The backend container is **not exposed** on a host port. All traffic
> reaches it through the nginx reverse proxy at `/api/*`. Port 8000 is only
> accessible within the Docker network.

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

### .env tunables

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENROUTER_API_KEY` | — | **Required.** OpenRouter API key for LLM calls |
| `JWT_SECRET_KEY` | — | **Required.** Secret used to sign JWT tokens |
| `TUNNEL_TOKEN` | — | Cloudflare tunnel token (Pi deployment only) |
| `ADMIN_EMAIL` | — | Email for auto-seeded admin user (first run only) |
| `ADMIN_PASSWORD` | — | Password for auto-seeded admin user |
| `DATABASE_URL` | `sqlite+aiosqlite:///./data/food_reco.db` | Database connection string |
| `LLM_PRIMARY_MODEL` | `deepseek/deepseek-v4-flash` | Primary LLM model |
| `LLM_FAILOVER_MODEL` | `gemini/gemini-2.0-flash-exp` | Failover LLM model |
| `LLM_MAX_TOKENS` | `1500` | Max tokens per LLM response |
| `LLM_PROVIDER_SORT` | `latency` | Provider sort order for OpenRouter (`latency` or `price`) |
| `RECO_TOP_N_CANDIDATES` | `10` | Number of candidate foods considered per recommendation |
| `DAILY_PLAN_LIMIT` | `20` | Max meal plans per user per day |
| `DAILY_CHAT_LIMIT` | `60` | Max chat messages per user per day |

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

The admin user is seeded automatically on application startup from `.env` variables:

```
ADMIN_EMAIL=your@email.com
ADMIN_PASSWORD=your-secure-password
```

This happens in `seed_admin()` in `app/seed.py` — called during the FastAPI
lifespan startup. It is **idempotent**: if the admin user already exists, seeding
is skipped.

Alternatively, create additional admin users (or any user) server-side via the
CLI tool:

```bash
# Create a regular user
docker exec infra-backend-1 python /app/scripts/create_user.py user@example.com StrongPass123!

# Create an admin user
docker exec infra-backend-1 python /app/scripts/create_user.py admin@example.com AdminPass123! --admin
```

### Admin panel (frontend)

Access the admin panel at `https://food.yosuaf.com/admin` (requires admin login).

The admin panel has **8 full CRUD tabs**:

| Tab | Key | Backend Route Prefix | Description |
|-----|-----|----------------------|-------------|
| 🍽️ Makanan | `makanan` | `/api/admin/foods` | Browse, create, edit, delete food items |
| 🗺️ Provinsi | `provinsi` | `/api/admin/provinces` | Manage provinces + price multipliers |
| 🏙️ Kota | `kota` | `/api/admin/cities` | Manage cities with full CRUD |
| 💰 Override | `override` | `/api/admin/overrides` | Price tier overrides (e.g. Jabodetabek) |
| 👥 Users | `users` | `/api/admin/users` | List users, change roles, delete |
| ❤️ Kondisi | `kondisi` | `/api/admin/conditions` | Manage health conditions |
| 🏷️ Tags | `tags` | `/api/admin/tags` | Manage food tag catalog |
| 🍳 Masakan | `masakan` | `/api/admin/cuisines` | Manage cuisine types |

All admin endpoints require authentication as an admin user.

### User operations

**Password change:** Users can change their password from the profile dropdown
menu → navigate to `/change-password` on the frontend. This calls
`POST /api/user/change-password` on the backend.

## Frontend Build & Deploy

The frontend is built as a **multi-stage Docker image** (see `frontend/Dockerfile`):

1. **Build stage:** `node:20-alpine` runs `npm ci && npm run build` producing a `dist/` directory.
2. **Runtime stage:** `nginx:alpine` copies the `dist/` contents into `/usr/share/nginx/html`
   and the nginx config into `/etc/nginx/conf.d/default.conf`.

After making changes to frontend code:

```bash
# Option A — Rebuild the nginx image (recommended for CI/CD)
cd ~/food-reco/infra
docker compose build nginx
docker compose up -d nginx

# Option B — Copy built files directly into the running container (dev/debug)
cd ~/food-reco/frontend
npm run build
docker cp dist/. infra-nginx-1:/usr/share/nginx/html/
```

## Performance Tuning

### SQLite WAL mode

SQLite is configured with **WAL (Write-Ahead Logging)** mode for better
concurrent read/write performance. This is enabled automatically on every
database connection via a SQLAlchemy event listener in `app/core/database.py`:

```python
@event.listens_for(engine.sync_engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.execute("PRAGMA cache_size=-8000")   # 8 MB cache
    cursor.execute("PRAGMA busy_timeout=5000")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()
```

No manual configuration is needed — WAL mode is activated on every backend
startup automatically.

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

*Last updated: 2026-07-03*