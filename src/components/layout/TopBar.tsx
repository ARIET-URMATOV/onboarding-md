import { Link, NavLink, useLocation } from 'react-router-dom';
import { useOnboarding } from '../../store/useOnboarding';

export function TopBar() {
  const { pathname } = useLocation();
  const user = useOnboarding((s) => s.user);
  const initials = user?.name.slice(0, 2).toUpperCase() || 'M';
  const isDash = pathname === '/dashboard';

  return (
    <header className="topbar-min">
      <div className="t-left">
        <Link to="/dashboard" className="t-logo" aria-label="MDIGITAL home">
          <span className="t-mark">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2l3 4-3 4-3-4 3-4z" /><path d="M4 7l4 3v7l-4-3V7z" /><path d="M20 7l-4 3v7l4-3V7z" /><path d="M8 17l4 3 4-3" />
            </svg>
          </span>
          <span className="t-wordmark font-orbitron">MDIGITAL</span>
          <span className="t-dot" />
        </Link>
        <nav className="t-nav">
          <NavLink to="/dashboard" className={({ isActive }) => `t-link font-orbitron ${isActive ? 'on' : ''}`}>Dashboard</NavLink>
          <NavLink to="/roadmap" className={({ isActive }) => `t-link font-orbitron ${isActive ? 'on' : ''}`}>Onboarding</NavLink>
        </nav>
      </div>

      <div className="t-right">
        <div className="t-user">
          <span className="t-avatar font-orbitron">{initials}</span>
          {!isDash && <span className="t-name">{user?.name?.split(' ')[0] || 'Гость'}</span>}
        </div>
      </div>

      <style>{`
        .topbar-min{
          position:sticky; top:0; z-index:30;
          height:56px; display:flex; align-items:center; justify-content:space-between;
          padding:0 60px; gap:18px;
          background:rgba(11,7,25,0.72); backdrop-filter:blur(12px) saturate(1.2);
          border-bottom:1px solid rgba(139,92,246,0.12);
        }
        .t-left{ display:flex; align-items:center; gap:36px; min-width:0 }
        .t-logo{ display:flex; align-items:center; gap:10px; text-decoration:none }
        .t-mark{
          width:26px; height:26px; border-radius:7px; display:grid; place-items:center;
          background:linear-gradient(135deg,#ec4899,#8b5cf6); box-shadow:0 0 16px rgba(236,72,153,.35);
        }
        .t-mark svg{ width:15px; height:15px; stroke:#fff }
        .t-wordmark{ font-family:'Orbitron',sans-serif; font-size:13px; font-weight:900; letter-spacing:2px; color:#f472b6; text-transform:uppercase; text-shadow:0 0 12px rgba(244,114,182,.5) }
        .t-dot{ width:4px; height:4px; border-radius:50%; background:#f472b6; box-shadow:0 0 8px #f472b6; margin-left:2px }
        .t-nav{ display:flex; gap:36px; align-items:center }
        .t-link{ font-family:'Manrope',sans-serif; font-size:12px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; color:#8c88a6; padding:6px 0; border-bottom:1px solid transparent; transition:color .16s, border-color .16s }
        .t-link:hover{ color:#fff }
        .t-link.on{ color:#fff; border-color:rgba(244,114,182,.7) }
        .t-right{ display:flex; align-items:center; gap:16px; flex-shrink:0 }
        .t-xp{ display:flex; align-items:center; gap:8px; padding:6px 10px; border-radius:999px; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.06) }
        .t-lvl{ font-size:10px; color:#f9a8d4; font-weight:700; letter-spacing:.06em }
        .t-sep{ width:1px; height:12px; background:rgba(255,255,255,.12) }
        .t-xpnum{ font-size:11px; color:var(--muted); letter-spacing:.02em }
        .t-bar{ width:56px; height:2px; border-radius:2px; background:rgba(255,255,255,.08); overflow:hidden; display:inline-block; vertical-align:middle }
        .t-bar i{ display:block; height:100%; background:linear-gradient(90deg,#f472b6,#8B5CF6); box-shadow:0 0 8px rgba(244,114,182,.6) }
        .t-user{ display:flex; align-items:center; gap:8px; background:rgba(255,255,255,.03); border:1px solid rgba(140,136,166,.18); padding:4px 14px 4px 4px; border-radius:999px }
        .t-avatar{
          width:30px; height:30px; border-radius:50%; display:grid; place-items:center;
          background:linear-gradient(135deg,#d946ef,#8b5cf6); color:#fff; font-size:11px; font-weight:700;
          box-shadow:0 0 10px rgba(217,70,239,.35);
        }
        .t-name{ font-size:13px; font-weight:600; color:#e2e8f0; letter-spacing:.01em; max-width:110px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap }
        @media (max-width: 760px){
          .t-nav{ display:none }
          .topbar-min{ padding:0 20px }
        }
      `}</style>
    </header>
  );
}
