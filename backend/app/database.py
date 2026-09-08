from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import StaticPool

from app.config import settings

# Internal Render URL (dpg-...:5432) is private network without SSL;
# External URL (*.oregon-postgres.render.com, *.onrender.com) needs SSL.
_is_external = "postgres.render.com" in settings.database_url or "onrender.com" in settings.database_url

engine_kwargs: dict = {"echo": False, "pool_pre_ping": True, "pool_size": 10, "max_overflow": 20, "pool_recycle": 3600}
if _is_external:
    engine_kwargs["connect_args"] = {"ssl": True}
if "sqlite" in settings.database_url and ":memory:" in settings.database_url:
    # Тесты: одна shared in-memory БД на весь engine
    engine_kwargs["poolclass"] = StaticPool
    engine_kwargs["connect_args"] = {"check_same_thread": False}
    # SQLite не поддерживает pool_size/max_overflow — убираем
    engine_kwargs.pop("pool_size", None)
    engine_kwargs.pop("max_overflow", None)
    engine_kwargs.pop("pool_recycle", None)

engine = create_async_engine(settings.database_url, **engine_kwargs)
SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with SessionLocal() as session:
        yield session
