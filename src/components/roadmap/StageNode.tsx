import type { StageStatus } from '../../store/useOnboarding';
import { STAGES } from '../../data/stages';

interface StageNodeProps {
  stageId: number;
  status: StageStatus;
  userInitial: string;
  x: number; // percent
  y: number; // percent
  onClick: () => void;
}

const ICONS = {
  done: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  locked: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
  current: null,
};

const STATUS_TEXT: Record<StageStatus, string> = {
  done: '✓ Выполнено',
  current: '● Выполняешь',
  locked: '🔒 Закрыто',
};

export function StageNode({ stageId, status, userInitial, x, y, onClick }: StageNodeProps) {
  const stage = STAGES.find((s) => s.id === stageId)!;
  return (
    <button
      type="button"
      className={`sn sn-${status}`}
      style={{ left: `${x}%`, top: `${y}%` }}
      onClick={onClick}
      aria-label={`Этап ${stageId}: ${stage.title}`}
    >
      <div className="sn-beam" />
      <div className="sn-halo" />
      <div className="sn-core">
        {status === 'done' && ICONS.done}
        {status === 'locked' && ICONS.locked}
        {status === 'current' && (
          <div className="sn-avatar font-orbitron">{userInitial}</div>
        )}
      </div>
      <div className="sn-label">
        <div className="sn-eyebrow font-orbitron">ЭТАП 0{stageId}</div>
        <div className="sn-title font-orbitron">{stage.title}</div>
        <div className="sn-status">{STATUS_TEXT[status]} <span className="sn-xp">+{stage.xpReward} XP</span></div>
      </div>
      <style>{`
        .sn{
          position:absolute;
          transform:translate(-50%, -50%);
          background:none; padding:0;
          cursor:pointer;
          color:inherit;
        }
        .sn-core{
          position:relative;
          width:60px; height:60px; border-radius:50%;
          display:grid; place-items:center;
          transition:transform .2s ease, box-shadow .2s ease;
        }
        .sn:hover .sn-core{ transform:scale(1.06) }
        .sn-halo{
          position:absolute; inset:-12px;
          border-radius:50%;
          pointer-events:none;
        }
        .sn-beam{
          position:absolute; left:50%; top:50%;
          width:2px; height:80px; transform:translate(-50%, -120%);
          opacity:0;
          pointer-events:none;
        }

        /* DONE — mint filled */
        .sn-done .sn-core{
          background:radial-gradient(circle at 30% 30%, rgba(255,255,255,.4), transparent 50%), linear-gradient(135deg, #60A5FA, #2563EB);
          color:#02131b; font-weight:700;
          box-shadow:0 0 28px rgba(96,165,250,.7), inset 0 0 16px rgba(255,255,255,.2);
        }
        .sn-done .sn-halo{
          background:radial-gradient(circle, rgba(96,165,250,.35), transparent 65%);
          animation:glow-pulse 3s ease-in-out infinite;
        }
        .sn-done .sn-core svg{ width:26px; height:26px }

        /* CURRENT — dark teal pulsing with avatar */
        .sn-current .sn-core{
          background:radial-gradient(circle at 30% 30%, rgba(255,255,255,.45), transparent 50%), linear-gradient(135deg, #4a1a2e, #155E75);
          color:#fff; font-weight:700;
          box-shadow:0 0 28px rgba(59,130,246,.7), inset 0 0 18px rgba(59,130,246,.4);
          animation:pulse-ring 2.2s ease-out infinite;
        }
        .sn-current .sn-halo{
          background:radial-gradient(circle, rgba(59,130,246,.55), transparent 65%);
          animation:glow-pulse 1.8s ease-in-out infinite;
        }
        .sn-current .sn-beam{
          background:linear-gradient(180deg, transparent, rgba(59,130,246,.6), transparent);
          opacity:.7;
        }
        .sn-avatar{ font-size:18px; font-weight:700; letter-spacing:.05em; color:#fff }

        /* LOCKED — gray outline */
        .sn-locked .sn-core{
          background:rgba(20,30,48,.7);
          border:1.5px dashed rgba(116,134,156,.4);
          color:#6b7c8e;
          box-shadow:none;
        }
        .sn-locked .sn-halo{ display:none }
        .sn-locked .sn-beam{ display:none }
        .sn-locked .sn-core svg{ width:22px; height:22px }

        /* labels */
        .sn-label{
          position:absolute; left:50%; top:50%;
          transform:translate(-50%, -130%);
          text-align:center; white-space:nowrap;
          pointer-events:none;
          margin-bottom:14px;
        }
        .sn-eyebrow{ font-size:9px; letter-spacing:.3em; color:var(--muted); margin-bottom:2px }
        .sn-title{ font-size:12.5px; letter-spacing:.04em; color:#fff; text-shadow:0 0 14px rgba(59,130,246,.5); margin-bottom:4px }
        .sn-status{
          font-size:9px; letter-spacing:.18em; text-transform:uppercase;
          display:inline-block; padding:2px 9px; border-radius:20px;
          border:1px solid var(--border); color:var(--muted);
        }
        .sn-done .sn-status{ color:var(--mint); border-color:rgba(96,165,250,.4); background:rgba(96,165,250,.08) }
        .sn-current .sn-status{ color:var(--cyan-l); border-color:rgba(59,130,246,.4); background:rgba(59,130,246,.1) }
        .sn-locked .sn-eyebrow, .sn-locked .sn-title{ color:var(--dim); text-shadow:none }
        .sn-locked .sn-status{ color:var(--dim); border-color:rgba(255,255,255,.08) }
        .sn-xp{ margin-left:6px; color:var(--cyan-l); font-family:'Orbitron',sans-serif; font-size:9px }

        /* override placement: we want label ABOVE node; current layout has it inside */
        .sn-label{ transform:translate(-50%, calc(-100% - 56px)) }
      `}</style>
    </button>
  );
}
