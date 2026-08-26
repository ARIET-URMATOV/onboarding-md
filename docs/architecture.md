# Архитектура

## Монорепо

```
preload-state/
├── frontend/     React 19 + Vite + TypeScript
├── backend/      FastAPI + SQLAlchemy + asyncpg
├── docs/         Obsidian-стиль документация
└── docker-compose.yml
```

## Frontend

- **React 19** с Suspense, lazy loading
- **React Router** — SPA с hash-роутингом (MapPage работает на `/`)
- **Fetch wrapper** (`api/client.ts`) — credentials: 'include', автоматический VITE_API_URL
- **AuthGate** — гидратация через `/api/me` при загрузке, показ spinner до ответа
- **usePageMeta** — SEO: title, OG/Twitter meta для каждой страницы

## Backend

- **FastAPI** + lifespan (startup → миграции)
- **SQLAlchemy 2.0** async: `AsyncSession`, `Mapped[]`, `mapped_column`
- **asyncpg** (prod) / **aiosqlite** (тесты)
- **JWT** в httpOnly cookie `md_token` (30 дней)
- **bcrypt** для хэширования паролей
- **pydantic-settings** — единый `.env` в корне монорепо

## Поток авторизации

```
Frontend                    Backend
   │                           │
   ├─ POST /api/register ────►  │  → создать user + progress
   │  ◄── Set-Cookie: md_token  │
   │                           │
   ├─ GET /api/me ────────────►  │  → декодировать JWT → вернуть user + progress
   │  ◄── 200 { user, progress }│
   │                           │
   ├─ POST /api/logout ──────►   │  → удалить cookie
```

## XP и уровни

- XP считается **только сервером** через `stages_data.py`
- Клиент отправляет `POST /api/progress/task` или `POST /api/progress/stage`
- Сервер пересчитывает XP из `done_tasks` → `compute_xp()` → `Progress.xp`
- Максимум: **1540 XP = Lv.16** (все задачи + все бонусы за этапы)
