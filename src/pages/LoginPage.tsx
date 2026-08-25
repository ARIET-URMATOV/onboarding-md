import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { mockLogin } from '../api/mock';
import { useOnboarding } from '../store/useOnboarding';
import { usePageMeta } from '../hooks/usePageMeta';

export function LoginPage() {
  usePageMeta("Вход — MDIGITAL Онбординг", "Войди в портал онбординга MDIGITAL, чтобы продолжить адаптацию и отслеживать прогресс этапов.");
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const login = useOnboarding((s) => s.login);
  const nav = useNavigate();

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError('Р—Р°РїРѕР»РЅРё РІСЃРµ РїРѕР»СЏ');
      return;
    }
    setLoading(true);
    const res = await mockLogin({ email, password });
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    login(res.user);
    nav('/role');
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
          <p>Р’РѕР№РґРё, С‡С‚РѕР±С‹ РїСЂРѕРґРѕР»Р¶РёС‚СЊ РїСѓС‚СЊ</p>
        </div>

        <form onSubmit={onSubmit}>
          <label className="field">
            <span>Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@mdigital.io" required />
          </label>
          <label className="field">
            <span>РџР°СЂРѕР»СЊ</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="вЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂў" required minLength={6} />
          </label>
          {error && <div className="error">{error}</div>}
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Р’С…РѕРґРёРјвЂ¦' : 'Р’РћР™РўР в†’'}
          </button>
        </form>

        <div className="auth-foot">
          РќРµС‚ Р°РєРєР°СѓРЅС‚Р°? <Link to="/register">Р—Р°СЂРµРіРёСЃС‚СЂРёСЂРѕРІР°С‚СЊСЃСЏ</Link>
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

        .auth-foot{
          text-align:center; margin-top:22px; font-size:12.5px; color:var(--muted);
        }
        .auth-foot a{ color:var(--cyan-l); font-weight:600 }
        .auth-foot a:hover{ text-decoration:underline }
      `}</style>
    </div>
  );
}
