import { Link } from 'react-router-dom';
import { STAGES } from '../../data/stages';
import { useOnboarding, getAllStatuses } from '../../store/useOnboarding';

export function CurrentStageCard() {
  const doneTasks = useOnboarding((s) => s.doneTasks);
  const statuses = getAllStatuses(doneTasks);
  const current = STAGES.find((s) => statuses[s.id] === 'current');
  if (!current) return null;
  const doneSubTasks = (doneTasks[current.id] || []).length;
  const totalSubTasks = current.subTasks.length;

  return (
    <div className="csc-wrap">
      <div className="csc-card glass">
        <div className="csc-left">
          <div className="csc-eyebrow font-orbitron">ТЕКУЩИЙ ЭТАП</div>
          <div className="csc-title font-orbitron">Этап 0{current.id} · {current.title}</div>
          <p className="csc-desc">{current.description}</p>
          <div className="csc-foot">
            <Link to="/roadmap" className="btn-primary">ПРОДОЛЖИТЬ →</Link>
            <div className="csc-progress font-orbitron">
              {doneSubTasks}/{totalSubTasks} ШАГОВ
            </div>
          </div>
        </div>
        <div className="csc-right">
          <div className="csc-orb">
            <div className="orb-inner">0{current.id}</div>
            <div className="orb-ring" />
            <div className="orb-ring orb-ring-2" />
          </div>
          <div className="csc-xp font-orbitron">+{current.xpReward}<small>XP</small></div>
        </div>
      </div>

      <style>{`
        .csc-wrap{ max-width:780px; margin:32px auto 0; padding:0 24px }
        .csc-card{
          display:grid; grid-template-columns:1fr 200px;
          gap:24px; padding:28px; border-radius:18px;
          position:relative; overflow:hidden;
        }
        .csc-card::before{
          content:''; position:absolute; inset:0;
          background:radial-gradient(circle at 0% 0%, rgba(59,130,246,.12), transparent 60%);
          pointer-events:none;
        }
        .csc-eyebrow{ font-size:10px; letter-spacing:.26em; color:var(--cyan-l); text-transform:uppercase }
        .csc-title{ font-size:22px; font-weight:700; color:#fff; margin:8px 0 14px; letter-spacing:.02em }
        .csc-desc{ font-size:13.5px; color:var(--muted); line-height:1.6; margin-bottom:22px }
        .csc-foot{ display:flex; align-items:center; gap:18px; flex-wrap:wrap }
        .csc-progress{ font-size:11px; letter-spacing:.14em; color:var(--muted) }

        .csc-right{
          position:relative;
          display:flex; flex-direction:column; align-items:center; justify-content:center;
        }
        .csc-orb{
          position:relative;
          width:130px; height:130px;
          display:grid; place-items:center;
        }
        .orb-inner{
          width:84px; height:84px; border-radius:50%;
          background:radial-gradient(circle at 30% 30%, rgba(255,255,255,.4), transparent 50%),
                     linear-gradient(135deg, #3B82F6, #2563EB);
          display:grid; place-items:center;
          font-family:'Orbitron',sans-serif;
          font-size:28px; font-weight:900; color:#02060d;
          box-shadow:0 0 32px rgba(59,130,246,.6), inset 0 0 24px rgba(255,255,255,.25);
        }
        .orb-ring{
          position:absolute; inset:0;
          border:1px solid rgba(59,130,246,.4);
          border-radius:50%;
          animation:pulse-ring 2.4s ease-out infinite;
        }
        .orb-ring-2{ animation-delay:1.2s }
        .csc-xp{
          margin-top:16px; font-size:24px; font-weight:700;
          color:var(--gold); text-shadow:0 0 14px rgba(251,191,36,.5);
          letter-spacing:.04em;
        }
        .csc-xp small{ display:block; font-family:'Chakra Petch'; font-size:9px; letter-spacing:.26em; color:var(--muted); margin-top:2px }

        @media (max-width: 700px){
          .csc-card{ grid-template-columns:1fr }
          .csc-right{ flex-direction:row; gap:18px }
          .csc-orb{ width:auto; height:auto }
          .csc-xp{ margin-top:0 }
        }
      `}</style>
    </div>
  );
}
