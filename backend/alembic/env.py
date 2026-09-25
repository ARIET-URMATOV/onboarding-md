import asyncio
import logging
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.exc import OperationalError, DisconnectionError
from sqlalchemy.ext.asyncio import async_engine_from_config

from app.config import settings
from app.database import Base
import app.models  # noqa: F401 — ensure models are imported

logger = logging.getLogger(__name__)

config = context.config

# Override sqlalchemy.url from settings (env var / .env wins over alembic.ini placeholder)
config.set_main_option("sqlalchemy.url", settings.database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode (no DB connection needed, emits SQL)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations_with_retry(max_retries: int = 5, base_delay: float = 2.0) -> None:
    """Run async migrations with retry logic for transient connection failures."""
    url = config.get_main_option("sqlalchemy.url") or ""
    connect_args: dict = {}
    if "postgres.render.com" in url or "onrender.com" in url:
        connect_args = {"ssl": True}
    
    for attempt in range(max_retries):
        try:
            connectable = async_engine_from_config(
                config.get_section(config.config_ini_section, {}),
                prefix="sqlalchemy.",
                poolclass=pool.NullPool,
                connect_args=connect_args,
            )
            async with connectable.connect() as connection:
                await connection.run_sync(do_run_migrations)
            await connectable.dispose()
            logger.info("Migrations completed successfully")
            return
        except (OperationalError, DisconnectionError, ConnectionError) as e:
            if attempt == max_retries - 1:
                logger.error(f"Migrations failed after {max_retries} attempts: {e}")
                raise
            delay = base_delay * (2 ** attempt)  # Exponential backoff
            logger.warning(f"Migration attempt {attempt + 1} failed: {e}. Retrying in {delay}s...")
            await asyncio.sleep(delay)
        except Exception as e:
            logger.error(f"Unexpected migration error: {e}")
            raise


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations_with_retry())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
