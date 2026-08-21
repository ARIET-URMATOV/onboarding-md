import { useEffect, type ReactNode } from 'react';

interface PanelShellProps {
  title: string;
  subtitle: string;
  iconPath: string;
  children: ReactNode;
  onClose: () => void;
  primary: ReactNode;
}

export function PanelShell({ title, subtitle, iconPath, children, onClose, primary }: PanelShellProps) {
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    const prevOverscroll = document.documentElement.style.overscrollBehavior;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'contain';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.documentElement.style.overscrollBehavior = prevOverscroll;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <>
      <div className="veil" onClick={onClose} />
      <aside className="panel-shell" role="dialog" aria-modal="true">
        <div className="ps-top">
          <div className="ps-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
              <path d={iconPath} />
            </svg>
          </div>
          <div className="ps-head">
            <div className="ps-title font-orbitron">{title}</div>
            <div className="ps-sub font-orbitron">{subtitle}</div>
          </div>
          <button className="ps-close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <div className="ps-body">{children}</div>
        <div className="ps-foot">
          <button onClick={onClose} className="btn-ghost sm">Закрыть</button>
          {primary}
        </div>
      </aside>

      <style>{`
        .veil{
          position:fixed; inset:0; z-index:40;
          background:rgba(4,6,15,.68); backdrop-filter:blur(10px) saturate(1.1);
          animation:veilIn .22s ease;
        }
        @keyframes veilIn{ from{opacity:0} to{opacity:1} }
        .panel-shell{
          position:fixed; left:50%; top:50%; transform:translate(-50%,-50%);
          width:min(560px, calc(100vw - 24px)); max-height:86vh;
          z-index:41; display:flex; flex-direction:column;
          border:1px solid rgba(249,168,212,.18);
          border-radius:20px;
          background:
            radial-gradient(600px 180px at 50% 0%, rgba(244,114,182,.08), transparent 70%),
            linear-gradient(180deg, rgba(14,22,38,.96), rgba(6,12,24,.98));
          backdrop-filter:blur(18px); box-shadow:0 24px 64px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.04) inset;
          overflow:hidden;
          animation:panelIn .34s cubic-bezier(.2,.8,.2,1);
        }
        @keyframes panelIn{ from{ opacity:0; transform:translate(-50%,-46%) scale(.98)} to{ opacity:1; transform:translate(-50%,-50%) scale(1)} }
        .ps-top{
          display:flex; align-items:center; gap:12px;
          padding:16px 18px;
          border-bottom:1px solid rgba(255,255,255,.06);
          background:linear-gradient(90deg, rgba(244,114,182,.06), transparent);
        }
        .ps-icon{
          width:32px; height:32px; border-radius:8px;
          background:rgba(244,114,182,.10); border:1px solid rgba(244,114,182,.22);
          display:grid; place-items:center; color:var(--cyan-l); flex-shrink:0;
        }
        .ps-icon svg{ width:16px; height:16px }
        .ps-head{ flex:1; min-width:0 }
        .ps-title{ font-size:12.5px; font-weight:700; letter-spacing:.02em; color:#fff; line-height:1.2 }
        .ps-sub{ font-size:9.5px; letter-spacing:.14em; color:#f9a8d4; margin-top:3px; text-transform:uppercase; opacity:.9 }
        .ps-close{
          width:28px; height:28px; border-radius:7px; border:1px solid rgba(255,255,255,.08);
          background:rgba(255,255,255,.04); color:rgba(255,255,255,.8); font-size:18px; line-height:1; display:grid; place-items:center; flex-shrink:0;
        }
        .ps-body{ flex:1; overflow:auto; padding:18px 18px; scrollbar-width:thin; scrollbar-color:rgba(244,114,182,.3) transparent; overscroll-behavior:contain; }
        .ps-foot{
          padding:12px 18px; border-top:1px solid rgba(255,255,255,.06);
          display:flex; gap:10px; justify-content:flex-end; background:rgba(8,16,28,.5);
        }
        .ps-foot .btn-ghost.sm{ padding:10px 14px; font-size:10.5px; letter-spacing:.12em; border-radius:999px; min-width:92px }
        .ps-foot :global(.btn-primary){ padding:10px 18px; font-size:11px; letter-spacing:.12em; border-radius:999px; min-height:36px; box-shadow:0 6px 18px rgba(244,114,182,.32) }
        @media (max-width: 600px){
          .panel-shell{ width:calc(100vw - 16px); max-height:88vh; border-radius:16px }
          .ps-top{ padding:14px 16px }
          .ps-body{ padding:16px }
        }
      `}</style>
    </>
  );
}
