import { useState } from 'react';
import { Link } from 'react-router-dom';
import { TopBar } from '../components/layout/TopBar';
import { FuturisticGrid } from '../components/cosmic/FuturisticGrid';
import { VirtualScheme } from '../components/dashboard/VirtualScheme';
import { useOnboarding, getAllStatuses, getProgress } from '../store/useOnboarding';
import { STAGES } from '../data/stages';

export function DashboardPage() {
  const doneTasks = useOnboarding((s) => s.doneTasks);
  const statuses = getAllStatuses(doneTasks);
  const progress = getProgress(doneTasks);
  const current = STAGES.find((s) => statuses[s.id] === 'current');
  const [schemeOpen, setSchemeOpen] = useState(false);

  return (
    <>
      <TopBar />
      <FuturisticGrid progress={progress.pct} />
      <main className="dash">
        <section className="hero-ref">
          <div className="hero-bg" aria-hidden>
            <div className="hero-scan" />
            <div className="hero-vignette" />
          </div>
          <div className="badge font-mono">Frontend Developer</div>
          <h1 className="hero-title font-serif">
            <span className="ht-line">Добро пожаловать</span>
            <span className="ht-line ht-digital">
              в <em className="mdigital">MDIGITAL
                <span className="md-bracket lb">[</span>
                <span className="md-bracket rb">]</span>
                <span className="md-underline" />
                <span className="md-spark" />
                <span className="md-spark s2" />
                <span className="md-spark s3" />
              </em>
            </span>
          </h1>
          <p className="hero-sub">
            Начни свой путь в команде. Пройди все 5 этапов онбординга и стань частью нашей команды.
          </p>
          <div className="hero-actions">
            <Link to="/roadmap" className="btn-hero">
              Начать онбординг <span>→</span>
            </Link>
            <button className="btn-ghost sm" onClick={() => setSchemeOpen(true)}>Карта этапов</button>
          </div>
          <VirtualScheme open={schemeOpen} onClose={() => setSchemeOpen(false)} statuses={statuses} progressPct={progress.pct} doneCount={progress.done} />
          <div className="hero-progress">
            <div className="prog-head font-mono">
              <span className="prog-label">Прогресс онбординга</span>
              <span className="prog-step">Этап {progress.done} из 5</span>
            </div>
            <div className="prog-bar">
              <i style={{ width: `${progress.pct}%` }} />
            </div>
          </div>
        </section>

        {current && (
          <section className="now">
            <div className="now-card">
              <div className="now-left">
                <div className="now-kicker font-mono">Сейчас · Этап 0{current.id}</div>
                <div className="now-title">{current.title}</div>
                <div className="now-desc">{current.description}</div>
                <div className="now-foot">
                  <Link to="/roadmap" className="now-btn">Продолжить →</Link>
                  <span className="now-steps font-mono">
                    {(doneTasks[current.id] || []).length}/{current.subTasks.length} шагов
                  </span>
                </div>
              </div>
              <div className="now-right">
                <div className="now-ring"><span className="font-orbitron">0{current.id}</span></div>
              </div>
            </div>
          </section>
        )}

        <section className="timeline">
          <div className="tl-head font-mono">
            <span>Маршрут</span><span className="tl-count">{progress.done}/5</span>
          </div>
          <div className="tl-row">
            {STAGES.map((s) => {
              const st = statuses[s.id];
              const isLocked = st === 'locked';
              return (
                <Link
                  key={s.id}
                  to={isLocked ? '#' : '/roadmap'}
                  onClick={(e) => isLocked && e.preventDefault()}
                  className={`tl-item ${st}`}
                >
                  <div className="tl-num font-mono">0{s.id}</div>
                  <div className="tl-name">{s.shortLabel}</div>
                  <div className={`tl-dot ${st}`} />
                  {isLocked && <div className="tl-fow" aria-hidden />}
                </Link>
              );
            })}
          </div>
        </section>
      </main>

      <style>{`
        .dash{ position:relative; max-width:1100px; margin:0 auto; padding:0 20px 64px; }
        .hero-ref{
          position:relative; display:flex; flex-direction:column; align-items:center; text-align:center;
          padding:54px 20px 28px; margin-top:18px; min-height:62vh; justify-content:center;
          border:1px solid rgba(139,92,246,.14); border-radius:18px; overflow:hidden;
          background:linear-gradient(180deg, rgba(236,72,153,.06), rgba(15,10,30,.42) 55%), rgba(15,10,30,.38);
          backdrop-filter:blur(10px);
        }
        .hero-bg{ position:absolute; inset:0; pointer-events:none; overflow:hidden; border-radius:18px; }
        .hero-scan{
          position:absolute; left:0; right:0; height:2px; top:-2px;
          background:linear-gradient(90deg, transparent, #f472b6, #8b5cf6, #f472b6, transparent);
          box-shadow:0 0 14px rgba(244,114,182,.6);
          animation:heroScan 3s linear infinite; opacity:.85;
        }
        .hero-vignette{ position:absolute; inset:0; background:radial-gradient(800px 400px at 50% 28%, rgba(236,72,153,.08), transparent 65%), radial-gradient(600px 300px at 50% 100%, rgba(244,114,182,.05), transparent 70%); }
        @keyframes heroScan{ 0%{transform:translateY(0)} 100%{transform:translateY(520px)} }
        .badge{
          display:inline-flex; align-items:center; padding:6px 18px; border-radius:999px;
          border:1px solid rgba(139,92,246,.32); background:rgba(139,92,246,.08);
          color:#e9d5ff; font-size:11px; font-weight:700; letter-spacing:2px; text-transform:uppercase;
          box-shadow:0 0 16px rgba(139,92,246,.22); animation:badgePulse 2.4s ease-in-out infinite;
        }
        @keyframes badgePulse{ 0%,100%{ box-shadow:0 0 16px rgba(139,92,246,.22)} 50%{ box-shadow:0 0 22px rgba(139,92,246,.35)} }
        .hero-title{
          margin:28px 0 18px; line-height:1.08; letter-spacing:-0.02em;
          font-weight:900; text-transform:uppercase; text-align:center;
        }
        .ht-line{ display:block; font-size:clamp(32px, 5.2vw, 50px); color:#fff; text-shadow:0 0 28px rgba(192,132,252,.18); }
        .ht-digital{ position:relative; display:inline-block; padding:0 22px; }
        .mdigital{
          position:relative; display:inline-block; font-style:normal;
          background:linear-gradient(90deg,#f472b6 0%,#c084fc 45%,#f472b6 100%);
          -webkit-background-clip:text; background-clip:text; color:transparent;
          text-shadow:0 0 28px rgba(236,72,153,.32);
          animation:mdFlicker 3.4s ease-in-out infinite;
        }
        .mdigital::after{
          content:''; position:absolute; left:2%; right:2%; bottom:2px; height:1px;
          background:linear-gradient(90deg, transparent, #f472b6, #c084fc, transparent);
          box-shadow:0 0 10px rgba(244,114,182,.6); opacity:.85;
        }
        @keyframes mdFlicker{
          0%,16%,20%,60%,62%,68%,100%{ filter:brightness(1) drop-shadow(0 0 18px rgba(236,72,153,.25)) }
          18%,61%{ filter:brightness(0.92) }
        }
        .md-bracket{ position:absolute; top:50%; transform:translateY(-50%); font-size:22px; font-weight:300; color:rgba(244,114,182,.55); text-shadow:0 0 8px rgba(244,114,182,.6); animation:bracketPulse 2.8s ease-in-out infinite; }
        .md-bracket.lb{ left:0; } .md-bracket.rb{ right:0; animation-delay:1.4s }
        @keyframes bracketPulse{ 0%,100%{ opacity:.55} 50%{ opacity:1} }
        .md-spark{ position:absolute; width:3px; height:3px; border-radius:50%; background:#f472b6; box-shadow:0 0 8px #f472b6; animation:sparkFloat 3.2s ease-in-out infinite; }
        .md-spark{ top:-4px; right:8px; } .md-spark.s2{ top:auto; bottom:-2px; left:6px; background:#f472b6; box-shadow:0 0 8px #f472b6; animation-delay:1.1s } .md-spark.s3{ top:46%; right:-6px; width:2px; height:2px; background:#c084fc; animation-delay:.6s }
        @keyframes sparkFloat{ 0%,100%{ transform:translateY(0) scale(1); opacity:1} 50%{ transform:translateY(-6px) scale(1.2); opacity:.7} }
        .hero-sub{ max-width:520px; font-family:'Manrope',sans-serif; font-size:16px; line-height:1.6; font-weight:400; color:#94a3b8; margin:0 auto 32px; text-align:center; }
        .hero-actions{ display:flex; align-items:center; justify-content:center; gap:16px; flex-wrap:wrap; margin-bottom:22px }
        .btn-hero{
          display:inline-flex; align-items:center; gap:10px;
          padding:14px 28px; border-radius:10px;
          background:linear-gradient(90deg,#9333ea, #c084fc); color:#fff; font-family:'Orbitron',sans-serif;
          font-size:11px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase;
          box-shadow:0 0 24px rgba(147,51,234,.42); position:relative; overflow:hidden;
          transition:transform .16s, box-shadow .16s;
        }
        .btn-hero::after{
          content:''; position:absolute; inset:0; background:linear-gradient(90deg, transparent, rgba(255,255,255,.18), transparent);
          transform:translateX(-100%); animation:btnShine 2.6s linear infinite;
        }
        @keyframes btnShine{ 0%{transform:translateX(-100%)} 100%{transform:translateX(100%)} }
        .btn-hero:hover{ transform:translateY(-2px); box-shadow:0 0 32px rgba(147,51,234,.55) }
        .btn-hero span{ font-size:13px }
        .hero-progress{ width:100%; max-width:640px; margin:10px auto 0; }
        .prog-head{ display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; font-size:10px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; }
        .prog-label{ color:#64748b }
        .prog-step{ color:#a78bfa }
        .prog-bar{ width:100%; height:4px; background:#1e1b4b; border-radius:2px; overflow:hidden; position:relative }
        .prog-bar i{ display:block; height:100%; background:linear-gradient(90deg,#ec4899,#8b5cf6); box-shadow:0 0 10px #ec4899; transition:width .6s ease; position:relative }
        .prog-bar i::after{ content:''; position:absolute; inset:0; background:linear-gradient(90deg, transparent, rgba(255,255,255,.22), transparent); animation:progShimmer 1.8s linear infinite }
        @keyframes progShimmer{ from{transform:translateX(-100%)} to{transform:translateX(100%)} }

        .now{ margin-top:22px }
        .now-card{
          display:grid; grid-template-columns:1fr 120px; gap:18px;
          padding:18px 18px; border-radius:16px;
          background:rgba(15,10,30,.72); border:1px solid rgba(139,92,246,.14);
          backdrop-filter:blur(12px); position:relative; overflow:hidden;
        }
        .now-card::before{ content:''; position:absolute; inset:0; background:radial-gradient(520px 180px at 18% 0%, rgba(236,72,153,.08), transparent 60%); pointer-events:none; }
        .now-kicker{ font-family:'JetBrains Mono',monospace; font-size:10px; letter-spacing:.18em; color:#c084fc; margin-bottom:8px; text-transform:uppercase }
        .now-title{ font-size:16px; font-weight:700; color:#fff; letter-spacing:.01em; margin-bottom:6px }
        .now-desc{ font-family:'Manrope',sans-serif; font-size:12.8px; line-height:1.55; color:#94a3b8; max-width:520px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden }
        .now-foot{ display:flex; align-items:center; gap:14px; margin-top:14px; flex-wrap:wrap }
        .now-btn{ padding:10px 16px; border-radius:999px; background:linear-gradient(90deg,#ec4899,#8b5cf6); color:#fff; font-family:'Orbitron',sans-serif; font-size:11px; font-weight:700; letter-spacing:.08em; box-shadow:0 6px 18px rgba(236,72,153,.32); }
        .now-steps{ font-family:'JetBrains Mono',monospace; font-size:10px; letter-spacing:.14em; color:#8c88a6 }
        .now-right{ display:grid; place-items:center }
        .now-ring{ width:72px; height:72px; border-radius:50%; display:grid; place-items:center; background:linear-gradient(135deg,#ec4899,#8b5cf6); color:#fff; font-weight:900; font-size:22px; box-shadow:0 0 20px rgba(236,72,153,.35); position:relative; }
        .now-ring::after{ content:''; position:absolute; inset:-8px; border-radius:50%; border:1px solid rgba(236,72,153,.22) }

        .timeline{ margin-top:18px; padding:14px 16px; border-radius:16px; background:rgba(15,10,30,.55); border:1px solid rgba(139,92,246,.12) }
        .tl-head{ display:flex; justify-content:space-between; font-size:10px; letter-spacing:.18em; color:#cbd5e1; margin-bottom:12px; text-transform:uppercase; font-family:'JetBrains Mono',monospace }
        .tl-count{ color:#c084fc }
        .tl-row{ display:grid; grid-template-columns:repeat(5,1fr); gap:10px }
        .tl-item{
          position:relative; overflow:hidden; display:flex; flex-direction:column; gap:6px;
          padding:12px 12px; border-radius:12px; background:rgba(255,255,255,.03); border:1px solid rgba(139,92,246,.10);
          transition:border-color .16s, background .16s, transform .16s; min-height:92px;
        }
        .tl-item:hover{ border-color:rgba(192,132,252,.24); background:rgba(139,92,246,.06); transform:translateY(-1px) }
        .tl-item.locked{ opacity:.92; filter:saturate(.35); }
        .tl-num{ font-size:11px; color:#c084fc; letter-spacing:.08em; font-family:'JetBrains Mono',monospace }
        .tl-item.locked .tl-num{ color:#64748b }
        .tl-item.done .tl-num{ color:#c084fc }
        .tl-name{ font-size:12.5px; font-weight:600; color:#f1f5f9; line-height:1.2; font-family:'Manrope',sans-serif }
        .tl-item.locked .tl-name{ color:#94a3b8 }
        .tl-dot{ width:7px; height:7px; border-radius:50%; margin-top:auto }
        .tl-dot.current{ background:#ec4899; box-shadow:0 0 10px #ec4899 }
        .tl-dot.done{ background:#c084fc; box-shadow:0 0 8px #c084fc }
        .tl-dot.locked{ background:transparent; border:1px solid #64748b }
        .tl-fow{ position:absolute; inset:0; pointer-events:none; background:repeating-linear-gradient(135deg, rgba(255,255,255,.02) 0 6px, transparent 6px 12px); opacity:.4; }
        @media (max-width: 760px){
          .ht-line{ font-size:clamp(28px, 8vw, 40px) !important }
          .now-card{ grid-template-columns:1fr; }
          .now-right{ display:none }
          .tl-row{ grid-template-columns:repeat(2,1fr) }
          .tl-row .tl-item:last-child{ grid-column: span 2 }
        }
      `}</style>
    </>
  );
}
