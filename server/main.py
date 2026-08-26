import asyncio
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

import auth
import progress
from database import engine


async def run_migrations():
    """Лёгкие идемпотентные миграции — с ретраем для Render (БД стартует дольше Web Service)."""
    for attempt in range(5):
        try:
            async with engine.begin() as conn:
                await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT"))
            break
        except Exception as e:
            print(f"migration retry {attempt + 1}/5: {e}")
            if attempt == 4:
                print("migration failed after retries — continuing without avatar column")
                break
            await asyncio.sleep(2)


@asynccontextmanager
async def lifespan(_: FastAPI):
    await run_migrations()
    yield


app = FastAPI(title="MDIGITAL Onboarding API", version="1.0.0", lifespan=lifespan)

_frontend_raw = os.getenv("FRONTEND_URL", "http://localhost:5173,http://127.0.0.1:5173")
_allow_origins = [o.strip() for o in _frontend_raw.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api", tags=["auth"])
app.include_router(progress.router, prefix="/api", tags=["progress"])


@app.get("/api/health")
async def health():
    return {"ok": True}
