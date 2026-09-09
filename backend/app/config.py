import json
from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator, model_validator
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

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _parse_cors_origins(cls, v: object) -> list[str]:
        if isinstance(v, list):
            return v
        if isinstance(v, str):
            s = v.strip()
            if not s:
                return ["http://localhost:5173"]
            # Try JSON array first
            try:
                parsed = json.loads(s)
                if isinstance(parsed, list):
                    return [str(x).strip() for x in parsed if str(x).strip()]
            except Exception:
                pass
            # Fallback: comma-separated or single origin
            if "," in s:
                return [x.strip().strip('"').strip("'") for x in s.split(",") if x.strip()]
            # Single origin without JSON brackets
            return [s.strip().strip('"').strip("'")]
        return v  # type: ignore[return-value]

    # PostgreSQL — поле raw_database_url ↔ env var DATABASE_URL
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "mdigital"
    postgres_user: str = "md"
    postgres_password: str = "md_secret"
    raw_database_url: str | None = Field(None, alias="DATABASE_URL")

    # JWT — alias JWT_SECRET_KEY, fallback JWT_KEY for legacy Render env names
    jwt_secret_key: str = Field(
        default="dev-secret-change-in-production", alias="JWT_SECRET_KEY"
    )
    # legacy alias without _SECRET (Render typo: JWT_KEY) — handled in model_validator
    jwt_key_legacy: str | None = Field(default=None, alias="JWT_KEY")
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_days: int = 7

    DEV_JWT_SECRET: str = "dev-secret-change-in-production"

    @model_validator(mode="after")
    def _fallback_jwt_key(self) -> "Settings":
        # Support legacy env name JWT_KEY (without _SECRET) used on Render before fix
        if self.jwt_secret_key == self.DEV_JWT_SECRET and self.jwt_key_legacy:
            self.jwt_secret_key = self.jwt_key_legacy
        return self

    # Demo
    demo_email: str = "demo@mdigital.kg"
    demo_password: str = "demo1234"
    demo_name: str = "Demo User"

    # Stage 1: MPulse / Wi-Fi (TZ v1.0)
    # Статический код MPulse на батч (fallback; приоритет — активный код из mpulse_codes)
    mpulse_verification_code: str = Field(default="ONBOARD-2026", alias="MPULSE_VERIFICATION_CODE")
    # Wi-Fi пароль по умолчанию (sysadmin может задать через admin endpoint; хранится в env для MVP)
    wifi_password: str = Field(default="mdigital-wifi-2026", alias="WIFI_PASSWORD")
    # Confluence таймер: 120 сек (подтверждено)
    confluence_min_seconds: int = 120

    # Corporate Portal SSO: общий секрет для JWT auto-login ссылок (5 мин TTL)
    shared_secret_key: str = Field(default="", alias="SHARED_SECRET_KEY")
    # Куда редиректить после auto-login
    frontend_url: str = Field(default="http://localhost:5173", alias="FRONTEND_URL")

    # Ссылки/инструкции внешних систем (TZ: онбординг даёт ссылки, LDAP — их own настройки)
    telegram_invite_link: str = Field(default="", alias="TELEGRAM_INVITE_LINK")
    figma_team_url: str = Field(default="", alias="FIGMA_TEAM_URL")
    confluence_url: str = Field(default="https://confluence.mdigital.kg", alias="CONFLUENCE_URL")
    mpulse_android_url: str = Field(
        default="https://play.google.com/store/search?q=MPulse&c=apps", alias="MPULSE_ANDROID_URL"
    )
    mpulse_ios_url: str = Field(
        default="https://apps.apple.com/search?term=MPulse", alias="MPULSE_IOS_URL"
    )

    # Production integrations (пусто = соответствующий канал отключён, поведение fallback)
    mpulse_api_url: str = Field(default="", alias="MPULSE_API_URL")
    figma_api_token: str = Field(default="", alias="FIGMA_API_TOKEN")
    telegram_bot_token: str = Field(default="", alias="TELEGRAM_BOT_TOKEN")
    smtp_host: str = Field(default="", alias="SMTP_HOST")
    smtp_port: int = 587
    smtp_user: str = Field(default="", alias="SMTP_USER")
    smtp_password: str = Field(default="", alias="SMTP_PASSWORD")
    smtp_from: str = Field(default="onboarding@mdigital.kg", alias="SMTP_FROM")
    hr_notify_email: str = Field(default="", alias="HR_NOTIFY_EMAIL")

    @property
    def smtp_configured(self) -> bool:
        return bool(self.smtp_host and self.smtp_user and self.smtp_password)

    @property
    def telegram_configured(self) -> bool:
        return bool(self.telegram_bot_token)

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
