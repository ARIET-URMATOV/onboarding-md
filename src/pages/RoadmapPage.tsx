import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '../components/layout/TopBar';
import { StagePanel } from '../components/panel/StagePanel';
import { IsometricRoadmap } from '../components/isometric/IsometricRoadmap';
import { useOnboarding, getAllStatuses, getProgress } from '../store/useOnboarding';
import type { StageId } from '../data/stages';

export function RoadmapPage() {
  const nav = useNavigate();
  const doneTasks = useOnboarding((s) => s.doneTasks);
  const statuses = useMemo(() => getAllStatuses(doneTasks), [doneTasks]);
  const progress = useMemo(() => getProgress(doneTasks), [doneTasks]);
  const [openStage, setOpenStage] = useState<StageId | null>(null);

  return (
    <>
      <TopBar />
      <main className="roadmap-min">
        <div className="rm-head">
          <div className="rm-title font-orbitron">
            <span>Onboarding</span><i>·</i><span className="rm-accent">Chain 01</span>
          </div>
          <div className="rm-dots">
            {[1,2,3,4,5].map(n=> {
              const s = statuses[n as StageId];
              return <span key={n} className={`rm-dot ${s}`} title={`Этап ${n}`} />;
            })}
            <span className="rm-pct font-mono">{progress.done}/5</span>
          </div>
        </div>

        <div className="rm-map-row">
          <div className="rm-progress-v" aria-hidden>
            <div className="rpv-track">
              <i style={{ height: `${progress.pct}%` }} />
            </div>
            <span className="rpv-pct font-mono">{progress.pct}%</span>
          </div>
          <div className="rm-map-main">
            <IsometricRoadmap statuses={statuses} onSelect={setOpenStage} done={progress.done} />
          </div>
        </div>

        <div className="rm-legend">
          <span className="rm-lg done"><i/>Пройдено</span>
          <span className="rm-lg cur"><i/>Сейчас</span>
          <span className="rm-lg lock"><i/>Закрыто</span>
          <span className="rm-hint">Тап по узлу · свайп для обзора</span>
        </div>

        {progress.done===progress.total && (
          <div className="rm-done">
            <span className="font-mono">Все этапы пройдены</span>
            <button className="btn-primary sm" onClick={()=>nav('/complete')}>Достижения →</button>
          </div>
        )}
      </main>
      {openStage!==null && <StagePanel stageId={openStage} status={statuses[openStage]} onClose={()=>setOpenStage(null)} onNext={(from)=> {
        const next=(from+1) as StageId;
        if(next<=5 && statuses[next]!=='locked') setOpenStage(next); else setOpenStage(null);
      }} />}
      <style>{`
        .roadmap-min{ position:relative; max-width:1220px; margin:0 auto; padding:18px 18px 40px; }
        .rm-head{ display:flex; justify-content:space-between; align-items:center; padding:10px 14px; border-radius:12px; background:rgba(15,10,30,.52); border:1px solid rgba(139,92,246,.12); backdrop-filter:blur(10px); margin-bottom:12px; }
        .rm-title{ font-size:11px; letter-spacing:.18em; text-transform:uppercase; color:#E2F4FF; display:flex; gap:8px; align-items:center }
        .rm-title i{ font-style:normal; color:#64748b }
        .rm-accent{ color:#f9a8d4 }
        .rm-dots{ display:flex; align-items:center; gap:7px }
        .rm-dot{ width:8px; height:8px; border-radius:50%; display:inline-block; border:1px solid transparent }
        .rm-dot.done{ background:#c084fc; box-shadow:0 0 8px #c084fc; border-color:transparent }
        .rm-dot.cur{ background:#f472b6; box-shadow:0 0 10px #f472b6; animation:glow-pulse 1.8s ease-in-out infinite }
        .rm-dot.lock{ background:transparent; border-color:#4A6075 }
        .rm-pct{ margin-left:6px; font-size:11px; color:#f9a8d4; letter-spacing:.06em }
        .rm-legend{ display:flex; flex-wrap:wrap; gap:10px; align-items:center; justify-content:space-between; margin-top:10px; padding:10px 14px; border-radius:12px; background:rgba(15,10,30,.42); border:1px solid rgba(139,92,246,.10); font-size:10px; color:#94a3b8; }
        .rm-lg{ display:flex; align-items:center; gap:6px }
        .rm-lg i{ width:7px; height:7px; border-radius:50% }
        .rm-lg.done i{ background:#c084fc }
        .rm-lg.cur i{ background:#f472b6; box-shadow:0 0 8px #f472b6 }
        .rm-lg.lock i{ border:1px solid #64748b; background:transparent }
        .rm-hint{ margin-left:auto; font-family:'JetBrains Mono',monospace; font-size:9px; letter-spacing:.12em; color:#8c88a6; }
        .rm-done{ margin-top:14px; padding:14px 16px; border-radius:14px; display:flex; justify-content:space-between; align-items:center; background:linear-gradient(135deg, rgba(192,132,252,.12), rgba(244,114,182,.10)); border:1px solid rgba(192,132,252,.32); color:#fff; font-size:12px; letter-spacing:.06em }
        .rm-map-row{ display:flex; gap:10px; align-items:stretch; }
        .rm-progress-v{ display:flex; flex-direction:column; align-items:center; gap:8px; width:26px; flex-shrink:0 }
        .rpv-track{
          position:relative; flex:1; width:4px; border-radius:2px; overflow:hidden;
          background:#1e1b4b;
        }
        .rpv-track i{
          position:absolute; left:0; right:0; bottom:0; display:block; border-radius:2px;
          background:linear-gradient(180deg,#ec4899,#8b5cf6); box-shadow:0 0 10px rgba(236,72,153,.5);
          transition:height .7s cubic-bezier(.2,.8,.2,1);
        }
        .rpv-pct{ font-size:9px; letter-spacing:.06em; color:#f9a8d4 }
        .rm-map-main{ flex:1; min-width:0 }
        @media (max-width:760px){
          .rm-hint{ display:none }
        }
      `}</style>
    </>
  );
}
