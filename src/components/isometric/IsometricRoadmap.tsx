import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { STAGES } from '../../data/stages';
import type { StageId } from '../../data/stages';
import type { StageStatus } from '../../store/useOnboarding';

type Props = {
  statuses: Record<StageId, StageStatus>;
  onSelect: (id: StageId) => void;
  done: number;
};

// компактный зигзаг — всё внутри безопасной зоны 780×620
const POS: { id: StageId; x: number; y: number }[] = [
  { id: 1, x: 190, y: 470 },
  { id: 2, x: 320, y: 395 },
  { id: 3, x: 450, y: 455 },
  { id: 4, x: 585, y: 375 },
  { id: 5, x: 465, y: 175 },
];

const IS_LOW = typeof navigator !== 'undefined'
  ? (navigator.hardwareConcurrency !== undefined && navigator.hardwareConcurrency <= 4)
  : false;

function playBeep() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine'; osc.frequency.value = 820;
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.09);
    osc.connect(gain).connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.1);
    setTimeout(() => ctx.close(), 200);
  } catch { /* silent */ }
}
function playWhoosh() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(640, ctx.currentTime + 0.32);
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.36);
    osc.connect(gain).connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.38);
    setTimeout(() => ctx.close(), 500);
  } catch { /* silent */ }
}

