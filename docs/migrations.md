# Миграции БД

## Автоматические

При старте FastAPI (`lifespan` → `run_migrations()`):

1. `Base.metadata.create_all()` — создание таблиц если их нет
2. `ALTER TABLE users ADD COLUMN avatar TEXT` — добавление аватара (если колонки нет)

Миграции запускаются с **5 ретраями** (Render External DB может стартовать дольше Web Service).

## Ручные миграции

Для продакшена (ALTER TYPE, изменение индексов и т.д.) используй `schema.sql` или Render Shell.

## Локальная инициализация

```bash
docker compose up -d           # поднять PostgreSQL
docker exec -i mdigital-db psql -U md -d mdigital < backend/schema.sql
```

## JSONB vs JSON

- **PostgreSQL**: `JSONB` для `Progress.done_tasks` — эффективные запросы
- **SQLite (тесты)**: `JSON` через `JSONB().with_variant(JSON(), "sqlite")` — совместимость

## Добавление новой миграции

1. Добавь в `backend/app/main.py` в `_add_avatar` (или создай новую функцию `run_migrations`)
2. Используй `inspect(sync_conn)` для проверки существования колонки/таблицы
3. Логируй результат: `print("migration ok")`
