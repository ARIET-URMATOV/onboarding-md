#!/bin/sh
# Entrypoint with retry logic for database connections and non-blocking migrations

# Retry function with exponential backoff
retry_with_backoff() {
    max_attempts=5
    attempt=1
    delay=2
    
    while [ $attempt -le $max_attempts ]; do
        if "$@"; then
            return 0
        fi
        echo "Attempt $attempt failed. Retrying in ${delay}s..."
        sleep $delay
        attempt=$((attempt + 1))
        delay=$((delay * 2))
    done
    
    echo "All $max_attempts attempts failed. Continuing without migration..."
    return 1
}

# Миграции БД — не блокируют старт приложения
if echo "$DATABASE_URL" | grep -q "sqlite.*:memory:"; then
  echo "entrypoint: sqlite memory — skip alembic"
else
  echo "entrypoint: attempting alembic upgrade head (non-blocking)..."
  retry_with_backoff alembic upgrade head || {
    echo "entrypoint: alembic failed after retries, fallback create_all will be handled by app on startup"
  }
fi

exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