export function IsometricRoadmap({ statuses, onSelect, done }: Props) {
  const nav = useNavigate();
  const [portalOpen, setPortalOpen] = useState(false);
  const [finale, setFinale] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const prevDoneRef = useRef(done);

  // anchored zoom к порталу — ничего не уезжает
  const zoom = useMemo(() => 1 + done * 0.02, [done]);

  const currentId = useMemo<StageId>(() => {
    for (let i = 1 as StageId; i <= 5; i = (i + 1) as StageId) {
      if (statuses[i] === 'current') return i;
    }
    return 5;
  }, [statuses]);
  const currentStage = STAGES.find((s) => s.id === currentId)!;

  useEffect(() => {
    if (done === 5 && prevDoneRef.current < 5) {
      setPortalOpen(true);
      if (soundOn) playWhoosh();
      setTimeout(() => setFinale(true), 700);
      const end = Date.now() + 1800;
      const colors = ['#e052a0', '#8b5cf6', '#c084fc', '#f472b6'];
      const frame = () => {
        confetti({ particleCount: 3, angle: 60, spread: 70, origin: { x: 0, y: 0.7 }, colors });
        confetti({ particleCount: 3, angle: 120, spread: 70, origin: { x: 1, y: 0.7 }, colors });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      frame();
      confetti({ particleCount: 80, spread: 90, origin: { y: 0.6 }, colors, scalar: 1.1 });
    }
    prevDoneRef.current = done;
  }, [done, soundOn]);

  // swipe
  const touchX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { touchX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) < 48) return;
    const curIdx = Math.max(0, done - 1);
    const nextIdx = dx < 0 ? Math.min(4, curIdx + 1) : Math.max(0, curIdx - 1);
    const id = POS[nextIdx].id as StageId;
    if (statuses[id] !== 'locked') { onSelect(id); if (soundOn) playBeep(); }
  };

  const segTraveled = (b: StageId) => statuses[b] === 'done' || statuses[b] === 'current';
  const segD = (i: number) => `M${POS[i].x} ${POS[i].y} L${POS[i + 1].x} ${POS[i + 1].y}`;
  const portalActive = statuses[5] !== 'locked';
  const ffCount = IS_LOW ? 5 : 8;
  const starCount = IS_LOW ? 8 : 14;

  return (
    <div className="iso-root" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {/* ===== сцена-руины: единый остров ===== */}
      <svg viewBox="0 0 780 620" className="iso-scene" preserveAspectRatio="xMidYMid meet" aria-hidden>
        <defs>
          <linearGradient id="skyG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#120e2e" />
            <stop offset="60%" stopColor="#0d0a20" />
            <stop offset="100%" stopColor="#0b0719" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="colL" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#241640" />
            <stop offset="62%" stopColor="#2d1c4e" />
            <stop offset="100%" stopColor="#3a2765" />
          </linearGradient>
          <linearGradient id="rayG" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f472b6" stopOpacity=".10" />
            <stop offset="100%" stopColor="#f472b6" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* небо + звёзды */}
        <rect width="780" height="420" fill="url(#skyG)" />
        <g className="stars">
          {Array.from({ length: starCount }).map((_, i) => {
            const sx = 40 + ((i * 97) % 700);
            const sy = 26 + ((i * 53) % 130);
            const r = i % 3 === 0 ? 1.6 : 1.1;
            return <circle key={i} cx={sx} cy={sy} r={r} fill="#e9d5ff" opacity={0.35 + (i % 4) * 0.12} className={i % 2 ? 'starTw' : undefined} style={{ animationDelay: `${i * 0.7}s` }} />;
          })}
        </g>

        {/* луч света сверху-справа */}
        <path d="M780 40 L520 300 L300 620 L780 620 Z" fill="url(#rayG)" />

        {/* ===== ОСТРОВ-ОСНОВА ===== */}
        <path d="M60 430 Q90 400 150 392 L600 380 Q680 384 720 420 Q750 452 730 480 L690 560 Q540 600 380 592 Q200 586 110 540 Q70 505 60 430 Z"
          fill="#17102c" stroke="#241a3e" strokeWidth="1.5" />
        {/* тёмный низ острова (висит в пустоте как на референсе) */}
        <path d="M120 520 Q180 566 320 574 Q480 582 640 552 L600 596 Q450 618 300 606 Q170 594 120 520 Z" fill="#0d0918" />

        {/* ===== КОЛОННАДА СЛЕВА ===== */}
        <g>
          {/* колонна A (целая) */}
          <rect x="118" y="205" width="34" height="230" fill="url(#colL)" stroke="#3a2a5c" strokeWidth="1" />
          <line x1="128" y1="210" x2="128" y2="430" stroke="#463073" strokeWidth="1.4" opacity=".7" />
          <line x1="140" y1="210" x2="140" y2="430" stroke="#463073" strokeWidth="1.4" opacity=".5" />
          <rect x="109" y="191" width="52" height="13" rx="2" fill="#33215a" stroke="#3a2a5c" strokeWidth="1" />
          <rect x="113" y="434" width="44" height="11" rx="2" fill="#2c1c4e" stroke="#3a2a5c" strokeWidth="1" />
          {/* мох у подножия */}
          <ellipse cx="132" cy="448" rx="22" ry="6" fill="rgba(20,184,166,.32)" />
          {/* колонна B (обломанная) */}
          <path d="M186 260 h30 v175 h-30 Z M186 260 l5 -16 l9 9 l8 -11 l8 18 Z" fill="#281848" stroke="#3a2a5c" strokeWidth="1" />
          <path d="M196 262 l4 -22 l3 22" stroke="#120c22" strokeWidth="1.4" fill="none" />
          <ellipse cx="201" cy="442" rx="16" ry="5" fill="rgba(20,184,166,.25)" />
          {/* обломки капители рядом */}
          <rect x="222" y="436" width="20" height="10" rx="2" fill="#2c1c4e" stroke="#3a2a5c" strokeWidth="0.8" transform="rotate(-14 232 441)" />
          {/* листва магента над колоннадой */}
          <g className="foliageSway" opacity=".32">
            <ellipse cx="150" cy="180" rx="34" ry="17" fill="#d946ef" />
            <ellipse cx="186" cy="163" rx="24" ry="12" fill="#f472b6" />
            <ellipse cx="120" cy="199" rx="20" ry="10" fill="#a21caf" />
          </g>
        </g>

        {/* ===== КОЛОННАДА СПРАВА ===== */}
        <g>
          <rect x="628" y="235" width="34" height="200" fill="url(#colL)" stroke="#3a2a5c" strokeWidth="1" />
          <line x1="638" y1="240" x2="638" y2="430" stroke="#463073" strokeWidth="1.4" opacity=".7" />
          <rect x="619" y="222" width="52" height="13" rx="2" fill="#33215a" stroke="#3a2a5c" strokeWidth="1" />
          {/* колонна D ниже */}
          <rect x="676" y="290" width="30" height="145" fill="url(#colL)" stroke="#3a2a5c" strokeWidth="1" />
          <rect x="668" y="278" width="46" height="12" rx="2" fill="#33215a" stroke="#3a2a5c" strokeWidth="1" />
          {/* упавшая колонна набок */}
          <g transform="rotate(8 560 452)">
            <rect x="498" y="444" width="118" height="22" rx="4" fill="#2a1a4a" stroke="#3a2a5c" strokeWidth="1" />
            <rect x="498" y="440" width="24" height="30" rx="3" fill="#33215a" stroke="#3a2a5c" strokeWidth="1" />
          </g>
          <ellipse cx="648" cy="446" rx="20" ry="5" fill="rgba(20,184,166,.28)" />
          {/* малая листва справа */}
          <g className="foliageSway" style={{ animationDelay: '1.3s' }} opacity=".24">
            <ellipse cx="706" cy="206" rx="22" ry="11" fill="#d946ef" />
            <ellipse cx="682" cy="192" rx="14" ry="8" fill="#f472b6" />
          </g>
        </g>

        {/* ===== ЛЕСТНИЦА ИЗ БЛОКОВ от узла 1 вверх ===== */}
        <g fill="#231541" stroke="#322457" strokeWidth="1">
          {[
            [128, 512], [152, 494], [176, 476], [200, 458], [226, 440], [252, 422],
          ].map(([bx, by], idx) => (
            <g key={idx}>
              <rect x={bx} y={by} width={44} height={15} rx={2} />
              <line x1={bx + 22} y1={by} x2={bx + 22} y2={by + 15} stroke="#1a1030" strokeWidth="1" />
              <rect x={bx} y={by + 15} width={44} height={6} rx={1} fill="#1c1236" stroke="none" />
            </g>
          ))}
        </g>

        {/* алтарь между узлами 2 и 3 */}
        <g>
          <rect x="376" y="478" width="34" height="26" rx="2" fill="#2a1a4a" stroke="#3a2a5c" strokeWidth="1" />
          <rect x="370" y="470" width="46" height="9" rx="2" fill="#33215a" stroke="#3a2a5c" strokeWidth="1" />
          <circle cx="393" cy="464" r="3.4" fill="#67E8F9" opacity=".85" className="gemPulse" />
        </g>

        {/* ===== АРКА-ПОРТАЛ на узле 5 — кладка из блоков ===== */}
        <g className={`iso-portal ${portalOpen ? 'open' : ''} ${statuses[5]}`} transform={`translate(${POS[4].x} ${POS[4].y})`}>
          {/* тёмный проём */}
          <path d="M-42 -58 v88 a42 46 0 0 1 84 0 v-88 h-84 Z M-30 -58 v82 a30 34 0 0 1 60 0 v-82 Z"
            fillRule="evenodd" fill="#0d0918" className="portalHole" />
          {/* кладка: левые блоки */}
          <g fill="#2a1a4a" stroke="#3a2a5c" strokeWidth="1">
            <rect x="-56" y="-58" width="15" height="34" /><rect x="-56" y="-24" width="15" height="34" /><rect x="-56" y="10" width="15" height="34" />
            <rect x="41" y="-58" width="15" height="34" /><rect x="41" y="-24" width="15" height="34" /><rect x="41" y="10" width="15" height="34" />
          </g>
          {/* арочные блоки-клинья */}
          <g fill="#2f1e54" stroke="#3a2a5c" strokeWidth="1">
            <path d="M-56 -58 L-44 -92 L-30 -74 Z" />
            <path d="M-30 -74 L-16 -98 L-2 -72 L-2 -64 L-30 -64 Z" />
            <path d="M-2 -72 L14 -100 L30 -76 L30 -64 L-2 -64 Z" />
            <path d="M30 -76 L46 -94 L56 -58 L41 -58 Z" />
            <path d="M-16 -98 L14 -104 L14 -100 L-2 -72 Z" opacity=".95" />
          </g>
          {/* замковый камень */}
          <path d="M-8 -102 L8 -102 L12 -86 L-12 -86 Z" fill="#3d2a68" stroke="#8b5cf6" strokeWidth="1.2" />
          {/* лианы свисают */}
          <g className="vines" stroke="#d946ef" strokeWidth="2" fill="none" opacity=".65" strokeLinecap="round">
            <path d="M-34 -70 q-4 16 2 30 q4 10 -2 22" />
            <path d="M28 -66 q5 14 -1 26 q-4 9 2 18" />
          </g>
          {/* рунное кольцо внутри проёма */}
          {portalActive && (
            <g className="runeRingWrap">
              <circle cx="0" cy="-8" r="30" fill="none" stroke="#f472b6" strokeWidth="1.6"
                strokeDasharray="4 9" strokeLinecap="round" opacity=".8" />
              <circle cx="0" cy="-8" r="22" fill="none" stroke="#c084fc" strokeWidth="1"
                strokeDasharray="2 7" opacity=".55" />
            </g>
          )}
          {/* двери */}
          <g className="portal-doors">
            <rect x="-30" y="-58" width="30" height="82" className="door left" rx="2" />
            <rect x="0" y="-58" width="30" height="82" className="door right" rx="2" />
            <line x1="0" y1="-58" x2="0" y2="24" className="door-line" />
          </g>
          {/* навес / топ */}
          <rect x="-60" y="-112" width="120" height="11" rx="3" className="portal-top" />
          <text x="0" y="-120" textAnchor="middle" className="portal-label">MDIGITAL HQ</text>
        </g>

        {/* ===== факелы у пути ===== */}
        {!IS_LOW && (
          <g className="torch" transform="translate(160 330)">
            <rect x="-2.5" y="0" width="5" height="34" rx="2" fill="#3a2a5c" />
            <ellipse className="flame f1" cx="0" cy="-8" rx="5" ry="9" fill="#fb923c" />
            <ellipse className="flame f2" cx="0" cy="-6" rx="3.2" ry="6.5" fill="#fbbf24" />
            <ellipse className="flame f3" cx="0" cy="-4" rx="1.8" ry="4" fill="#fff7ed" />
            <circle cx="0" cy="-6" r="26" fill="rgba(251,146,60,.08)" />
          </g>
        )}
        <g className="torch t2" transform="translate(612 300)">
          <rect x="-2.5" y="0" width="5" height="34" rx="2" fill="#3a2a5c" />
          <ellipse className="flame f1" cx="0" cy="-8" rx="5" ry="9" fill="#fb923c" />
          <ellipse className="flame f2" cx="0" cy="-6" rx="3.2" ry="6.5" fill="#fbbf24" />
          {!IS_LOW && <ellipse className="flame f3" cx="0" cy="-4" rx="1.8" ry="4" fill="#fff7ed" />}
          <circle cx="0" cy="-6" r="24" fill="rgba(251,146,60,.08)" />
        </g>

        {/* ===== вода за валунами ===== */}
        <g>
          <ellipse className="water w1" cx="250" cy="566" rx="150" ry="17" fill="#14b8a6" />
          <ellipse className="water w2" cx="520" cy="576" rx="170" ry="15" fill="#0ea5a4" />
        </g>
        {/* передние валуны группами у колонн */}
        <path d="M84 620 q18 -44 78 -42 q62 2 76 42 Z" fill="#0d0918" />
        <path d="M300 620 q16 -36 66 -33 q52 2 62 33 Z" fill="#100a1e" />
        <path d="M560 620 q20 -46 84 -43 q66 3 82 43 Z" fill="#0d0918" />

        {/* круг-виньетка поверх сцены, центр на пути */}
        <circle cx="390" cy="310" r="340" fill="rgba(20,16,46,.36)" />
        <circle cx="390" cy="310" r="340" fill="none" stroke="rgba(148,163,184,.05)" strokeWidth="1.5" />
      </svg>

      {/* светлячки */}
      <div className="fireflies" aria-hidden>
        {Array.from({ length: ffCount }).map((_, i) => (
          <span
            key={i}
            className={`ff ff${i % 4}`}
            style={{ left: `${22 + ((i * 29) % 56)}%`, top: `${30 + ((i * 37) % 45)}%`, animationDelay: `${i * 1.1}s` }}
          />
        ))}
      </div>

      <div className="iso-scanline" aria-hidden />

      <button
        className="iso-sound font-mono"
        onClick={() => setSoundOn((v) => !v)}
        aria-label={soundOn ? 'Выключить звук' : 'Включить звук'}
        title={soundOn ? 'Звук вкл' : 'Звук выкл'}
      >
        {soundOn ? '🔊' : '🔇'}
      </button>

      {/* шапка карты */}
      <div className="iso-head">
        <div className="ih-eyebrow font-mono">MDIGITAL · ONBOARDING</div>
        <div className="ih-title">Roadmap</div>
      </div>

      {/* игровой слой: путь+узлы, zoom к порталу */}
      <div
        className="iso-stage"
        style={{ transform: `scale(${zoom})`, transformOrigin: '58% 28%' } as any}
      >
        <svg viewBox="0 0 780 620" className="iso-svg" preserveAspectRatio="xMidYMid meet">
          <path
            d={`M${POS.map((p) => `${p.x} ${p.y}`).join(' L')}`}
            className="iso-path"
          />
          {[0, 1, 2, 3].map((i) => {
            const b = POS[i + 1];
            if (!segTraveled(b.id as StageId)) return null;
            return <path key={i} d={segD(i)} className="iso-path-done" />;
          })}
        </svg>

        {POS.map((p) => {
          const st = statuses[p.id as StageId];
          return (
            <button
              key={p.id}
              className={`iso-node ${st}`}
              style={{ left: `${(p.x / 780) * 100}%`, top: `${(p.y / 620) * 100}%` } as any}
              onClick={() => { onSelect(p.id as StageId); if (soundOn) playBeep(); }}
              aria-label={`Этап ${p.id}: ${STAGES.find((s) => s.id === p.id)!.title}`}
            >
              {st === 'done' && <span className="node-check">✓</span>}
              <span className="node-face font-serif">
                {st === 'locked' ? '🔒' : p.id}
              </span>
            </button>
          );
        })}
      </div>

      {/* инфо-карточка текущего этапа */}
      <button type="button" className="iso-info" key={currentId} onClick={() => onSelect(currentId)}>
        <div className="info-title">{currentId}. {currentStage.title}</div>
        <div className="info-desc">{currentStage.description}</div>
        <span className="info-open font-mono">Открыть этап →</span>
      </button>

      {finale && (
        <div className="finale-overlay">
          <div className="finale-flash" />
          <div className="finale-banner">
            <div className="finale-title">Добро пожаловать в ряды MDIGITAL</div>
            <div className="finale-sub">Ты — часть команды. Поехали!</div>
            <button className="btn-primary" onClick={() => nav('/dashboard')}>
              Перейти в кабинет →
            </button>
          </div>
        </div>
      )}

      <style>{`
        .iso-root{
          position:relative; width:100%; height:620px; overflow:hidden; border-radius:18px;
          background:
            radial-gradient(600px 360px at 30% 20%, rgba(139,92,246,.10), transparent 62%),
            radial-gradient(520px 340px at 74% 78%, rgba(236,72,153,.09), transparent 62%),
            linear-gradient(180deg, #120e2e 0%, #0b0719 70%);
          border:1px solid rgba(139,92,246,.12);
          touch-action: pan-y;
        }
        .iso-scene{ position:absolute; inset:0; width:100%; height:100%; }

        .starTw{ animation:starTw 2.6s ease-in-out infinite alternate }
        @keyframes starTw{ from{opacity:.25} to{opacity:.75} }

        .foliageSway{ animation:sway 5s ease-in-out infinite; transform-box:fill-box; transform-origin:top center }
        @keyframes sway{ 0%,100%{ transform:rotate(-1.6deg) } 50%{ transform:rotate(1.8deg) } }

        .water{ animation:waterShim 4s ease-in-out infinite alternate }
        .w2{ animation-delay:1.6s }
        @keyframes waterShim{ from{opacity:.10} to{opacity:.20} }

        .gemPulse{ animation:gemP 2s ease-in-out infinite; transform-box:fill-box; transform-origin:center }
        @keyframes gemP{ 0%,100%{ opacity:.55; transform:scale(1) } 50%{ opacity:1; transform:scale(1.25) } }

        /* факелы */
        .flame{ transform-box:fill-box; transform-origin:50% 100% }
        .f1{ animation:flick .9s ease-in-out infinite alternate }
        .f2{ animation:flick .7s ease-in-out infinite alternate-reverse }
        .f3{ animation:flick 1.3s ease-in-out infinite alternate }
        @keyframes flick{
          0%{ transform:scaleY(.92) scaleX(1) translateY(0) }
          50%{ transform:scaleY(1.12) scaleX(.92) translateY(-1.5px) }
          100%{ transform:scaleY(.96) scaleX(1.05) translateY(-.5px) }
        }

        /* лианы */
        .vines{ transform-box:fill-box; transform-origin:top center; animation:vineSway 5s ease-in-out infinite }
        @keyframes vineSway{ 0%,100%{ transform:rotate(-2deg) } 50%{ transform:rotate(2.4deg) } }

        /* рунное кольцо портала */
        .runeRingWrap circle{
          transform-box:fill-box; transform-origin:center;
          animation:runeSpin 12s linear infinite;
        }
        .runeRingWrap circle:last-child{ animation-duration:18s; animation-direction:reverse }
        @keyframes runeSpin{ to{ transform:rotate(360deg) } }
        .portalHole{ animation:holePulse 2.4s ease-in-out infinite }
        @keyframes holePulse{ 0%,100%{ opacity:.92 } 50%{ opacity:.72 } }

        .iso-scanline{
          position:absolute; inset:0; pointer-events:none; z-index:2; opacity:.16;
          background:repeating-linear-gradient(0deg, transparent 0 2px, rgba(10,7,25,.5) 2px 4px);
        }
        .iso-sound{
          position:absolute; top:12px; right:12px; z-index:6;
          width:34px; height:34px; border-radius:999px; display:grid; place-items:center;
          background:rgba(15,10,30,.62); border:1px solid rgba(139,92,246,.2); color:#fff; font-size:14px;
        }
        .iso-head{ position:absolute; top:18px; left:24px; z-index:6; text-align:left; }
        .ih-eyebrow{ font-size:10px; letter-spacing:.3em; text-transform:uppercase; color:#94a3b8; margin-bottom:6px; }
        .ih-title{ font-family:'Unbounded',sans-serif; font-weight:800; font-size:28px; color:#fff; line-height:1; }

        .iso-stage{
          position:absolute; inset:0; width:100%; height:100%; z-index:3;
          will-change:transform; transition:transform .9s cubic-bezier(.2,.8,.2,1);
        }
        .iso-svg{ position:absolute; inset:0; width:100%; height:100%; overflow:visible; }

        .iso-path{
          fill:none; stroke:rgba(255,255,255,.85); stroke-width:3;
          stroke-dasharray:14 12; stroke-linecap:round;
          filter:drop-shadow(0 1px 3px rgba(0,0,0,.5));
          animation:dashFlow 3.2s linear infinite;
        }
        @keyframes dashFlow{ to{ stroke-dashoffset:-26 } }
        .iso-path-done{
          fill:none; stroke:#c084fc; stroke-width:3;
          stroke-dasharray:14 12; stroke-linecap:round;
          filter:drop-shadow(0 0 6px rgba(192,132,252,.55));
          animation:pathBreathe 2.6s ease-in-out infinite;
        }
        @keyframes pathBreathe{ 0%,100%{ filter:drop-shadow(0 0 4px rgba(192,132,252,.4)) } 50%{ filter:drop-shadow(0 0 9px rgba(192,132,252,.75)) } }

        /* портал стили */
        .portal-top{ fill:#e052a0; filter:drop-shadow(0 0 10px rgba(224,82,160,.7)); }
        .portal-label{ font-family:'Orbitron',sans-serif; font-size:9px; letter-spacing:.2em; fill:#fff; opacity:.92; }
        .portal-doors .door{
          fill:#17102c; stroke:rgba(224,82,160,.5); stroke-width:1.2;
          transition:transform .7s cubic-bezier(.2,.8,.2,1); will-change:transform;
        }
        .iso-stage .iso-portal.open .door.left{ transform:translate3d(-34px,0,0); }
        .iso-stage .iso-portal.open .door.right{ transform:translate3d(34px,0,0); }
        .door-line{ stroke:rgba(224,82,160,.35); stroke-width:1; }
        .iso-portal.done .portal-top{ fill:#c084fc; filter:drop-shadow(0 0 12px rgba(192,132,252,.75)); animation:portalGlow 1.6s ease-in-out infinite; }
        @keyframes portalGlow{ 0%,100%{ filter:drop-shadow(0 0 8px rgba(192,132,252,.5)) } 50%{ filter:drop-shadow(0 0 16px rgba(192,132,252,.85)) } }

        /* чипы */
        .iso-node{
          position:absolute; transform:translate(-50%,-50%);
          width:88px; height:88px; border-radius:50%;
          display:grid; place-items:center; padding:0;
          background:transparent; cursor:pointer;
          will-change:transform,opacity; transition:transform .16s ease;
        }
        .iso-node:hover{ transform:translate(-50%,-50%) scale(1.07); z-index:5; }
        .iso-node:active{ transform:translate(-50%,-50%) scale(.97); }
        .node-face{
          width:72px; height:72px; border-radius:50%;
          display:grid; place-items:center;
          font-weight:800; font-size:26px; color:#fff;
          background:rgba(22,17,44,.78);
          border:2px solid rgba(167,139,250,.55);
          backdrop-filter:blur(6px);
          box-shadow:0 6px 18px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.08);
        }
        .iso-node.current .node-face{
          background:linear-gradient(135deg,#a78bfa,#7c3aed);
          border-color:rgba(255,255,255,.35);
          box-shadow:0 0 0 0 rgba(167,139,250,.5), 0 8px 22px rgba(124,58,237,.45);
          animation:chipPulse 1.9s ease-out infinite;
        }
        @keyframes chipPulse{
          0%{ box-shadow:0 0 0 0 rgba(167,139,250,.45), 0 8px 22px rgba(124,58,237,.45) }
          70%{ box-shadow:0 0 0 18px rgba(167,139,250,0), 0 8px 22px rgba(124,58,237,.45) }
          100%{ box-shadow:0 0 0 0 rgba(167,139,250,0), 0 8px 22px rgba(124,58,237,.45) }
        }
        .iso-node.done .node-face{ border-color:#c084fc; background:rgba(22,17,44,.82); }
        .iso-node.locked{ cursor:not-allowed; }
        .iso-node.locked .node-face{
          background:rgba(15,10,30,.6); border-color:rgba(139,92,246,.22);
          color:#94a3b8; opacity:.6; font-size:20px;
        }
        .node-check{
          position:absolute; top:4px; right:6px; width:20px; height:20px; border-radius:50%;
          display:grid; place-items:center; font-size:11px; font-weight:700;
          color:#080711; background:#c084fc; box-shadow:0 2px 8px rgba(0,0,0,.4);
        }

        /* инфо-карточка */
        .iso-info{
          position:absolute; left:20px; top:33%; z-index:6;
          width:min(320px, calc(100% - 40px));
          text-align:left; padding:18px 20px; border-radius:16px;
          background:linear-gradient(160deg, rgba(14,26,38,.84), rgba(18,16,44,.84));
          border:1px solid rgba(148,163,184,.1);
          backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px);
          box-shadow:0 18px 42px rgba(0,0,0,.45);
          cursor:pointer;
          animation:cardIn .28s cubic-bezier(.2,.8,.2,1), cardFloat 6s ease-in-out 0.4s infinite;
        }
        @keyframes cardIn{ from{ opacity:0; transform:translateY(10px) } to{ opacity:1; transform:none } }
        @keyframes cardFloat{ 0%,100%{ transform:translateY(0) } 50%{ transform:translateY(-3px) } }
        .info-title{ font-family:'Manrope',sans-serif; font-size:17px; font-weight:700; color:#fff; margin-bottom:8px; line-height:1.25; }
        .info-desc{
          font-family:'Manrope',sans-serif; font-size:13px; line-height:1.6; color:#cbd5e1;
          display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden;
        }
        .info-open{ display:block; margin-top:10px; font-size:10px; letter-spacing:.12em; color:#c084fc; }

        /* светлячки */
        .fireflies{ position:absolute; inset:0; pointer-events:none; z-index:4; overflow:hidden; }
        .ff{
          position:absolute; width:4px; height:4px; border-radius:50%;
          will-change:transform,opacity; animation:ffDrift 9s ease-in-out infinite;
        }
        .ff0{ background:#f472b6; box-shadow:0 0 8px #f472b6 }
        .ff1{ background:#c084fc; box-shadow:0 0 8px #c084fc; width:3px; height:3px }
        .ff2{ background:#f9a8d4; box-shadow:0 0 7px #f9a8d4; width:3px; height:3px }
        .ff3{ background:#ec4899; box-shadow:0 0 9px #ec4899 }
        @keyframes ffDrift{
          0%{ transform:translateY(0); opacity:0 }
          15%{ opacity:.9 }
          55%{ opacity:.35; transform:translateY(-26px) translateX(6px) }
          80%{ opacity:.8 }
          100%{ transform:translateY(-58px) translateX(-4px); opacity:0 }
        }

        .finale-overlay{ position:absolute; inset:0; z-index:10; display:grid; place-items:center; background:rgba(8,7,17,.8); backdrop-filter:blur(8px); animation:finaleIn .32s ease; }
        @keyframes finaleIn{ from{opacity:0} to{opacity:1} }
        .finale-flash{ position:absolute; inset:0; background:#fff; opacity:0; pointer-events:none; animation:flash .32s ease .05s; }
        @keyframes flash{ 0%{opacity:0} 20%{opacity:.85} 100%{opacity:0} }
        .finale-banner{
          position:relative; text-align:center; padding:28px 22px; border-radius:18px;
          background:linear-gradient(180deg, rgba(15,10,30,.94), rgba(8,7,17,.98));
          border:1px solid rgba(224,82,160,.22);
          box-shadow:0 24px 64px rgba(0,0,0,.55), 0 0 32px rgba(224,82,160,.18);
          max-width:520px; width:calc(100% - 24px);
        }
        .finale-title{
          font-family:'Unbounded',sans-serif; font-weight:800; font-size:17px; line-height:1.35;
          background:linear-gradient(90deg,#f472b6,#c084fc,#f472b6);
          -webkit-background-clip:text; background-clip:text; color:transparent;
          margin-bottom:10px;
        }
        .finale-sub{ font-family:'Manrope',sans-serif; font-size:13px; color:#94a3b8; margin-bottom:20px; }

        @media (max-width:760px){
          .iso-root{ height:540px; }
          .ih-title{ font-size:22px; }
          .iso-node{ width:64px; height:64px; }
          .node-face{ width:54px; height:54px; font-size:19px; }
          .node-check{ width:17px; height:17px; font-size:9.5px; top:2px; right:4px; }
          .iso-path{ stroke-width:3.4 }
          .torch.t2{ display:none }
          .iso-info{
            left:12px; right:12px; bottom:12px; top:auto; width:auto;
            padding:14px 16px;
            animation:cardIn .28s cubic-bezier(.2,.8,.2,1);
          }
          .info-title{ font-size:14.5px; }
          .info-desc{ font-size:12px; -webkit-line-clamp:2; }
          .info-open{ margin-top:8px; }
          .finale-title{ font-size:14px; }
        }
        @media (prefers-reduced-motion: reduce){
          .iso-node.current .node-face,
          .iso-portal.done .portal-top,
          .iso-path, .iso-path-done,
          .flame, .vines, .runeRingWrap circle, .portalHole,
          .starTw, .water, .gemPulse, .ff, .iso-info{ animation:none !important; }
          .iso-stage{ transition:none; }
        }
      `}</style>
    </div>
  );
}
