import { useEffect, useState } from 'react';
import { Bell, User as UserIcon, Sparkles, BellDot } from 'lucide-react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useOnboarding, getProgress } from '../../store/useOnboarding';
import { api } from '../../api/client';

export function DefaultAvatar({ size = 18 }: { size?: number }) {
  return <UserIcon size={size} color="#8FA3B8" />;
}

export function TopBar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const user = useOnboarding((s) => s.user);
  const xp = useOnboarding((s) => s.xp);
  const doneTasks = useOnboarding((s) => s.doneTasks);
  const progress = getProgress(doneTasks);
  const lvl = Math.floor(xp / 100) + 1;
  const pct = Math.min(100, Math.max(0, progress.pct));
  const isDashboard = pathname === '/dashboard';
  const isStaff = user?.isStaff ?? false;
  const [pendingCount, setPendingCount] = useState(0);
  const unreadCount = useOnboarding((s) => s.unreadCount);
  const fetchNotifications = useOnboarding((s) => s.fetchNotifications);
  const markAllNotificationsRead = useOnboarding((s) => s.markAllNotificationsRead);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const notifications = useOnboarding((s) => s.notifications);

  // HR Notification Count Polling (30s)
  useEffect(() => {
    if (!isStaff) {
      setPendingCount(0);
      return;
    }
    let alive = true;
    const fetchCount = () => {
      api
        .get<{ pending: number }>('/api/admin/pending-count')
        .then((r) => {
          if (alive) setPendingCount(r.pending);
        })
        .catch(() => {});
    };
    fetchCount();
    const id = setInterval(fetchCount, 30000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [isStaff]);

  // Employee notifications: fetch on mount
  useEffect(() => {
    if (!isStaff) {
      fetchNotifications();
      const id = setInterval(fetchNotifications, 60000);
      return () => clearInterval(id);
    }
  }, [isStaff, fetchNotifications]);

  return (
    <header className={`topbar-wrapper ${isDashboard ? 'mode-overlay' : 'mode-sticky'}`}>
      {/* Navigation */}
      <div className="t-left">
        <nav className="t-nav">
          <NavLink to="/dashboard" className={({ isActive }) => `t-link ${isActive ? 'on' : ''}`}>
            <span>Dashboard</span>
          </NavLink>
          <NavLink to="/stages" className={({ isActive }) => `t-link ${isActive ? 'on' : ''}`}>
            <span>Onboarding</span>
          </NavLink>
        </nav>
      </div>

      {/* User Actions & Stats */}
      <div className="t-right">
        {/* HR Staff Notification Bell */}
        {isStaff && (
          <button
            type="button"
            className="t-icon-btn t-bell"
            onClick={() => navigate('/admin')}
            title="HR Panel: Pending Requests"
            aria-label="Open HR Panel"
          >
            <Bell size={18} />
            {pendingCount > 0 && (
              <span className="t-bell-badge">
                {pendingCount > 99 ? '99+' : pendingCount}
              </span>
            )}
          </button>
        )}

        {/* Employee Notification Bell */}
        {!isStaff && (
          <button
            type="button"
            className="t-icon-btn t-bell"
            onClick={() => setShowNotifPanel(!showNotifPanel)}
            title="Уведомления"
            aria-label="Уведомления"
          >
            {unreadCount > 0 ? <BellDot size={18} className="notif-active" /> : <Bell size={18} />}
            {unreadCount > 0 && (
              <span className="t-bell-badge">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        )}

        {/* Employee Notification Panel */}
        {!isStaff && showNotifPanel && (
          <div className="notif-panel">
            <div className="notif-panel-head">
              <span>Уведомления</span>
              {unreadCount > 0 && (
                <button type="button" className="notif-mark-all" onClick={() => markAllNotificationsRead()}>
                  Прочитать все
                </button>
              )}
            </div>
            <div className="notif-panel-list">
              {notifications.length === 0 && (
                <div className="notif-empty">Нет уведомлений</div>
              )}
              {notifications.slice(0, 20).map((n) => (
                <div
                  key={n.id}
                  className={`notif-item ${n.read ? '' : 'unread'}`}
                  onClick={() => { if (!n.read) useOnboarding.getState().markNotificationRead(n.id); }}
                >
                  <div className="notif-item-title">{n.title}</div>
                  {n.body && <div className="notif-item-body">{n.body}</div>}
                  {n.created_at && <div className="notif-item-time">{new Date(n.created_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Level & XP Widget */}
        <div className="t-xp-widget" title={`${xp} XP · ${progress.done}/5 Tasks Completed`}>
          <div className="t-xp-head">
            <div className="t-badge">
              <Sparkles size={11} className="t-badge-icon" />
              <span>Lv.{lvl}</span>
            </div>
            <span className="t-xp-val">
              {xp >= 1000 ? `${(xp / 1000).toFixed(1)}k` : xp} <small>XP</small>
            </span>
          </div>
          <div className="t-progress-track">
            <div className="t-progress-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* User Profile Button */}
        <button
          type="button"
          className="t-user-btn"
          onClick={() => navigate('/profile')}
          title="Profile"
          aria-label="Open Profile"
        >
          <div className="t-avatar-ring">
            {user?.avatar ? (
              <img src={user.avatar} alt={user.name || 'User Avatar'} className="t-avatar-img" />
            ) : (
              <div className="t-avatar-fallback">
                <DefaultAvatar />
              </div>
            )}
          </div>
          <span className="t-user-name">{user?.name?.split(' ')[0] || 'Guest'}</span>
        </button>
      </div>

      <style>{`
        .topbar-wrapper {
          left: 0;
          right: 0;
          z-index: 40;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 40px;
          box-sizing: border-box;
          animation: topbarFade 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          transition: background 0.3s ease, border-color 0.3s ease, transform 0.25s ease, opacity 0.25s ease;
        }

        body.modal-open .topbar-wrapper {
          opacity: 0 !important;
          pointer-events: none !important;
          transform: translateY(-100%);
          visibility: hidden;
        }

        /* Mode: Transparent Overlay (Dashboard) */
        .topbar-wrapper.mode-overlay {
          position: absolute;
          top: 0;
          height: 76px;
          background: transparent;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        /* Mode: Glassmorphic Sticky (Roadmap & others) */
        .topbar-wrapper.mode-sticky {
          position: sticky;
          top: 0;
          height: 68px;
          background: rgba(13, 16, 27, 0.75);
          backdrop-filter: blur(16px) saturate(180%);
          -webkit-backdrop-filter: blur(16px) saturate(180%);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.36);
        }

        /* Left Navigation */
        .t-left {
          display: flex;
          align-items: center;
          gap: 24px;
        }

        .t-nav {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .t-link {
          position: relative;
          display: inline-flex;
          align-items: center;
          padding: 8px 16px;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 14px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.55);
          text-decoration: none;
          border-radius: 10px;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .t-link:hover {
          color: rgba(255, 255, 255, 0.9);
          background: rgba(255, 255, 255, 0.04);
        }

        .t-link.on {
          color: #ffffff;
          font-weight: 600;
          background: rgba(255, 255, 255, 0.07);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1);
        }

        .t-link.on::after {
          content: '';
          position: absolute;
          bottom: 4px;
          left: 50%;
          transform: translateX(-50%);
          width: 16px;
          height: 2px;
          background: #3b82f6;
          border-radius: 4px;
          box-shadow: 0 0 10px #3b82f6;
        }

        /* Right Section */
        .t-right {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        /* Icon Button / HR Bell */
        .t-icon-btn {
          position: relative;
          width: 40px;
          height: 40px;
          border-radius: 12px;
          display: grid;
          place-items: center;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: rgba(255, 255, 255, 0.75);
          cursor: pointer;
          outline: none;
          transition: all 0.2s ease;
        }

        .t-icon-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.15);
          color: #ffffff;
          transform: translateY(-1px);
        }

        .t-bell-badge {
          position: absolute;
          top: -3px;
          right: -3px;
          min-width: 18px;
          height: 18px;
          padding: 0 5px;
          border-radius: 99px;
          background: linear-gradient(135deg, #ef4444, #dc2626);
          color: #ffffff;
          font-size: 10px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid #0d101b;
          box-shadow: 0 0 12px rgba(239, 68, 68, 0.5);
        }

        /* XP & Level Widget */
        .t-xp-widget {
          display: flex;
          flex-direction: column;
          gap: 5px;
          padding: 6px 14px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          min-width: 120px;
          backdrop-filter: blur(8px);
          transition: all 0.2s ease;
        }

        .t-xp-widget:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.14);
        }

        .t-xp-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .t-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          font-weight: 700;
          color: #60a5fa;
          letter-spacing: 0.3px;
        }

        .t-badge-icon {
          color: #93c5fd;
        }

        .t-xp-val {
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
        }

        .t-xp-val small {
          font-size: 9px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.35);
          text-transform: uppercase;
        }

        .t-progress-track {
          width: 100%;
          height: 4px;
          border-radius: 99px;
          background: rgba(255, 255, 255, 0.08);
          overflow: hidden;
        }

        .t-progress-fill {
          height: 100%;
          border-radius: 99px;
          background: linear-gradient(90deg, #2563eb, #60a5fa);
          box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
          transition: width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        /* Profile Button */
        .t-user-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 4px 14px 4px 5px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 99px;
          cursor: pointer;
          outline: none;
          transition: all 0.2s ease;
        }

        .t-user-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.16);
          transform: translateY(-1px);
        }

        .t-avatar-ring {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: linear-gradient(135deg, #1e293b, #0f172a);
          border: 1px solid rgba(255, 255, 255, 0.15);
          display: grid;
          place-items: center;
          overflow: hidden;
          flex-shrink: 0;
        }

        .t-avatar-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .t-avatar-fallback {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .t-user-name {
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 13px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.85);
          max-width: 100px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        /* Responsive Breakpoints */
        @media (max-width: 768px) {
          .topbar-wrapper {
            padding: 0 20px;
          }
          .t-xp-widget {
            display: none;
          }
        }

        @media (max-width: 480px) {
          .topbar-wrapper {
            padding: 0 14px;
          }
          .t-nav {
            gap: 2px;
          }
          .t-link {
            padding: 6px 10px;
            font-size: 13px;
          }
          .t-user-name {
            display: none;
          }
          .t-user-btn {
            padding: 4px;
          }
        }

        @keyframes topbarFade {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .notif-active { color: #FBBF24; }

        .notif-panel {
          position: absolute;
          top: 100%;
          right: 16px;
          width: 340px;
          max-height: 420px;
          background: rgba(13, 16, 27, 0.95);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          box-shadow: 0 12px 40px rgba(0,0,0,0.5);
          z-index: 50;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: notifIn 0.18s ease;
        }
        @keyframes notifIn {
          from { opacity: 0; transform: translateY(-6px) scale(0.97); }
          to { opacity: 1; transform: none; }
        }
        .notif-panel-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 14px;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          font-size: 13px;
          font-weight: 700;
          color: rgba(255,255,255,0.85);
        }
        .notif-mark-all {
          font-size: 11px;
          color: #60A5FA;
          background: none;
          border: none;
          cursor: pointer;
          padding: 2px 6px;
          border-radius: 6px;
        }
        .notif-mark-all:hover { background: rgba(59,130,246,0.12); }
        .notif-panel-list {
          overflow-y: auto;
          flex: 1;
          max-height: 360px;
          scrollbar-width: thin;
        }
        .notif-empty {
          padding: 28px 14px;
          text-align: center;
          font-size: 12px;
          color: rgba(255,255,255,0.35);
        }
        .notif-item {
          padding: 10px 14px;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          cursor: pointer;
          transition: background 0.12s;
        }
        .notif-item:hover { background: rgba(255,255,255,0.03); }
        .notif-item.unread {
          background: rgba(59,130,246,0.04);
          border-left: 3px solid #3B82F6;
        }
        .notif-item-title {
          font-size: 12.5px;
          font-weight: 600;
          color: rgba(255,255,255,0.85);
          margin-bottom: 2px;
        }
        .notif-item-body {
          font-size: 11.5px;
          color: rgba(255,255,255,0.5);
          line-height: 1.45;
        }
        .notif-item-time {
          font-size: 10px;
          color: rgba(255,255,255,0.25);
          margin-top: 4px;
          font-variant-numeric: tabular-nums;
        }

        @media (max-width: 480px) {
          .notif-panel { width: calc(100vw - 20px); right: 10px; }
        }
      `}</style>
    </header>
  );
}