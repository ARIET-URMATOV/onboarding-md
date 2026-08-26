# AGENTS.md — Контекст проекта MDIGITAL Onboarding

## Обзор

Интерактивная платформа онбординга для сотрудников MDIGITAL. 5 этапов отrientation до выполнения первых задач, XP/уровни, cyberpunk-дизайн.

## Структура монорепо

```
├── frontend/          Vite + React 19 + TypeScript
│   ├── src/
│   │   ├── api/       клиент (fetch wrapper), TanStack queries (TODO)
│   │   ├── components auth/AuthGate, layout/TopBar, isometric/, stages/
│   │   ├── pages/     DashboardPage, MapPage, ProfilePage, LoginPage и др.
│   │   ├── store/     zustand (LOCALLY — TODO: замена на TanStack Query)
│   │   └── hooks/     usePageMeta, useVoice
│   └── public/        m-head-logo.png, icons.svg, голосовые файлы
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
├── docs/              Obsidian-стиль документация
├── .github/workflows  CI: lint + pytest
└── docker-compose.yml PostgreSQL 16 (local dev)
```

## Ключевые решения

- **Только Open Sans** во всём roadmap ( нет Cinzel/JetBrains Mono/ABeeZee/Marcellus)
- **CORS**: строгий whitelist из env `CORS_ORIGINS`, без regex
- **Cookie**: `SameSite=None; Secure` в production (Vercel → Render), `Lax` в dev
- **JWT**: httpOnly cookie `md_token`, TTL 30 дней
- **DB**: asyncpg (prod), SQLite+aiosqlite (тесты); JSONB → JSON.with_variant
- **Server-authoritative XP**: клиент НЕ считает XP, всегда POST → сервер
- **Demo**: `demo@mdigital.kg` / `demo1234`, идемпотентный login + reset

## Запуск тестов

```bash
# Backend (Windows)
backend\.venv\Scripts\python -m pytest backend\tests -v

# Lint
backend\.venv\Scripts\python -m ruff check backend\app backend\tests
```

## Backend conventions

- Python 3.12, type hints required
- Pydantic v2 models, no `Optional` (use `str | None`)
- Async everywhere (asyncpg, `AsyncSession`)
- Демо-эндпоинты идут в `routes/auth.py`,.progress → `routes/progress.py`
- JWT cookie name: `md_token`

## Frontend conventions

- React 19, strict TS (`noUncheckedIndexedAccess: true`)
- CSS-переменные в `styles/theme.css`
- Fetch wrapper: `api/client.ts` (credentials: 'include')
- Страницы в `pages/`, компоненты в `components/`

## Production URLs

- Frontend: `https://onboarding-mdigital-peach.vercel.app`
- Backend: `https://preload-md.onrender.com`
- Render Dashboard → Environment: `FRONTEND_URL=https://onboarding-mdigital-peach.vercel.app`
