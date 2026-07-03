# ── Build stage ──
FROM python:3.11-slim AS builder

WORKDIR /app

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Copy dependency files
COPY pyproject.toml uv.lock* ./

# Install production dependencies
RUN uv sync --no-dev --frozen

# ── Runtime stage ──
FROM python:3.11-slim

WORKDIR /app

# Copy uv and venv from builder
COPY --from=builder /app/.venv /app/.venv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Copy application code
COPY app/ /app/app/
COPY scripts/ /app/scripts/
COPY data/ /app/data/
COPY data/ /app/seed_data/
COPY migrations/ /app/migrations/
COPY alembic.ini /app/
COPY pyproject.toml /app/

# Create data directory for SQLite
RUN mkdir -p /app/data

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')" || exit 1

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]