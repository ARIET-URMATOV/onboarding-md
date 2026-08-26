# Деплой

## Frontend → Vercel

1. GitHub repo → Import → Framework: **Vite**
2. **Root Directory**: `frontend`
3. Build Command: `npm run build`
4. Output: `dist`
5. Environment Variables:
   ```
   VITE_API_URL=https://preload-md.onrender.com
   ```
6. Deploy → `https://onboarding-mdigital-peach.vercel.app`

## Backend → Render

1. GitHub repo → New → **Web Service**
2. **Root Directory**: `backend`
3. Runtime: Python 3.12
4. Build Command: `pip install -r requirements.txt`
5. Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
6. Environment Variables:
   ```
   DATABASE_URL=postgresql+asyncpg://...@...oregon-postgres.render.com:5432/mdigital_...
   JWT_SECRET_KEY=<random-64-chars>
   APP_ENV=production
   CORS_ORIGINS=["https://onboarding-mdigital-peach.vercel.app"]
   FRONTEND_URL=https://onboarding-mdigital-peach.vercel.app
   ```

## Локальная разработка

```bash
# PostgreSQL через Docker
docker compose up -d

# Backend
cd backend && uvicorn app.main:app --port 8000 --reload

# Frontend
cd frontend && npm run dev
```

## Важно

- **CORS_ORIGINS** — JSON-список доменов, без regex ( whitelist )
- **DATABASE_URL** — Render External Database URL содержит `.oregon-postgres.render.com`
- **Cookie** — `SameSite=None; Secure` автоматически в production ( cross-site Vercel → Render )
- **SSL** — asyncpg + Render external DB требуют `ssl=True` в connect_args
