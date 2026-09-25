import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, type MeResponse } from '../api/client';
import { useOnboarding } from '../store/useOnboarding';

/**
 * /auth/callback — ловит ?code&state от Портала, POSTит на бэкенд,
 * получает MeResponse с HttpOnly cookie → hydrate → dashboard.
 */
export function AuthCallbackPage() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const login = useOnboarding((s) => s.login);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    if (!code || !state) {
      setError('Отсутствует code или state');
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    (async () => {
      try {
        const timeout = new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('Сервер долго отвечает (холодный старт). Нажмите «Повторить».')), 60_000);
        });
        const me = await Promise.race([
          api.post<MeResponse>('/api/auth/oidc/callback', { code, state }),
          timeout,
        ]);
        if (!cancelled) {
          login(me);
          nav('/dashboard', { replace: true });
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Ошибка авторизации';
          setError(msg);
        }
      } finally {
        if (timer) clearTimeout(timer);
      }
    })();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [searchParams, login, nav, attempt]);

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0A0F1E', color: '#FCA5A5', fontSize: 14 }}>
        <div style={{ textAlign: 'center', padding: 24 }}>
          <p>Ошибка авторизации: {error}</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 16 }}>
            <button
              type="button"
              onClick={() => { setError(null); setAttempt((a) => a + 1); }}
              style={{ padding: '10px 22px', borderRadius: 10, border: '1px solid #3B82F6', background: 'rgba(59,130,246,.15)', color: '#93C5FD', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              Повторить
            </button>
            <a href="/login" style={{ color: '#60A5FA', alignSelf: 'center' }}>← К входу</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0A0F1E', color: '#60A5FA', fontSize: 14 }}>
      Завершаем вход…
    </div>
  );
}
