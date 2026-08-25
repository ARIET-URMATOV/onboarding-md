import { NavLink, useLocation } from 'react-router-dom';
import { useOnboarding, getProgress } from '../../store/useOnboarding';

export function TopBar() {
  const { pathname } = useLocation();
  const user = useOnboarding((s) => s.user);
  const xp = useOnboarding((s) => s.xp);
  const doneTasks = useOnboarding((s) => s.doneTasks);
  const progress = getProgress(doneTasks);
  const lvl = Math.floor(xp / 100) + 1;
  const pct = progress.pct;
  const initials = user?.name.slice(0, 2).toUpperCase() || 'M';
  const isDashboard = pathname === '/dashboard';

  return (
    <header className={`topbar-min ${isDashboard ? 'mode-overlay' : 'mode-sticky'}`}>
      <div className="t-left">
        <nav className="t-nav">
          <NavLink to="/dashboard" className={({ isActive }) => `t-link ${isActive ? 'on' : ''}`}>
            Dashboard
          </NavLink>
          <NavLink to="/roadmap" className={({ isActive }) => `t-link ${isActive ? 'on' : ''}`}>
            Onboarding
          </NavLink>
        </nav>
      </div>

      <div className="t-right">
        <div className="t-xp" title={`${xp} XP · ${progress.done}/5 этапов`}>
          <span className="t-lvl">Lv.{lvl}</span>
          <div className="t-bar">
            <i style={{ width: `${pct}%` }} />
          </div>
          <span className="t-xpnum">{xp >= 1000 ? `${(xp / 1000).toFixed(1)}k` : `${xp}`} XP</span>
        </div>

        <div className="t-user">
          <div className="t-avatar">{initials}</div>
          <span className="t-name">{user?.name?.split(' ')[0] || 'Гость'}</span>
        </div>
      </div>

      <style>{`
        .topbar-min {
          left: 0; right: 0; z-index: 30;
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 48px; gap: 24px;
          animation: fadeDown 0.5s cubic-bezier(0.16, 1, 0.3, 1);
          transition: opacity .22s ease, transform .22s ease, visibility .22s;
        }
        body.modal-open .topbar-min {
          opacity: 0 !important; pointer-events: none !important; transform: translateY(-100%); visibility: hidden;
        }
        /* Dashboard: overlay transparent (hero image visible behind) */
        .topbar-min.mode-overlay {
          position: absolute; top: 0;
          height: 72px;
          background: transparent !important;
          backdrop-filter: none !important; -webkit-backdrop-filter: none !important;
          border: none !important; box-shadow: none !important;
        }
        /* Roadmap & others: sticky best-practice, no content jump */
        .topbar-min.mode-sticky {
          position: sticky; top: 0;
          height: 60px;
          background: rgba(11,7,25,0.82);
          backdrop-filter: blur(12px) saturate(1.15);
          -webkit-backdrop-filter: blur(12px) saturate(1.15);
          border-bottom: 1px solid rgba(37,99,235,0.14);
          box-shadow: 0 4px 24px rgba(0,0,0,.22);
        }

        .t-left { display: flex; align-items: center; gap: 32px; min-width: 0; }

        .t-brand {
          display: flex; align-items: center; gap: 10px;
          text-decoration: none; flex-shrink: 0;
        }
        .t-brand img {
          width: 26px; height: 26px; object-fit: contain;
          filter: drop-shadow(0 0 10px rgba(37, 99, 235, 0.5));
        }
        .t-brand-name {
          font-family: 'Inter', sans-serif;
          font-size: 14px; font-weight: 800; letter-spacing: 0.14em;
          color: rgba(255, 255, 255, 0.95);
          text-shadow: 0 2px 20px rgba(0, 0, 0, 0.4);
        }

        .t-nav { display: flex; gap: 32px; align-items: center; }

        .t-link {
          font-family: 'Inter', -apple-system, sans-serif;
          font-size: 14px; font-weight: 500;
          color: rgba(255, 255, 255, 0.35);
          padding: 8px 0; position: relative;
          transition: color 0.25s ease; text-decoration: none;
          letter-spacing: 0.3px; text-shadow: 0 2px 20px rgba(0, 0, 0, 0.4);
        }
        .t-link:hover { color: rgba(255, 255, 255, 0.7); }
        .t-link.on { color: rgba(255, 255, 255, 0.95); }
        .t-link.on::after {
          content: ''; position: absolute; bottom: -2px; left: 0; right: 0;
          height: 2px; background: #2563EB; border-radius: 2px;
          box-shadow: 0 0 16px rgba(37, 99, 235, 0.45);
          animation: linkSlide 0.3s ease;
        }
        @keyframes linkSlide { from{ transform:scaleX(0); opacity:0 } to{ transform:scaleX(1); opacity:1 } }

        .t-right { display: flex; align-items: center; gap: 16px; flex-shrink: 0; }

        .t-xp {
          display: flex; align-items: center; gap: 10px; padding: 8px 14px;
          background: rgba(37, 99, 235, 0.06); border-radius: 8px;
          border: 1px solid rgba(37, 99, 235, 0.08);
          backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
          transition: all 0.25s ease;
        }
        .t-xp:hover { background: rgba(37, 99, 235, 0.12); border-color: rgba(37, 99, 235, 0.15); }
        .t-lvl { font-size: 12px; font-weight: 600; color: rgba(37, 99, 235, 0.8); font-family: 'Inter', sans-serif; letter-spacing: 0.5px; text-shadow: 0 2px 12px rgba(0,0,0,0.2); }
        .t-bar { width: 52px; height: 3px; border-radius: 2px; background: rgba(37, 99, 235, 0.16); overflow: hidden; }
        .t-bar i { display: block; height: 100%; background: linear-gradient(90deg, #2563EB, #1E3A8A); border-radius: 2px; transition: width 0.6s ease; box-shadow: 0 0 12px rgba(37,99,235,0.35); }
        .t-xpnum { font-size: 12px; font-weight: 500; color: rgba(255, 255, 255, 0.35); font-family: 'Inter', sans-serif; text-shadow: 0 2px 12px rgba(0,0,0,0.2); }

        .t-user {
          display: flex; align-items: center; gap: 10px; padding: 6px 16px 6px 6px; border-radius: 8px;
          background: rgba(37, 99, 235, 0.06); border: 1px solid rgba(37, 99, 235, 0.08);
          backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); transition: all 0.25s ease; cursor: pointer;
        }
        .t-user:hover { background: rgba(37, 99, 235, 0.12); border-color: rgba(37, 99, 235, 0.15); }
        .t-avatar { width: 32px; height: 32px; border-radius: 6px; display: grid; place-items: center; background: linear-gradient(135deg, #2563EB, #1E3A8A); color: #fff; font-size: 12px; font-weight: 700; font-family: 'Inter', sans-serif; letter-spacing: 0.5px; box-shadow: 0 0 20px rgba(37,99,235,0.22); }
        .t-name { font-size: 14px; font-weight: 500; color: rgba(255, 255, 255, 0.7); font-family: 'Inter', sans-serif; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-shadow: 0 2px 12px rgba(0,0,0,0.2); }

        @media (max-width: 820px) {
          .topbar-min { padding: 0 32px; }
          .topbar-min.mode-overlay { height: 68px; }
          .topbar-min.mode-sticky { height: 56px; }
          .t-left { gap: 24px; }
          .t-nav { gap: 28px; } .t-link { font-size: 15px; padding: 10px 0; }
          .t-xp .t-lvl { display: none; } .t-xp .t-xpnum { display: none; }
          .t-bar { width: 40px; } .t-xp { padding: 6px 10px; }
          .t-user { padding: 4px 12px 4px 4px; } .t-name { font-size: 13px; max-width: 80px; }
        }
        @media (max-width: 640px) {
          .topbar-min { padding: 0 18px; }
          .topbar-min.mode-overlay { height: 64px; }
          .topbar-min.mode-sticky { height: 56px; }
          .t-left { gap: 18px; }
          .t-brand-name { display: none; }
          .t-brand img { width: 24px; height: 24px; }
          .t-nav { gap: 22px; } .t-link { font-size: 15.5px; font-weight:600; padding: 10px 0; color: rgba(255,255,255,0.92); letter-spacing:.01em; min-height:44px; display:inline-flex; align-items:center; }
          .t-right { gap: 12px; }
          .t-xp { padding: 6px 10px; gap: 8px; background: rgba(37,99,235,0.04); border-color: rgba(37,99,235,0.04); }
          .t-bar { width: 32px; height: 2.5px; }
          .t-user { padding: 4px 10px 4px 4px; background: rgba(37,99,235,0.04); border-color: rgba(37,99,235,0.04); }
          .t-avatar { width: 28px; height: 28px; font-size: 10px; }
          .t-name { font-size: 12px; max-width: 60px; color: rgba(255,255,255,0.5); }
        }
        @media (max-width: 480px) {
          .topbar-min { padding: 0 16px; }
          .topbar-min.mode-overlay { height: 58px; }
          .topbar-min.mode-sticky { height: 54px; }
          .t-nav { gap: 18px; } .t-link { font-size: 15px; font-weight:600; color: rgba(255,255,255,0.92); min-height:44px; display:inline-flex; align-items:center; }
          .t-right { gap: 10px; } .t-xp { display: none; }
          .t-user { padding: 3px 8px 3px 3px; background: rgba(37,99,235,0.03); border-color: rgba(37,99,235,0.03); }
          .t-avatar { width: 24px; height: 24px; font-size: 9px; } .t-name { font-size: 11px; max-width: 50px; }
        }
        @media (max-width: 380px) {
          .topbar-min { padding: 0 12px; }
          .topbar-min.mode-overlay { height: 52px; } .topbar-min.mode-sticky { height: 52px; }
          .t-nav { gap: 16px; } .t-link { font-size: 14px; font-weight:600; letter-spacing: 0.01em; min-height:44px; display:inline-flex; align-items:center; }
          .t-name { display: none; } .t-user { padding: 3px; }
        }
        @keyframes fadeDown { from{ opacity:0; transform:translateY(-10px)} to{ opacity:1; transform:translateY(0)} }
      `}</style>
    </header>
  );
}
