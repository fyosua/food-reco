"""Application settings loaded from environment variables."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application configuration.

    Loaded from .env file or environment variables.
    All secrets are injected via environment (never committed).
    """

    # ── App ──
    app_name: str = "FoodReco"
    app_version: str = "0.1.0"
    debug: bool = False

    # ── Database ──
    database_url: str = "sqlite+aiosqlite:///./data/food_reco.db"

    # ── Auth ──
    jwt_secret_key: str = "change-me-in-production"  # noqa: S105
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60
    jwt_refresh_expire_days: int = 7

    # ── OpenRouter ──
    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    llm_primary_model: str = "deepseek/deepseek-v4-flash"
    llm_failover_model: str = "gemini/gemini-2.0-flash-exp"

    # ── Rate limits (per user per day) ──
    daily_plan_limit: int = 20
    daily_chat_limit: int = 60

    # ── SMTP (email verification) ──
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_pass: str = ""
    smtp_from: str = "noreply@food.yosuaf.com"

    # ── Admin seed ──
    admin_email: str = ""
    admin_password: str = ""

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()