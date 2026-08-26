import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, type MeResponse } from '../api/client';
import { useOnboarding } from '../store/useOnboarding';
import { usePageMeta } from '../hooks/usePageMeta';

export function LoginPage() {
  usePageMeta("Вход — MDIGITAL Онбординг", "Войди в портал онбординга MDIGITAL, чтобы продолжить адаптацию и отслеживать прогресс этапов.");
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoResetting, setDemoResetting] = useState(false);
  const [demoResetDone, setDemoResetDone] = useState(false);
  const login = useOnboarding((s) => s.login);
  const nav = useNavigate();

  const onDemoLogin = async () => {
    setError(null);
    setDemoLoading(true);
    try {
      const me = await api.post<MeResponse>('/api/demo/login');
      login(me);
      nav(me.user.role ? '/dashboard' : '/role');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка демо-входа');
    } finally {
      setDemoLoading(false);
    }
  };

  const onDemoReset = async () => {
    setDemoResetting(true);
    try {
      await api.post('/api/demo/reset');
      setDemoResetDone(true);
      window.setTimeout(() => setDemoResetDone(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сброса демо');
    } finally {
      setDemoResetting(false);
    }
  };

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
      nav(me.user.role ? '/dashboard' : '/role');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка входа');
    } finally {
      setLoading(false);
    }
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

        <form onSubmit={onSubmit}>
          <label className="field">
            <span>Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@mdigital.io" required />
          </label>
          <label className="field">
            <span>Пароль</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
          </label>
          {error && <div className="error">{error}</div>}
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Входим…' : 'ВОЙТИ →'}
          </button>
        </form>

        <div className="auth-foot">
          Нет аккаунта? <Link to="/register">Зарегистрироваться</Link>
        </div>

        <div className="demo-block">
          <div className="demo-label">Демо-режим</div>
          <button
            type="button"
            className="demo-creds"
            onClick={() => { setEmail('demo@mdigital.kg'); setPassword('demo1234'); }}
            title="Нажми, чтобы подставить в форму"
          >
            demo@mdigital.kg · demo1234
          </button>
          <div className="demo-actions">
            <button type="button" className="demo-btn" disabled={demoLoading} onClick={onDemoLogin}>
              {demoLoading ? 'Входим…' : 'Войти в демо'}
            </button>
            <button type="button" className="demo-btn ghost" disabled={demoResetting} onClick={onDemoReset}>
              {demoResetting ? 'Сброс…' : demoResetDone ? 'Сброшен ✓' : 'Сбросить демо'}
            </button>
          </div>
        </div>
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

        .demo-block{
          margin-top:22px; padding-top:18px;
          border-top:1px dashed rgba(255,255,255,.1);
          text-align:center;
        }
        .demo-label{
          font-size:9.5px; font-weight:700; letter-spacing:.22em; text-transform:uppercase;
          color:rgba(96,165,250,.75); margin-bottom:8px;
        }
        .demo-creds{
          display:inline-block; padding:6px 14px; margin-bottom:12px;
          font-family:'JetBrains Mono',monospace; font-size:11.5px;
          color:#93C5FD; background:rgba(37,99,235,.08);
          border:1px solid rgba(37,99,235,.22); border-radius:8px;
          cursor:pointer; transition:all .15s ease;
        }
        .demo-creds:hover{ background:rgba(37,99,235,.16); border-color:rgba(37,99,235,.4); color:#DBEAFE }
        .demo-actions{ display:flex; gap:10px; justify-content:center; flex-wrap:wrap }
        .demo-btn{
          padding:8px 16px; border-radius:9px; cursor:pointer;
          font-size:11.5px; font-weight:600; letter-spacing:.04em;
          color:#fff; background:linear-gradient(135deg,#3B82F6,#2563EB);
          border:1px solid rgba(59,130,246,.5);
          box-shadow:0 0 14px rgba(37,99,235,.25);
          transition:all .15s ease;
        }
        .demo-btn:hover:not(:disabled){ transform:translateY(-1px); box-shadow:0 0 20px rgba(37,99,235,.4) }
        .demo-btn:disabled{ opacity:.6; cursor:wait }
        .demo-btn.ghost{
          background:transparent; color:#93C5FD;
          border:1px solid rgba(37,99,235,.3); box-shadow:none;
        }
        .demo-btn.ghost:hover:not(:disabled){ background:rgba(37,99,235,.1); color:#fff }

        .auth-foot{
          text-align:center; margin-top:22px; font-size:12.5px; color:var(--muted);
        }
        .auth-foot a{ color:var(--cyan-l); font-weight:600 }
        .auth-foot a:hover{ text-decoration:underline }
      `}</style>
    </div>
  );
}
