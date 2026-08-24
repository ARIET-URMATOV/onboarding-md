import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '../components/layout/TopBar';
import { STAGES, STAGE_ICONS } from '../data/stages';
import { useOnboarding, getAllStatuses, getProgress } from '../store/useOnboarding';
import type { StageStatus } from '../store/useOnboarding';
import type { StageId } from '../data/stages';

type Pt = { x: number; y: number };
type Step = {
  id: StageId;
  title: string;
  short: string;
  icon: string;
  status: StageStatus;
  side: 'left' | 'right';
};

const SHORT: Record<StageId, string> = {
  1: 'Документы, руководитель и mPLuse',
  2: 'Знакомство с командой и тимлидом',
  3: 'Видеообращение от руководства',
  4: 'Проверь доступы и инструменты',
  5: 'Финальный тест по онбордингу',
};

const FNODES = [
  { x: 0.22, y: 0.90 },
  { x: 0.48, y: 0.72 },
  { x: 0.24, y: 0.55 },
  { x: 0.60, y: 0.36 },
  { x: 0.80, y: 0.14 },
];

function smoothPath(pts: Pt[]): string {
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 1];
    const p1 = pts[i];
    const mx = (p0.x + p1.x) / 2;
    d += ` C ${mx} ${p0.y}, ${mx} ${p1.y}, ${p1.x} ${p1.y}`;
  }
  return d;
}

