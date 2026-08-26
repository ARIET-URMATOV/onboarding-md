import { getProgress } from '../../store/useOnboarding';
import { useOnboarding } from '../../store/useOnboarding';

export function ProgressBar() {
  const doneTasks = useOnboarding((s) => s.doneTasks);
  const { done, total, pct } = getProgress(doneTasks);
  return (
    <div className="pb-wrap">
      <div className="pb-head">
        <span className="pb-label font-orbitron">ПРОГРЕСС ОНБОРДИНГА</span>
        <span className="pb-count font-orbitron">Этап {done} из {total}</span>
      </div>
      <div className="pb-track">
        <div className="pb-fill" style={{ width: `${pct}%` }} />
      </div>
      <style>{`
        .pb-wrap{margin-top:42px}
        .pb-head{display:flex; justify-content:space-between; align-items:baseline; margin-bottom:10px}
        .pb-label{font-size:10.5px; letter-spacing:.26em; color:var(--muted); text-transform:uppercase}
        .pb-count{font-size:14px; color:var(--cyan-l); letter-spacing:.04em}
        .pb-count b{font-weight:600}
        .pb-track{height:6px; border-radius:4px; background:rgba(255,255,255,.05); overflow:hidden; position:relative}
        .pb-fill{height:100%; border-radius:4px; background:linear-gradient(90deg, #3B82F6, #2563EB, #3B82F6); box-shadow:0 0 16px rgba(59,130,246,.5); transition:width .5s cubic-bezier(.2,.7,.2,1)}
      `}</style>
    </div>
  );
}
