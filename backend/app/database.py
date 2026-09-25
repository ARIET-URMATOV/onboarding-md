from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import StaticPool
from sqlalchemy.exc import OperationalError, DisconnectionError
from sqlalchemy import text

from app.config import settings
import asyncio
import logging

logger = logging.getLogger(__name__)

# Internal Render URL (dpg-...:5432) is private network without SSL;
# External URL (*.oregon-postgres.render.com, *.onrender.com) needs SSL.
_is_external = "postgres.render.com" in settings.database_url or "onrender.com" in settings.database_url

engine_kwargs: dict = {"echo": False, "pool_pre_ping": True, "pool_size": 5, "max_overflow": 5, "pool_recycle": 1800, "pool_timeout": 30}
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


async def get_db_with_retry(max_retries: int = 3, base_delay: float = 0.5) -> AsyncSession:
    """
    Get database session with retry logic for transient connection failures.
    
    Args:
        max_retries: Maximum number of retry attempts
        base_delay: Base delay in seconds for exponential backoff
    
    Yields:
        AsyncSession: Database session
        
    Raises:
        Exception: If all retries exhausted
    """
    for attempt in range(max_retries):
        try:
            async with SessionLocal() as session:
                # Test connection with a simple query
                await session.execute(text("SELECT 1"))
                yield session
                return
        except (OperationalError, DisconnectionError, ConnectionError) as e:
            if attempt == max_retries - 1:
                logger.error(f"Database connection failed after {max_retries} attempts: {e}")
                raise
            delay = base_delay * (2 ** attempt)  # Exponential backoff
            logger.warning(f"Database connection attempt {attempt + 1} failed: {e}. Retrying in {delay}s...")
            await asyncio.sleep(delay)
        except Exception as e:
            logger.error(f"Unexpected database error: {e}")
            raise


async def get_db():
    async with SessionLocal() as session:
        yield session
