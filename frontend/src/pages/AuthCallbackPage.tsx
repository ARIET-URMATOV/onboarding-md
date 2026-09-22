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

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    if (!code || !state) {
      setError('Отсутствует code или state');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const me = await api.post<MeResponse>('/api/auth/oidc/callback', { code, state });
        if (!cancelled) {
          login(me);
          nav('/dashboard', { replace: true });
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Ошибка авторизации';
          setError(msg);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [searchParams, login, nav]);

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0A0F1E', color: '#FCA5A5', fontSize: 14 }}>
        <div style={{ textAlign: 'center' }}>
          <p>Ошибка авторизации: {error}</p>
          <a href="/login" style={{ color: '#60A5FA' }}>← Вернуться к входу</a>
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
