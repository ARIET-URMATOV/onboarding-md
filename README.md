# MDIGITAL Onboarding Platform

Интерактивная платформа онбординга для сотрудников MDIGITAL — 5 этапов отrientation до выполнения первых задач, с XP/уровнями и cyberpunk-дизайном.

## Архитектура

```
├── frontend/       Vite + React 19 + TypeScript
│   └── src/        компоненты, страницы, хуки, store
├── backend/
│   ├── app/        FastAPI + SQLAlchemy (async) + JWT
│   ├── tests/      pytest + httpx + aiosqlite
│   └── schema.sql  DDL для PostgreSQL
├── docs/           документация проекта
└── .github/        CI/CD
```

## Стек

| Слой     | Технологии                                                                 |
| -------- | -------------------------------------------------------------------------- |
| Frontend | React 19, TypeScript, Vite, zustand (локально), React Router, odometer.js |
| Backend  | FastAPI, SQLAlchemy 2.0 (async), asyncpg, bcrypt, PyJWT (httpOnly cookie) |
| DB       | PostgreSQL 16 (prod), SQLite (тесты)                                       |
| Деплой   | Vercel (frontend), Render (backend), Docker Compose (local)                |

## Быстрый старт

```bash
# 1. Клонируй и установи зависимости
npm install                        # frontend
python -m venv backend/.venv       # backend
backend/.venv/Scripts/pip install -r backend/requirements.txt -r backend/requirements-dev.txt

# 2. Настрой окружение
cp .env.example .env               # заполни DATABASE_URL и JWT_SECRET_KEY

# 3. Подними PostgreSQL (Docker)
docker compose up -d

# 4. Запусти
cd frontend && npm run dev         # http://localhost:5173
cd backend && uvicorn app.main:app --port 8000 --reload  # http://localhost:8000
```

## Тесты

```bash
# Backend (13 тестов, in-memory SQLite)
backend/.venv/Scripts/python -m pytest backend/tests -v

# Lint
backend/.venv/Scripts/python -m ruff check backend/app backend/tests

# Frontend
cd frontend && npm run build
```

## 5 этапов онбординга

| Этап | Название            | XP (задача) | XP (бонус) | Всего |
| ---- | ------------------- | ----------- | ---------- | ----- |
| 1    | Документы           | 40×5        | 150        | 350   |
| 2    | Инструменты        | 50×4        | 150        | 350   |
| 3    | Видео               | 200×1       | 0          | 200   |
| 4    | Рабочее пространство| 40×6        | 150        | 390   |
| 5    | Тестовое задание    | 100×2       | 150        | 350   |

**Максимум: 1540 XP = Lv.16**

## Роли

`frontend` · `backend` · `designer`

## Демо-режим

Вход: `demo@mdigital.kg` / `demo1234` — автоматическое создание + идемпотентный сброс.

## Среды

|         | Frontend                             | Backend                              |
| ------- | ------------------------------------ | ------------------------------------ |
| Dev     | `http://localhost:5173`              | `http://localhost:8000`              |
| Prod    | `https://onboarding-mdigital-peach.vercel.app` | `https://preload-md.onrender.com`    |
