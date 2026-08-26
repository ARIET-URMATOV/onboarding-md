import os

from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

_raw_url = os.getenv("DATABASE_URL", "postgresql+asyncpg://md:md@localhost:5432/mdigital")
if _raw_url.startswith("postgres://"):
    _raw_url = _raw_url.replace("postgres://", "postgresql+asyncpg://", 1)
elif _raw_url.startswith("postgresql://"):
    _raw_url = _raw_url.replace("postgresql://", "postgresql+asyncpg://", 1)
# Render external URL содержит ?sslmode=require — asyncpg его не понимает, передаём через connect_args
if "sslmode=" in _raw_url:
    _raw_url = _raw_url.split("?")[0]
DATABASE_URL = _raw_url

_is_external = "onrender.com" in DATABASE_URL
engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    connect_args={"ssl": True} if _is_external else {},
)
SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with SessionLocal() as session:
        yield session
