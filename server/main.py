from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

import auth
import progress
from database import engine


async def run_migrations():
    """Лёгкие идемпотентные миграции для живой БД (volume уже существует)."""
    async with engine.begin() as conn:
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT"))


@asynccontextmanager
async def lifespan(_: FastAPI):
    await run_migrations()
    yield


app = FastAPI(title="MDIGITAL Onboarding API", version="1.0.0", lifespan=lifespan)

# Dev: Vite (5173) проксирует /api, но CORS оставляем на случай прямых запросов
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api", tags=["auth"])
app.include_router(progress.router, prefix="/api", tags=["progress"])


@app.get("/api/health")
async def health():
    return {"ok": True}
