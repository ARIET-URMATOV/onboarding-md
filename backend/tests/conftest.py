import os

# До импорта app: тестовая БД и секрет
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key")
os.environ["APP_ENV"] = "development"
