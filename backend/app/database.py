from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import StaticPool

from app.config import settings

_is_external = "onrender.com" in settings.database_url

engine_kwargs: dict = {"echo": False}
if _is_external:
    engine_kwargs["connect_args"] = {"ssl": True}
if "sqlite" in settings.database_url and ":memory:" in settings.database_url:
    # Тесты: одна shared in-memory БД на весь engine
    engine_kwargs["poolclass"] = StaticPool
    engine_kwargs["connect_args"] = {"check_same_thread": False}

engine = create_async_engine(settings.database_url, **engine_kwargs)
SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with SessionLocal() as session:
        yield session
