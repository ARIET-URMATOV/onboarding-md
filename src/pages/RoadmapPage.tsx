import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '../components/layout/TopBar';
import { StagePanel } from '../components/panel/StagePanel';
import { RoadmapCanvas, type RoadmapHandle } from '../components/cosmic/RoadmapCanvas';
import { CosmicBackground } from '../components/cosmic/CosmicBackground';
import { useOnboarding, getAllStatuses, getProgress } from '../store/useOnboarding';
import type { StageId } from '../data/stages';

export function RoadmapPage() {
  const nav = useNavigate();
  const doneTasks = useOnboarding((s) => s.doneTasks);
  const statuses = useMemo(() => getAllStatuses(doneTasks), [doneTasks]);
  const progress = useMemo(() => getProgress(doneTasks), [doneTasks]);
  const [openStage, setOpenStage] = useState<StageId | null>(null);
  const canvasRef = useRef<RoadmapHandle>(null);

  const handleNext = (fromId: StageId) => {
    const next = (fromId + 1) as StageId;
    if (next > 5) { setOpenStage(null); return; }
    const ns = statuses[next];
    if (ns === 'locked') { setOpenStage(null); return; }
    setOpenStage(null);
    // camera flight then open
    setTimeout(() => {
      canvasRef.current?.flyTo(next, () => setOpenStage(next));
    }, 260);
  };

  return (
    <>
      <TopBar />
      <CosmicBackground />
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
            <span className="rm-pct font-orbitron">{progress.done}/5</span>
          </div>
        </div>

        <div className="rm-canvas-wrap">
          <RoadmapCanvas ref={canvasRef} statuses={statuses} onSelect={setOpenStage} panelOpen={openStage!==null} />
          <div className="rm-legend">
            <span className="rm-lg done"><i/>Пройдено</span>
            <span className="rm-lg cur"><i/>Сейчас</span>
            <span className="rm-lg lock"><i/>Закрыто</span>
          </div>
          <div className="rm-hint font-orbitron">Drag · Pinch zoom · Клик по узлу</div>
        </div>

        {progress.done===progress.total && (
          <div className="rm-done">
            <span className="font-orbitron">Все этапы пройдены</span>
            <button className="btn-primary" onClick={()=>nav('/complete')}>Достижения →</button>
          </div>
        )}
      </main>
      {openStage!==null && <StagePanel stageId={openStage} status={statuses[openStage]} onClose={()=>setOpenStage(null)} onNext={handleNext} />}
      <style>{`
        .roadmap-min{ position:relative; max-width:1220px; margin:0 auto; padding:18px 18px 40px; }
        .rm-head{ display:flex; justify-content:space-between; align-items:center; padding:10px 14px; border-radius:12px; background:rgba(8,16,28,.52); border:1px solid rgba(255,255,255,.06); backdrop-filter:blur(10px); margin-bottom:12px; }
        .rm-title{ font-size:11px; letter-spacing:.18em; text-transform:uppercase; color:#E2F4FF; display:flex; gap:8px; align-items:center }
        .rm-title i{ font-style:normal; color:#4A6075 }
        .rm-accent{ color:#f9a8d4 }
        .rm-dots{ display:flex; align-items:center; gap:7px }
        .rm-dot{ width:8px; height:8px; border-radius:50%; display:inline-block; border:1px solid transparent }
        .rm-dot.done{ background:#c084fc; box-shadow:0 0 8px #c084fc; border-color:transparent }
        .rm-dot.cur{ background:#f472b6; box-shadow:0 0 10px #f472b6; animation:glow-pulse 1.8s ease-in-out infinite }
        .rm-dot.lock{ background:transparent; border-color:#4A6075 }
        .rm-pct{ margin-left:6px; font-size:11px; color:#f9a8d4; letter-spacing:.06em }
        .rm-canvas-wrap{ position:relative; height:620px; border-radius:18px; overflow:hidden; border:1px solid rgba(244,114,182,.12); background:rgba(2,6,15,.42) }
        .rm-legend{ position:absolute; left:12px; bottom:12px; display:flex; gap:8px; padding:8px 10px; border-radius:999px; background:rgba(6,12,22,.62); border:1px solid rgba(255,255,255,.06); backdrop-filter:blur(8px); font-size:10px; color:#7C94A8; z-index:2 }
        .rm-lg{ display:flex; align-items:center; gap:6px }
        .rm-lg i{ width:7px; height:7px; border-radius:50% }
        .rm-lg.done i{ background:#c084fc }
        .rm-lg.cur i{ background:#f472b6; box-shadow:0 0 8px #f472b6 }
        .rm-lg.lock i{ border:1px solid #4A6075; background:transparent }
        .rm-hint{ position:absolute; right:12px; bottom:12px; font-size:9px; letter-spacing:.14em; color:rgba(124,148,168,.85); padding:7px 10px; border-radius:999px; background:rgba(6,12,22,.62); border:1px solid rgba(255,255,255,.06); z-index:2 }
        .rm-done{ margin-top:14px; padding:14px 16px; border-radius:14px; display:flex; justify-content:space-between; align-items:center; background:linear-gradient(135deg, rgba(192,132,252,.12), rgba(244,114,182,.10)); border:1px solid rgba(192,132,252,.32); color:#fff; font-size:12px; letter-spacing:.06em }
        @media (max-width:760px){
          .rm-canvas-wrap{ height:520px }
          .rm-hint{ display:none }
        }
      `}</style>
    </>
  );
}
