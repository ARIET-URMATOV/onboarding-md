import { PanelShell } from './PanelShell';
import { STAGES, STAGE_ICONS } from '../../data/stages';
import { useOnboarding } from '../../store/useOnboarding';
import { Stage1Documents } from '../stages/Stage1Documents';
import { Stage2Team } from '../stages/Stage2Team';
import { Stage3Video } from '../stages/Stage3Video';
import { Stage4Checklist } from '../stages/Stage4Checklist';
import { Stage5Test } from '../stages/Stage5Test';
import type { StageId } from '../../data/stages';

interface StagePanelProps {
  stageId: StageId;
  status: 'locked' | 'current' | 'done';
  onClose: () => void;
  onNext?: (fromId: StageId) => void;
}

export function StagePanel({ stageId, status, onClose, onNext }: StagePanelProps) {
  const stage = STAGES.find((s) => s.id === stageId)!;
  const doneTasks = useOnboarding((s) => s.doneTasks[stageId]) || [];
  const toggleTask = useOnboarding((s) => s.toggleTask);
  const completeStage = useOnboarding((s) => s.completeStage);

  const subtitle = status === 'locked'
    ? `ЭТАП 0${stageId} · ЗАКРЫТО`
    : status === 'current'
      ? `ЭТАП 0${stageId} · ТЕКУЩИЙ`
      : `ЭТАП 0${stageId} · ВЫПОЛНЕНО`;

  const renderBody = () => {
    if (status === 'locked') {
      return (
        <div className="locked-body">
          <div className="locked-icon">🔒</div>
          <div className="locked-title">Этот этап пока недоступен</div>
          <div className="locked-desc">
            Пройди предыдущий этап, чтобы открыть «{stage.title}». Так мы убедимся, что у тебя всё в порядке.
          </div>
        </div>
      );
    }
    const allTasksDone = stage.subTasks.every((t) => doneTasks.includes(t.id));
    const subTasksList = stageId === 1 ? null : (
      <div className="sub-tasks">
        {stage.subTasks.map((t) => {
          const done = doneTasks.includes(t.id);
          return (
            <label key={t.id} className={`task-row ${done ? 'is-done' : ''}`}>
              <span className="task-box">
                {done && (
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </span>
              <span className="task-title">{t.title}</span>
              <input
                type="checkbox"
                checked={done}
                onChange={() => toggleTask(stageId, t.id)}
                style={{ display: 'none' }}
              />
            </label>
          );
        })}
        <div className="reward">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
            <path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
            <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
            <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
          </svg>
          <div>
            <b className="font-orbitron">Ачивка «{stage.rewardName.replace('Ачивка «', '').replace('»', '')}»</b>
            <span>{stage.rewardDesc}</span>
          </div>
        </div>
      </div>
    );

    return (
      <>
        <p className="panel-desc">{stage.description}</p>
        {stageId === 1 && <Stage1Documents stageId={stageId} />}
        {stageId === 2 && <Stage2Team stageId={stageId} />}
        {stageId === 3 && <Stage3Video stageId={stageId} />}
        {stageId === 4 && <Stage4Checklist stageId={stageId} />}
        {stageId === 5 && <Stage5Test stageId={stageId} />}
        {subTasksList}
        {stageId === 1 && !allTasksDone && status === 'current' && (
          <div className="gate-hint">Открой каждый документ и пролистай до конца — иначе этап не засчитается</div>
        )}
      </>
    );
  };

  const allDoneForGate = stage.subTasks.every((t) => doneTasks.includes(t.id));
  const hasNext = stageId < 5;
  const handleComplete = () => {
    completeStage(stageId);
    if (hasNext && onNext) {
      // let panel animate out, then fly and reopen next
      setTimeout(() => onNext(stageId), 220);
    } else {
      onClose();
    }
  };
  const handleNext = () => {
    if (onNext) onNext(stageId);
    else onClose();
  };
  return (
    <PanelShell
      title={stage.title}
      subtitle={subtitle}
      iconPath={STAGE_ICONS[stage.iconKey]}
      onClose={onClose}
      primary={
        status === 'current' ? (
          <button className="btn-primary sm" disabled={stageId === 1 && !allDoneForGate} onClick={handleComplete} title={stageId === 1 && !allDoneForGate ? 'Сначала прочитай документы до конца' : undefined}>
            {stageId === 1 && !allDoneForGate ? 'СНАЧАЛА ДОКУМЕНТЫ' : `ЗАВЕРШИТЬ →`}
          </button>
        ) : status === 'done' ? (
          hasNext ? (
            <button className="btn-primary sm" onClick={handleNext}>
              СЛЕДУЮЩИЙ ЭТАП →
            </button>
          ) : (
            <button className="btn-primary sm" onClick={onClose}>
              ГОТОВО ✓
            </button>
          )
        ) : (
          <button className="btn-primary sm" disabled>
            ЭТАП ЗАБЛОКИРОВАН
          </button>
        )
      }
    >
      {renderBody()}

      <style>{`
        .panel-desc{ font-size:11.8px; color:rgba(226,244,255,.68); line-height:1.7; margin-bottom:14px }
        .locked-body{ text-align:center; padding:28px 0 }
        .locked-icon{ font-size:32px; opacity:.55; margin-bottom:12px }
        .locked-title{ font-family:'Orbitron',sans-serif; font-size:12.5px; color:#fff; margin-bottom:6px; letter-spacing:.04em }
        .locked-desc{ font-size:11.5px; color:var(--muted); line-height:1.6; max-width:280px; margin:0 auto }
        .sub-tasks{ display:flex; flex-direction:column; gap:8px; margin-top:16px }
        .task-row{
          display:flex; align-items:center; gap:10px;
          padding:10px 12px;
          background:rgba(255,255,255,.02);
          border:1px solid rgba(255,255,255,.06);
          border-radius:10px;
          cursor:pointer;
          font-size:11.8px;
          transition:background .15s ease, border-color .15s ease;
        }
        .task-row:hover{ background:rgba(59,130,246,.06); border-color:rgba(59,130,246,.22) }
        .task-row.is-done{ color:var(--dim) }
        .task-row.is-done .task-title{ text-decoration:line-through; opacity:.65 }
        .task-box{
          width:17px; height:17px; border-radius:5px;
          border:1.5px solid rgba(147,197,253,.45);
          display:grid; place-items:center; flex-shrink:0;
        }
        .task-box svg{ width:10px; height:10px; stroke:#02131b; opacity:0 }
        .task-row.is-done .task-box{ background:var(--mint); border-color:var(--mint) }
        .task-row.is-done .task-box svg{ opacity:1 }
        .task-title{ flex:1; font-size:11.8px }
        .task-xp{ font-size:9px; color:var(--muted); letter-spacing:.04em }
        .task-xp b{ color:var(--cyan); font-weight:600 }
        .reward{
          display:flex; align-items:center; gap:10px;
          margin-top:12px; padding:11px 13px;
          border:1px dashed rgba(251,191,36,.32);
          border-radius:11px; background:rgba(251,191,36,.05);
        }
        .reward svg{ width:16px; height:16px; stroke:var(--gold); flex-shrink:0 }
        .reward b{ font-family:'Orbitron',sans-serif; font-size:10.5px; letter-spacing:.03em; color:var(--gold); display:block }
        .reward span{ font-size:10px; color:var(--dim); display:block; margin-top:2px }
        .gate-hint{ margin-top:12px; padding:9px 11px; border-radius:10px; background:rgba(251,191,36,.06); border:1px dashed rgba(251,191,36,.26); color:var(--gold); font-size:10.5px; text-align:center }
      `}</style>
    </PanelShell>
  );
}
