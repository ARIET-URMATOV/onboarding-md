import { Link } from 'react-router-dom';
import { STAGES, STAGE_ICONS } from '../../data/stages';
import { useOnboarding, getAllStatuses } from '../../store/useOnboarding';
import type { StageStatus } from '../../store/useOnboarding';

const STATUS_LABEL: Record<StageStatus, { text: string; className: string; icon: string }> = {
  done: { text: 'Выполнено', className: 'is-done', icon: '✓' },
  current: { text: 'В процессе', className: 'is-current', icon: '●' },
  locked: { text: 'Закрыто', className: 'is-locked', icon: '🔒' },
};

export function StageList() {
  const doneTasks = useOnboarding((s) => s.doneTasks);
  const statuses = getAllStatuses(doneTasks);
  return (
    <div className="sl-wrap">
      <div className="sl-head">
        <h3 className="font-orbitron">ВСЕ ЭТАПЫ</h3>
        <span className="sl-sub">Нажми, чтобы перейти</span>
      </div>
      <div className="sl-list">
        {STAGES.map((s) => {
          const st = statuses[s.id];
          const meta = STATUS_LABEL[st];
          return (
            <Link
              to={st === 'locked' ? '#' : '/roadmap'}
              key={s.id}
              className={`sl-item ${meta.className}`}
              onClick={(e) => st === 'locked' && e.preventDefault()}
            >
              <div className="sl-num font-orbitron">0{s.id}</div>
              <div className="sl-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d={STAGE_ICONS[s.iconKey]} />
                </svg>
              </div>
              <div className="sl-body">
                <div className="sl-title">{s.title}</div>
                <div className="sl-meta">
                  <span className={`sl-status ${meta.className}`}>
                    {meta.icon} {meta.text}
                  </span>
                  <span className="sl-xp font-orbitron">+{s.xpReward} XP</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
      <style>{`
        .sl-wrap{
          max-width:780px; margin:0 auto; padding:24px;
        }
        .sl-head{ display:flex; justify-content:space-between; align-items:baseline; margin-bottom:16px; padding:0 4px }
        .sl-head h3{ font-size:11px; letter-spacing:.26em; color:var(--cyan-l) }
        .sl-sub{ font-size:11px; color:var(--muted) }

        .sl-list{ display:flex; flex-direction:column; gap:10px }
        .sl-item{
          display:flex; align-items:center; gap:18px;
          padding:16px 18px;
          background:rgba(8,16,28,.55);
          border:1px solid var(--border);
          border-radius:14px;
          transition:transform .15s ease, border-color .15s ease, background .15s ease;
          position:relative;
        }
        .sl-item.is-locked{ opacity:.55; cursor:not-allowed }
        .sl-item:not(.is-locked):hover{
          transform:translateX(2px);
          border-color:var(--cyan-l);
          background:rgba(244,114,182,.05);
        }

        .sl-num{
          font-size:18px; font-weight:700;
          color:var(--cyan); text-shadow:0 0 12px rgba(244,114,182,.5);
          min-width:36px;
        }
        .sl-item.is-done .sl-num{ color:var(--mint); text-shadow:0 0 12px rgba(192,132,252,.5) }
        .sl-item.is-locked .sl-num{ color:var(--dim); text-shadow:none }

        .sl-icon{
          width:42px; height:42px; border-radius:10px;
          display:grid; place-items:center;
          background:rgba(244,114,182,.06);
          border:1px solid var(--border);
          color:var(--cyan-l);
        }
        .sl-icon svg{ width:20px; height:20px }
        .sl-item.is-done .sl-icon{ background:rgba(192,132,252,.1); border-color:rgba(192,132,252,.3); color:var(--mint) }
        .sl-item.is-locked .sl-icon{ background:rgba(255,255,255,.02); border-color:rgba(255,255,255,.05); color:var(--dim) }

        .sl-body{ flex:1; min-width:0 }
        .sl-title{ font-size:14px; color:var(--text); font-weight:500; margin-bottom:4px }
        .sl-meta{ display:flex; align-items:center; gap:12px; font-size:10.5px; color:var(--muted) }
        .sl-status{ display:inline-flex; align-items:center; gap:5px; padding:2px 8px; border-radius:999px; border:1px solid var(--border) }
        .sl-status.is-done{ color:var(--mint); border-color:rgba(192,132,252,.4); background:rgba(192,132,252,.08) }
        .sl-status.is-current{ color:var(--cyan); border-color:rgba(244,114,182,.4); background:rgba(244,114,182,.1) }
        .sl-status.is-locked{ color:var(--dim); border-color:rgba(255,255,255,.05) }
        .sl-xp{ font-size:10px; letter-spacing:.06em; color:var(--cyan-l) }
      `}</style>
    </div>
  );
}
