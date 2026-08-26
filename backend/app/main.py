import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

import app.models  # noqa: F401 — регистрация моделей на Base.metadata
from app.config import settings
from app.database import Base, engine


async def run_migrations():
    """Создание таблиц + лёгкие миграции — с ретраем (БД может стартовать дольше Web Service)."""
    for attempt in range(5):
        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)

                def _add_avatar(sync_conn):
                    insp = inspect(sync_conn)
                    if "users" in insp.get_table_names():
                        cols = [c["name"] for c in insp.get_columns("users")]
                        if "avatar" not in cols:
                            sync_conn.execute(text("ALTER TABLE users ADD COLUMN avatar TEXT"))

                await conn.run_sync(_add_avatar)
            print("migrations ok")
            break
        except Exception as e:
            print(f"migration retry {attempt + 1}/5: {e}")
            if attempt == 4:
                print("migration failed after retries — continuing")
                break
            await asyncio.sleep(2)


@asynccontextmanager
async def lifespan(_: FastAPI):
    await run_migrations()
    yield


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    lifespan=lifespan,
    debug=settings.app_debug,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.routes import auth, progress  # noqa: E402 — после создания app

app.include_router(auth.router, prefix="/api", tags=["auth"])
app.include_router(progress.router, prefix="/api", tags=["progress"])


@app.get("/api/health")
async def health():
    return {"ok": True}
