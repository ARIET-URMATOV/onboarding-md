import asyncio
import os

# До импорта app: тестовая БД и секрет
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key")
os.environ["APP_ENV"] = "development"

import pytest


@pytest.fixture(scope="session", autouse=True)
def _create_tables():
    """SQLite memory: создать все таблицы из models (SSOT, включая audit/wifi/mpulse)."""
    from app.database import Base, engine

    async def _go():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    asyncio.run(_go())
