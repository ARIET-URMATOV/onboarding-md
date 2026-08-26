# AGENTS.md — Контекст проекта MDIGITAL Onboarding

## Обзор

Геймифицированная платформа онбординга для сотрудников MDIGITAL. 5 этапов, XP/уровни, cyberpunk-дизайн.

## Структура монорепо

```
├── frontend/          Vite + React 19 + TypeScript + pnpm
│   ├── src/
│   │   ├── api/       fetch wrapper + TanStack Query
│   │   ├── components auth/AuthGate, layout/TopBar, isometric/, stages/
│   │   ├── pages/     DashboardPage, MapPage, ProfilePage, LoginPage и др.
│   │   ├── store/     zustand (локальный прогресс)
│   │   └── hooks/     usePageMeta
│   └── public/        m-head-logo.png, icons.svg
├── backend/
│   ├── app/
│   │   ├── config.py          pydantic-settings (корневой .env)
│   │   ├── database.py        async engine + StaticPool для тестов
│   │   ├── main.py            FastAPI app, CORS, lifespan, routes
│   │   ├── models.py          User, Progress (JSONB / JSON variant)
│   │   ├── schemas.py         Pydantic v2 request/response
│   │   ├── stages_data.py     серверный расчёт XP (1540 max = Lv.16)
│   │   └── routes/            auth.py, progress.py
│   ├── tests/                 pytest + httpx + aiosqlite
│   ├── requirements.txt
│   ├── requirements-dev.txt
│   ├── ruff.toml
│   └── schema.sql
├── docs/              документация
├── .github/workflows  CI: lint + pytest
└── docker-compose.yml PostgreSQL 16 (local dev)
```

## Запуск тестов

```bash
# Backend (Windows)
backend\.venv\Scripts\python -m pytest backend\tests -v

# Lint
backend\.venv\Scripts\python -m ruff check backend\app backend\tests

# Frontend
cd frontend && pnpm run build
```

## Backend conventions

- Python 3.12, type hints required
- Pydantic v2 models, no `Optional` (use `str | None`)
- Async everywhere (asyncpg, `AsyncSession`)
- Демо-эндпоинты: `routes/auth.py`, progress: `routes/progress.py`
- JWT cookie name: `md_token`

## Frontend conventions

- React 19, strict TS (`noUncheckedIndexedAccess: true`)
- CSS-переменные в `styles/theme.css`
- Fetch wrapper: `api/client.ts` (credentials: 'include')
- Страницы в `pages/`, компоненты в `components/`
- pnpm (lockfile: `frontend/pnpm-lock.yaml`)

## Production URLs

- Frontend: `https://onboarding-mdigital-peach.vercel.app`
- Backend: `https://preload-md.onrender.com`
- Render Dashboard → Environment: `FRONTEND_URL=https://onboarding-mdigital-peach.vercel.app`
