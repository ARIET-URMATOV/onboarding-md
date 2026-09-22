import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type MeResponse } from '../api/client';
import { useOnboarding } from '../store/useOnboarding';
import { usePageMeta } from '../hooks/usePageMeta';

const DEMO_ENABLED = import.meta.env.VITE_DEMO_ENABLED === 'true';

export function LoginPage() {
  usePageMeta("Вход — MDIGITAL Онбординг", "Войди в портал онбординга MDIGITAL, чтобы продолжить адаптацию и отслеживать прогресс этапов.");
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [ldapConfigured, setLdapConfigured] = useState(true);
  const [oidcConfigured, setOidcConfigured] = useState(false);
  const login = useOnboarding((s) => s.login);
  const nav = useNavigate();

  useEffect(() => {
    api.get<{ ldap_configured: boolean }>('/api/auth/ldap-status')
      .then((r) => setLdapConfigured(r.ldap_configured))
      .catch(() => setLdapConfigured(false));
    api.get<{ oidc_configured: boolean }>('/api/auth/oidc-status')
      .then((r) => setOidcConfigured(r.oidc_configured))
      .catch(() => setOidcConfigured(false));
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError('Заполни все поля');
      return;
    }
    setLoading(true);
    try {
      const me = await api.post<MeResponse>('/api/login', { email, password });
      login(me);
      nav('/dashboard');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ошибка входа';
      if (msg.includes('LDAP') || msg.includes('AD')) {
        setError('Ошибка подключения к корпоративной сети');
      } else {
        setError('Неверный email или пароль');
      }
    } finally {
      setLoading(false);
    }
  };

  const onDemo = async (stage?: number) => {
    setDemoLoading(true);
    setError(null);
    try {
      const url = stage ? `/api/demo/login?stage=${stage}` : '/api/demo/login';
      const me = await api.post<MeResponse>(url);
      login(me);
      nav('/dashboard');
    } catch {
      setError('Не удалось войти в демо');
    } finally {
      setDemoLoading(false);
    }
  };

  const STAGE_LABELS: Record<number, string> = {
    1: 'Этап 1',
    2: 'Этап 2',
    3: 'Этап 3',
    4: 'Этап 4',
    5: 'Этап 5',
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card glass-strong">
        <div className="auth-head">
          <div className="logo-mark">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2l3 4-3 4-3-4 3-4z" />
              <path d="M4 7l4 3v7l-4-3V7z" />
              <path d="M20 7l-4 3v7l4-3V7z" />
              <path d="M8 17l4 3 4-3" />
            </svg>
          </div>
          <h1 className="font-orbitron">MDIGITAL ONBOARDING</h1>
          <p>Войди, чтобы продолжить путь</p>
        </div>

        {!ldapConfigured && !oidcConfigured && (
          <div className="ldap-warning">
            ⚠️ Ни LDAP, ни OIDC не настроены — доступен только демо-режим
          </div>
        )}

        {oidcConfigured && (
          <a href="/auth/start" className="btn-oidc">
            ВОЙТИ ЧЕРЕЗ ПОРТАЛ ↗
          </a>
        )}

        {oidcConfigured && (
          <div className="oidc-divider"><span>или</span></div>
        )}

        <form onSubmit={onSubmit}>
          <label className="field">
            <span>Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@mdigital.kg" required />
          </label>
          <label className="field">
            <span>Пароль</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
          </label>
          {error && <div className="error">{error}</div>}
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Входим…' : 'ВОЙТИ →'}
          </button>
        </form>

        {DEMO_ENABLED && (
          <>
            <div className="demo-divider"><span>или</span></div>
            <button type="button" className="btn-demo" onClick={() => onDemo()} disabled={demoLoading}>
              {demoLoading ? 'Входим…' : 'ДЕМО-С НАЧАЛА'}
            </button>
            <div className="demo-stage-grid">
              <div className="demo-stage-label">Быстрый старт:</div>
              <div className="demo-stage-btns">
                {[2, 3, 4, 5].map((stage) => (
                  <button
                    key={stage}
                    type="button"
                    className="btn-demo-stage"
                    onClick={() => onDemo(stage)}
                    disabled={demoLoading}
                  >
                    → {STAGE_LABELS[stage]}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <style>{`
        .auth-wrap{
          min-height:100vh; display:grid; place-items:center; padding:24px;
        }
        .auth-card{
          width:100%; max-width:420px;
          padding:38px 32px;
          border-radius:18px;
        }
        .auth-head{ text-align:center; margin-bottom:28px }
        .logo-mark{
          width:54px; height:54px; border-radius:14px;
          background:linear-gradient(135deg,#3B82F6,#2563EB);
          display:grid; place-items:center;
          margin:0 auto 16px;
          box-shadow:0 0 32px rgba(59,130,246,.55);
        }
        .logo-mark svg{width:26px; height:26px; stroke:#02060d}
        .auth-head h1{ font-size:14px; letter-spacing:.18em; color:#fff; margin-bottom:8px }
        .auth-head p{ font-size:13px; color:var(--muted) }

        .field{ display:block; margin-bottom:16px }
        .field span{ display:block; font-size:10px; letter-spacing:.2em; text-transform:uppercase; color:var(--muted); margin-bottom:8px }
        .field input{
          width:100%; padding:13px 16px;
          background:rgba(255,255,255,.04);
          border:1px solid var(--border);
          border-radius:10px; color:var(--text); font-size:14px;
          outline:none; transition:border-color .15s ease, box-shadow .15s ease;
        }
        .field input:focus{ border-color:var(--cyan-l); box-shadow:0 0 0 3px rgba(59,130,246,.15) }

        .error{
          margin:8px 0 14px; padding:10px 14px;
          border:1px solid rgba(248,113,113,.4);
          background:rgba(248,113,113,.08);
          color:#FCA5A5; font-size:12.5px; border-radius:10px;
        }
        .btn-primary{ width:100%; margin-top:8px }

        .ldap-warning{
          margin-bottom:16px; padding:10px 14px;
          border:1px solid rgba(251,191,36,.4);
          background:rgba(251,191,36,.08);
          color:#FCD34D; font-size:12px; border-radius:10px;
          text-align:center;
        }

        .demo-divider{
          display:flex; align-items:center; gap:12px;
          margin:20px 0 16px; color:var(--muted); font-size:11px;
          letter-spacing:.12em; text-transform:uppercase;
        }
        .demo-divider::before,.demo-divider::after{
          content:''; flex:1; height:1px; background:var(--border);
        }

        .btn-demo{
          width:100%; padding:13px 16px;
          background:transparent;
          border:1px solid var(--cyan-l);
          border-radius:12px; color:var(--cyan-l);
          font-size:12px; font-weight:700; letter-spacing:.14em;
          cursor:pointer; transition:all .18s ease;
          font-family:'Orbitron',sans-serif;
        }
        .btn-demo:hover:not(:disabled){
          background:rgba(0,242,254,.08);
          box-shadow:0 0 20px rgba(0,242,254,.2);
        }
        .btn-demo:disabled{opacity:.5;cursor:not-allowed}

        .btn-oidc{
          display:block; width:100%; padding:14px 16px; margin-bottom:8px;
          background:linear-gradient(135deg, rgba(37,99,235,.15), rgba(59,130,246,.1));
          border:1px solid rgba(37,99,235,.5); border-radius:12px;
          color:#93C5FD; font-size:12px; font-weight:700; letter-spacing:.14em;
          text-align:center; text-decoration:none;
          cursor:pointer; transition:all .18s ease;
          font-family:'Orbitron',sans-serif;
        }
        .btn-oidc:hover{
          background:linear-gradient(135deg, rgba(37,99,235,.25), rgba(59,130,246,.15));
          border-color:#3B82F6; box-shadow:0 0 20px rgba(59,130,246,.3);
        }

        .oidc-divider{
          display:flex; align-items:center; gap:12px;
          margin:14px 0; color:var(--muted); font-size:11px;
          letter-spacing:.12em; text-transform:uppercase;
        }
        .oidc-divider::before,.oidc-divider::after{
          content:''; flex:1; height:1px; background:var(--border);
        }

        .demo-stage-grid{margin-top:14px}
        .demo-stage-label{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-bottom:8px;text-align:center}
        .demo-stage-btns{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
        .btn-demo-stage{
          padding:8px 12px;background:rgba(0,242,254,.06);
          border:1px solid rgba(0,242,254,.2);border-radius:8px;
          color:var(--cyan-l);font-size:11px;font-weight:600;cursor:pointer;
          transition:all .15s ease;font-family:'Open Sans',sans-serif;
        }
        .btn-demo-stage:hover:not(:disabled){background:rgba(0,242,254,.12);border-color:var(--cyan-l)}
        .btn-demo-stage:disabled{opacity:.5;cursor:not-allowed}
      `}</style>
    </div>
  );
}