export function MapPage() {
  const nav = useNavigate();
  const doneTasks = useOnboarding((s) => s.doneTasks);
  const statuses = useMemo(() => getAllStatuses(doneTasks), [doneTasks]);
  const progress = useMemo(() => getProgress(doneTasks), [doneTasks]);
  const done = progress.done;
  const total = STAGES.length;
  const remaining = total - done;
  const allDone = done === total;

  const sceneRef = useRef<HTMLDivElement | null>(null);
  const [w, setW] = useState(360);
  const [rowH, _setRowH] = useState(130);

  // Динамический расчет ширины контейнера при монтировании и ресайзе
  useEffect(() => {
    if (!sceneRef.current) return;
    const updateSize = () => {
      if (sceneRef.current) {
        setW(sceneRef.current.clientWidth);
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const pathD = useMemo(() => {
    const H = STAGES.length * rowH;
    const anchors: Pt[] = FNODES.map((f) => ({ x: f.x * w, y: f.y * H }));
    return smoothPath(anchors);
  }, [w, rowH]);

  const pts = useMemo(() => {
    const H = STAGES.length * rowH;
    return STAGES.map((_, i) => {
      const f = FNODES[i];
      return {
        x: f.x * w,
        y: f.y * H
      };
    });
  }, [w, rowH]);

  const steps: Step[] = STAGES.map((s, i) => {
    const pt = pts[i];
    const isRightHalf = pt ? pt.x > w * 0.5 : i % 2 !== 0;
    return {
      id: s.id,
      title: s.shortLabel,
      short: SHORT[s.id],
      icon: STAGE_ICONS[s.iconKey],
      status: statuses[s.id],
      side: isRightHalf ? 'left' : 'right',
    };
  });

  const H = STAGES.length * rowH;
  const arrow = pts[pts.length - 1];

  const openStage = (id: StageId) => {
    if (statuses[id] === 'locked') return;
    nav('/roadmap');
  };

  return (
    <>
      <TopBar />
      <div className="mp-bg" aria-hidden />
      <main className="mp-page">
        <header className="mp-brand">
          <div className="mp-title-row">
            <div className="mp-tag">MDIGITAL ROADMAP</div>
            <div className="mp-progress-pill">
              {done}/{total} · осталось {remaining}
            </div>
          </div>
        </header>

        <div ref={sceneRef} className="mp-scene" style={{ height: H }}>
          <div className="mp-glow gl1" aria-hidden />
          <div className="mp-glow gl2" aria-hidden />
          <div className="mp-tex" aria-hidden />

          <svg
            className="mp-road"
            viewBox={`0 0 ${w} ${H}`}
            preserveAspectRatio="none"
            aria-hidden
          >
            <defs>
              <linearGradient id="mpWallGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00F2FE" />
                <stop offset="55%" stopColor="#0B7FA8" />
                <stop offset="100%" stopColor="#07111E" />
              </linearGradient>
              <linearGradient id="mpNeon" x1="0" y1="1" x2="1" y2="0">
                <stop offset="0%" stopColor="#00E5FF" />
                <stop offset="55%" stopColor="#00F2FE" />
                <stop offset="100%" stopColor="#00E5FF" />
              </linearGradient>
              <filter id="mpSoft" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="16" />
              </filter>
            </defs>

            <path
              d={pathD}
              transform={`translate(${w >= 768 ? 16 : 10}, ${w >= 768 ? 20 : 12})`}
              className="mp-wall-glow"
              filter="url(#mpSoft)"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d={pathD}
              transform={`translate(${w >= 768 ? 16 : 10}, ${w >= 768 ? 20 : 12})`}
              className="mp-wall"
              vectorEffect="non-scaling-stroke"
            />
            <path d={pathD} className="mp-asphalt" vectorEffect="non-scaling-stroke" />
            <path d={pathD} className="mp-sheen" vectorEffect="non-scaling-stroke" />
            <path
              d={pathD}
              className="mp-prog"
              pathLength={100}
              vectorEffect="non-scaling-stroke"
              style={{ strokeDasharray: 100, strokeDashoffset: 100 - progress.pct }}
            />
            <path d={pathD} className="mp-centerline" vectorEffect="non-scaling-stroke" />

            {arrow && (
              <g className="mp-arrow">
                <g transform={`translate(${arrow.x}, ${arrow.y - 8}) rotate(38)`}>
                  <path d="M 0 0 L -20 14 L -8 0 L -20 -14 Z" className="mp-arrow-back" />
                  <path d="M 0 0 L -20 14 L -8 0 Z" className="mp-arrow-face" />
                </g>
              </g>
            )}
          </svg>

          {/* Узлы (Ноды) */}
          {pts.map((pt, i) => {
            const st = steps[i];
            return (
              <button
                key={st.id}
                type="button"
                className={`mp-node ${st.status}`}
                style={{ left: pt.x, top: pt.y }}
                onClick={() => openStage(st.id)}
                disabled={st.status === 'locked'}
                aria-label={`Этап ${st.id}: ${st.title}`}
              >
                <span className="mp-node-badge">0{st.id}</span>
                <span className="mp-node-ico">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <path d={st.icon} />
                  </svg>
                </span>
                {st.status === 'done' && <span className="mp-node-check">✓</span>}
                {st.status === 'locked' && <span className="mp-node-lock">·</span>}
              </button>
            );
          })}

          {/* Карточки на карте (Только для экранов >= 480px) */}
          {pts.map((pt, i) => {
            const st = steps[i];
            return (
              <div
                key={`t-${st.id}`}
                className={`mp-text mp-text--${st.side}`}
                style={{ left: pt.x, top: pt.y }}
              >
                <div className="mp-num">0{st.id}</div>
                <h3 className="mp-name">{st.title}</h3>
                <p className="mp-desc">{st.short}</p>
              </div>
            );
          })}
        </div>

        {/* Список карточек ПОД картой (Только для мобильных < 480px) */}
        <div className="mp-mobile-list">
          {steps.map((st) => (
            <button
              key={`m-${st.id}`}
              type="button"
              className={`mp-mobile-card ${st.status}`}
              onClick={() => openStage(st.id)}
              disabled={st.status === 'locked'}
            >
              <div className="mp-mobile-card-num">0{st.id}</div>
              <div className="mp-mobile-card-body">
                <h3 className="mp-name">{st.title}</h3>
                <p className="mp-desc">{st.short}</p>
              </div>
              <div className="mp-mobile-card-status">
                {st.status === 'done' && '✓'}
                {st.status === 'current' && '→'}
                {st.status === 'locked' && '🔒'}
              </div>
            </button>
          ))}
        </div>

        <footer className="mp-foot">
          {allDone ? (
            <button className="mp-cta" onClick={() => nav('/complete')}>Достижения →</button>
          ) : (
            <button className="mp-cta" onClick={() => nav('/roadmap')}>Продолжить онбординг →</button>
          )}
        </footer>
      </main>

      <style>{`
        .mp-page {
          position: relative;
          max-width: 980px;
          margin: 0 auto;
          padding: 12px 12px 40px;
          font-family: 'Outfit', sans-serif;
        }

        .mp-bg {
          position: fixed;
          inset: 0;
          z-index: -1;
          background: linear-gradient(180deg, #0A0D12 0%, #07090D 55%, #05070A 100%);
        }

        .mp-brand {
          margin: 4px 0 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .mp-title-row {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .mp-tag {
          font-weight: 800;
          font-size: clamp(18px, 5vw, 32px);
          letter-spacing: 0.06em;
          background: linear-gradient(90deg, #00F2FE, #00E5FF);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          filter: drop-shadow(0 0 18px rgba(0, 242, 254, 0.4));
        }
        .mp-progress-pill {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.08em;
          color: #BFF8FF;
          padding: 5px 12px;
          border-radius: 999px;
          background: rgba(8, 20, 40, 0.5);
          border: 1px solid rgba(0, 242, 254, 0.35);
          backdrop-filter: blur(10px);
          box-shadow: 0 0 16px rgba(0, 229, 255, 0.2);
        }

        .mp-scene {
          position: relative;
          width: 100%;
          background: linear-gradient(180deg, #0A0D12 0%, #07090D 60%, #05070A 100%);
          border: 1px solid rgba(0, 242, 254, 0.08);
          border-radius: 18px;
          overflow: hidden;
        }
        .mp-glow {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
          mix-blend-mode: screen;
          filter: blur(70px);
        }
        .gl1 {
          width: 300px;
          height: 300px;
          left: -80px;
          bottom: -50px;
          background: radial-gradient(circle, rgba(0, 229, 255, 0.30), transparent 70%);
        }
        .gl2 {
          width: 330px;
          height: 330px;
          right: -80px;
          top: -60px;
          background: radial-gradient(circle, rgba(0, 242, 254, 0.26), transparent 70%);
        }
        .mp-tex {
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0.5;
          background: repeating-linear-gradient(0deg, transparent 0 3px, rgba(255, 255, 255, 0.012) 3px 4px);
        }

        .mp-road {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 1;
        }
        .mp-wall-glow {
          fill: none;
          stroke: rgba(0, 242, 254, 0.55);
          stroke-width: 26;
          stroke-linecap: round;
          opacity: 0.6;
        }
        .mp-wall {
          fill: none;
          stroke: url(#mpWallGrad);
          stroke-width: 22;
          stroke-linecap: round;
          opacity: 0.95;
          filter: drop-shadow(0 0 25px rgba(0, 242, 254, 0.8));
        }
        .mp-asphalt {
          fill: none;
          stroke: #1B2531;
          stroke-width: 18;
          stroke-linecap: round;
        }
        .mp-sheen {
          fill: none;
          stroke: rgba(0, 242, 254, 0.16);
          stroke-width: 14;
          stroke-linecap: round;
        }
        .mp-prog {
          fill: none;
          stroke: url(#mpNeon);
          stroke-width: 18;
          stroke-linecap: round;
          opacity: 0.85;
          filter: drop-shadow(0 0 14px rgba(0, 242, 254, 0.7));
          transition: stroke-dashoffset 0.9s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .mp-centerline {
          fill: none;
          stroke: rgba(255, 255, 255, 0.45);
          stroke-width: 2;
          stroke-dasharray: 10 14;
          stroke-linecap: round;
        }

        .mp-arrow {
          animation: mpArrow 2.4s ease infinite;
        }
        .mp-arrow-back {
          fill: #04121F;
        }
        .mp-arrow-face {
          fill: url(#mpNeon);
          filter: drop-shadow(0 0 16px rgba(0, 242, 254, 0.9));
        }
        @keyframes mpArrow {
          0%, 100% { opacity: 0.85; }
          50% { opacity: 1; }
        }

        /* ===== УЗЛЫ (НОДЫ) - МОБИЛЬНЫЙ ПЕРВЫМ ДЕЛОМ ===== */
        .mp-node {
          position: absolute;
          width: 44px; /* Увеличено с 36px для комфортного клика */
          height: 44px;
          border-radius: 50%;
          transform: translate(-50%, -50%);
          z-index: 4;
          display: grid;
          place-items: center;
          cursor: pointer;
          background: rgba(10, 20, 30, 0.85);
          border: 1.5px solid #00E5FF;
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          box-shadow: 0 8px 22px rgba(0, 0, 0, 0.45), 0 0 14px rgba(0, 229, 255, 0.25);
          transition: transform 0.2s ease, border-color 0.2s ease;
        }

        .mp-node:active:not(:disabled) {
          transform: translate(-50%, -50%) scale(0.92);
        }

        .mp-node:disabled {
          cursor: not-allowed;
          filter: saturate(0.35);
          opacity: 0.5;
        }

        .mp-node-badge {
          position: absolute;
          top: -6px;
          left: -6px;
          background: #071726;
          border: 1px solid #00F2FE;
          color: #00F2FE;
          font-size: 9px;
          font-weight: 800;
          padding: 1px 4px;
          border-radius: 6px;
          line-height: 1;
          box-shadow: 0 2px 6px rgba(0,0,0,0.5);
          z-index: 5;
        }

        .mp-node-ico {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background: radial-gradient(circle at 32% 28%, #0B2A52, #06121F 75%);
          color: #7DF9FF;
        }
        .mp-node-ico svg { width: 16px; height: 16px; }

        .mp-node.done {
          background: linear-gradient(180deg, rgba(0, 242, 254, 0.35), rgba(10, 20, 30, 0.9));
          box-shadow: 0 0 22px rgba(0, 242, 254, 0.5);
        }
        .mp-node.done .mp-node-ico { color: #fff; }

        .mp-node-check, .mp-node-lock {
          position: absolute;
          top: -3px; 
          right: -3px;
          width: 16px; 
          height: 16px;
          border-radius: 50%;
          display: grid; 
          place-items: center;
          font-size: 9px; 
          z-index: 5;
        }
        .mp-node-check { background: #00F2FE; color: #04121F; font-weight: 800; }
        .mp-node-lock { background: #4A6075; color: #fff; }

        /* ===== ТЕКСТОВЫЕ МЕТКИ НА КАРТЕ ===== */
        .mp-text {
          display: none; /* Скрыто на экранах < 480px */
        }

        /* ===== МОБИЛЬНЫЙ СПИСОК (< 480px) ===== */
        .mp-mobile-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 16px;
        }

        .mp-mobile-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 14px;
          background: rgba(10, 22, 34, 0.75);
          border: 1px solid rgba(0, 242, 254, 0.18);
          border-radius: 12px;
          backdrop-filter: blur(10px);
          text-align: left;
          cursor: pointer;
          transition: background 0.2s ease, border-color 0.2s ease;
        }

        .mp-mobile-card:not(:disabled):active {
          background: rgba(0, 242, 254, 0.12);
          border-color: #00F2FE;
        }

        .mp-mobile-card:disabled {
          opacity: 0.45;
          cursor: not-allowed;
          filter: saturate(0.3);
        }

        .mp-mobile-card-num {
          font-size: 11px;
          font-weight: 800;
          color: #00F2FE;
          min-width: 20px;
        }

        .mp-mobile-card-body { flex: 1; }

        .mp-mobile-card-status {
          font-size: 14px;
          color: #00F2FE;
          font-weight: bold;
        }

        .mp-num { font-size: 9px; font-weight: 500; letter-spacing: 0.18em; color: #00F2FE; }
        .mp-name {
          font-family: 'Outfit', sans-serif;
          font-size: 0.92rem;
          font-weight: 700;
          color: #FFFFFF;
          margin: 1px 0;
          line-height: 1.2;
        }
        .mp-desc {
          font-family: 'Outfit', sans-serif;
          font-size: 0.75rem;
          font-weight: 400;
          color: #94A3B8;
          line-height: 1.25;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        /* ПЛАНШЕТЫ И ДЕСКТОПЫ (>= 480px) */
        @media (min-width: 480px) {
          .mp-node { width: 44px; height: 44px; }
          .mp-node-ico { width: 28px; height: 28px; }
          .mp-node-ico svg { width: 14px; height: 14px; }
          .mp-node-badge { display: none; } /* Скрываем цифры на нодах, так как они есть на карточках */

          .mp-mobile-list { display: none; } /* Скрываем список */

          .mp-text {
            display: block; /* Показываем плавающие карточки */
            position: absolute;
            z-index: 2;
            width: 180px;
            padding: 8px 10px;
            border-radius: 10px;
            background: rgba(10, 22, 34, 0.8);
            border: 1px solid rgba(0, 242, 254, 0.22);
            backdrop-filter: blur(12px);
            pointer-events: none;
          }

          .mp-text--right { transform: translate(24px, -50%); }
          .mp-text--left { transform: translate(calc(-100% - 24px), -50%); }
        }

        @media (min-width: 768px) {
          .mp-page { padding: 20px 28px 56px; }
          .mp-brand { margin: 6px 0 20px; gap: 14px; }
          .mp-progress-pill { font-size: 12px; padding: 6px 16px; }
          .mp-scene { border-radius: 22px; }
          .mp-text { width: 210px; padding: 11px 14px; }
          .mp-name { font-size: 1rem; }
          .mp-desc { font-size: 0.8rem; }
        }

        @media (min-width: 1024px) {
          .mp-page { padding: 24px 32px 64px; }
          .mp-tag { font-size: 32px; }
          .mp-node { width: 48px; height: 48px; }
          .mp-node-ico { width: 34px; height: 34px; }
          .mp-node-ico svg { width: 18px; height: 18px; }
          .mp-text { width: 240px; padding: 12px 16px; border-radius: 14px; }
          .mp-name { font-size: 1.1rem; }
          .mp-desc { font-size: 0.85rem; }
          .mp-text--right { transform: translate(28px, -50%); }
          .mp-text--left { transform: translate(calc(-100% - 28px), -50%); }
        }

        .mp-foot {
          margin-top: 24px;
          display: flex;
          justify-content: center;
        }
        .mp-cta {
          padding: 12px 28px;
          border: none;
          cursor: pointer;
          font-family: 'Outfit', sans-serif;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: #04121F;
          background: linear-gradient(90deg, #00F2FE, #00E5FF);
          clip-path: polygon(12px 0, 100% 0, calc(100% - 12px) 100%, 0 100%);
          box-shadow: 0 0 22px rgba(0, 242, 254, 0.45);
        }

        @media (prefers-reduced-motion: reduce) {
          .mp-arrow, .mp-node.current { animation: none !important; }
          .mp-prog { transition: none; }
        }
      `}</style>
    </>
  );
}