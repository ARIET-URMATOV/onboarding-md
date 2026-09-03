from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_ENV = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(str(ROOT_ENV),),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # App
    app_name: str = "MDIGITAL Onboarding"
    app_env: str = "development"
    app_debug: bool = False

    # CORS (JSON-список в .env: ["http://localhost:5173", ...])
    cors_origins: list[str] = ["http://localhost:5173"]

    # PostgreSQL — поле raw_database_url ↔ env var DATABASE_URL
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "mdigital"
    postgres_user: str = "md"
    postgres_password: str = "md_secret"
    raw_database_url: str | None = Field(None, alias="DATABASE_URL")

    # JWT
    jwt_secret_key: str = "dev-secret-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_days: int = 7

    DEV_JWT_SECRET: str = "dev-secret-change-in-production"

    # Demo
    demo_email: str = "demo@mdigital.kg"
    demo_password: str = "demo1234"
    demo_name: str = "Demo User"

    @property
    def database_url(self) -> str:
        """DATABASE_URL из env (Render) имеет приоритет, иначе собираем из POSTGRES_*."""
        url = self.raw_database_url
        if not url:
            url = (
                f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
                f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
            )
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        # asyncpg не понимает sslmode в query — SSL через connect_args (database.py)
        if "sslmode=" in url:
            url = url.split("?")[0]
        return url

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() in ("production", "prod")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
