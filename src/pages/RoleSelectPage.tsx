import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROLES } from '../data/stages';
import { mockSetRole } from '../api/mock';
import { useOnboarding } from '../store/useOnboarding';
import type { Role } from '../data/stages';
import { usePageMeta } from '../hooks/usePageMeta';

export function RoleSelectPage() {
  usePageMeta("Выбор роли — MDIGITAL Онбординг", "Выбери свою роль в MDIGITAL, чтобы настроить персональный путь онбординга.");
  const [picked, setPicked] = useState<Role | null>(null);
  const [loading, setLoading] = useState(false);
  const setRole = useOnboarding((s) => s.setRole);
  const nav = useNavigate();

  const onPick = async (role: Role) => {
    setPicked(role);
    setLoading(true);
    await mockSetRole(role);
    setRole(role);
    setLoading(false);
    nav('/dashboard');
  };

  return (
    <div className="role-wrap">
      <div className="role-head">
        <div className="pill">РЁРђР“ 0 / 1</div>
        <h1 className="font-orbitron">Р’С‹Р±РµСЂРё СЃРІРѕСЋ СЂРѕР»СЊ</h1>
        <p>Р­С‚Рѕ РїРѕРјРѕР¶РµС‚ РЅР°Рј РЅР°СЃС‚СЂРѕРёС‚СЊ С‚РІРѕР№ РїСѓС‚СЊ РѕРЅР±РѕСЂРґРёРЅРіР°. РџРѕС‚РѕРј РјРѕР¶РЅРѕ РёР·РјРµРЅРёС‚СЊ.</p>
      </div>

      <div className="role-grid">
        {ROLES.map((r) => (
          <button
            key={r.id}
            className={`role-card ${picked === r.id ? 'is-loading' : ''}`}
            onClick={() => onPick(r.id)}
            disabled={loading}
            style={{ ['--accent' as any]: r.color }}
          >
            <div className="role-icon">
              {r.id === 'frontend' && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
                </svg>
              )}
              {r.id === 'backend' && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                  <ellipse cx="12" cy="5" rx="9" ry="3" />
                  <path d="M3 5v6c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
                  <path d="M3 11v6c0 1.66 4.03 3 9 3s9-1.34 9-3v-6" />
                </svg>
              )}
              {r.id === 'design' && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="13.5" cy="6.5" r=".5" /><circle cx="17.5" cy="10.5" r=".5" /><circle cx="8.5" cy="7.5" r=".5" /><circle cx="6.5" cy="12.5" r=".5" />
                  <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
                </svg>
              )}
            </div>
            <div className="role-title font-orbitron">{r.title}</div>
            <div className="role-sub">{r.subtitle}</div>
            <div className="role-go">Р’Р«Р‘Р РђРўР¬ в†’</div>
          </button>
        ))}
      </div>

      <style>{`
        .role-wrap{
          min-height:100vh; display:flex; flex-direction:column;
          align-items:center; justify-content:center; padding:48px 24px;
        }
        .role-head{ text-align:center; max-width:560px; margin-bottom:42px }
        .role-head h1{ font-size:clamp(28px, 4vw, 42px); letter-spacing:.04em; margin:18px 0 12px }
        .role-head p{ color:var(--muted); font-size:14px; line-height:1.7 }

        .role-grid{
          display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 280px));
          gap:18px; width:100%; max-width:920px;
        }
        .role-card{
          position:relative;
          padding:32px 24px;
          background:rgba(8,16,28,.6);
          border:1px solid var(--border);
          border-radius:18px;
          text-align:left;
          transition:transform .2s ease, border-color .2s ease, background .2s ease;
          overflow:hidden;
        }
        .role-card::before{
          content:''; position:absolute; inset:0;
          background:radial-gradient(circle at 30% 0%, var(--accent), transparent 60%);
          opacity:0; transition:opacity .25s ease;
        }
        .role-card:hover{
          transform:translateY(-4px);
          border-color:var(--accent);
          background:rgba(8,16,28,.85);
        }
        .role-card:hover::before{ opacity:.15 }
        .role-card.is-loading{ opacity:.6; pointer-events:none }

        .role-icon{
          width:48px; height:48px; border-radius:12px;
          display:grid; place-items:center;
          background:rgba(255,255,255,.04);
          color:var(--accent);
          margin-bottom:18px;
        }
        .role-icon svg{ width:24px; height:24px }
        .role-title{ font-size:20px; font-weight:700; color:#fff; margin-bottom:6px }
        .role-sub{ font-size:12px; color:var(--muted); margin-bottom:22px }
        .role-go{
          font-family:'Orbitron',sans-serif;
          font-size:10.5px; letter-spacing:.2em; color:var(--accent);
          display:flex; align-items:center; gap:6px;
        }
      `}</style>
    </div>
  );
}
