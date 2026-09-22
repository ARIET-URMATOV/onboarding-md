import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

/**
 * /auth/start — инициализация OIDC входа.
 * Запрашивает у бэкенда authorization URL и редиректит на Портал.
 */
export function AuthStartPage() {
  const nav = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { authorization_url } = await api.get<{ authorization_url: string }>('/api/auth/oidc/start');
        if (!cancelled) {
          window.location.href = authorization_url;
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Не удалось подключиться к Порталу';
          setError(msg);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [nav]);

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0A0F1E', color: '#FCA5A5', fontSize: 14 }}>
        <div style={{ textAlign: 'center', maxWidth: 400, padding: 24 }}>
          <p style={{ marginBottom: 16 }}>Ошибка подключения к Порталу</p>
          <p style={{ color: '#9CA3AF', fontSize: 12, marginBottom: 20 }}>{error}</p>
          <a href="/login" style={{ color: '#60A5FA', textDecoration: 'none', fontSize: 13 }}>← Вернуться к входу</a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0A0F1E', color: '#60A5FA', fontSize: 14 }}>
      Подключение к Порталу MDigital…
    </div>
  );
}
