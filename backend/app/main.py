"""FastAPI application factory."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.health import router as health_router
from app.api.data import router as data_router
from app.api.feedback import router as feedback_router
from app.api.admin import router as admin_router
from app.api.plan import router as plan_router
from app.auth.routes import router as auth_router
from app.auth.user_routes import router as user_router
from app.core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan — runs on startup and shutdown."""
    # Startup: create tables, seed data, etc.
    from app.core.database import engine, async_session_factory
    from app.models.base import Base

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Seed initial data (idempotent — skips if already seeded)
    try:
        from app.seed import (
            seed_provinces,
            seed_price_tier_overrides,
            seed_cities,
            seed_food,
            seed_admin,
        )
        async with async_session_factory() as session:
            await seed_provinces(session)
            await seed_price_tier_overrides(session)
            await seed_cities(session)
            await seed_food(session)
            await seed_admin(session)
            await session.commit()
    except Exception as e:
        print(f"⚠️  Seed error (non-fatal): {e}")

    # Seed admin-control tables (health_condition, tag_catalog, cuisine_type)
    try:
        from scripts.seed_admin_tables import seed_admin_tables
        await seed_admin_tables()
    except Exception as e:
        print(f"⚠️  Admin table seed error (non-fatal): {e}")

    yield

    # Shutdown: cleanup
    await engine.dispose()


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        lifespan=lifespan,
    )

    # CORS — allow frontend dev server and production origins
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",  # Vite dev server
            "https://food.yosuaf.com",
            "https://foodapi.yosuaf.com",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register routers
    app.include_router(health_router)
    app.include_router(auth_router)
    app.include_router(user_router)
    app.include_router(data_router)
    app.include_router(feedback_router)
    app.include_router(admin_router)
    app.include_router(plan_router)

    return app


app = create_app()