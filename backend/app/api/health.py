"""Health check endpoint."""

from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/api/health")
async def health_check():
    """Liveness probe. Returns app status and version."""
    from app.core.config import settings

    return {
        "status": "ok",
        "app": settings.app_name,
        "version": settings.app_version,
    }