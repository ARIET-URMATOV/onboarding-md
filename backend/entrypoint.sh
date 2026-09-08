#!/bin/sh
set -e

# Миграции БД — отдельно от старта приложения (оптимально для продакшена)
# В тестах (sqlite :memory:) alembic не нужен — сразу старт
if echo "$DATABASE_URL" | grep -q "sqlite.*:memory:"; then
  echo "entrypoint: sqlite memory — skip alembic"
else
  echo "entrypoint: alembic upgrade head"
  alembic upgrade head || {
    echo "entrypoint: alembic failed, fallback create_all will be handled by app if needed"
  }
fi

exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
