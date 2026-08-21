import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { STAGES } from '../../data/stages';
import type { StageStatus } from '../../store/useOnboarding';

type Props = {
  open: boolean;
  onClose: () => void;
  statuses: Record<number, StageStatus>;
  progressPct: number;
  doneCount: number;
};

const POS = [
  { id: 1, x: 200, y: 32 },
  { id: 2, x: 90, y: 125 },
  { id: 3, x: 310, y: 125 },
  { id: 4, x: 90, y: 220 },
  { id: 5, x: 310, y: 220 },
];
const EDGES: [number, number][] = [
  [1, 2],
  [1, 3],
  [2, 4],
  [3, 5],
];

export function VirtualScheme({ open, onClose, statuses, progressPct, doneCount }: Props) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="vs-veil" onClick={onClose}>
      <div className="vs-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="vs-top">
          <div>
            <div className="vs-title font-orbitron">Карта этапов</div>
            <div className="vs-sub font-orbitron">Схема-дерево · {doneCount}/5 · {progressPct}%</div>
          </div>
          <button className="vs-x" onClick={onClose} aria-label="Закрыть">×</button>
        </div>

        <div className="vs-tree-wrap">
          <svg viewBox="0 0 400 280" preserveAspectRatio="xMidYMid meet" className="vs-svg" aria-hidden>
            {EDGES.map(([a, b], i) => {
              const pa = POS.find((p) => p.id === a)!;
              const pb = POS.find((p) => p.id === b)!;
              return <line key={i} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} className="vs-edge" />;
            })}
            {EDGES.map(([a, b], i) => {
              const stB = statuses[b];
              const active = stB === 'done' || stB === 'current';
              if (!active) return null;
              const pa = POS.find((p) => p.id === a)!;
              const pb = POS.find((p) => p.id === b)!;
              const stA = statuses[a];
              const bothDone = stA === 'done' && stB === 'done';
              return (
                <line
                  key={`p-${i}`}
                  x1={pa.x}
                  y1={pa.y}
                  x2={pb.x}
                  y2={pb.y}
                  className={`vs-edge-progress ${bothDone ? 'done' : 'cur'}`}
                  style={{ animationDelay: `${i * 160}ms` }}
                />
              );
            })}
          </svg>

          <div className="vs-nodes-abs">
            {STAGES.map((s, idx) => {
              const st = statuses[s.id];
              const p = POS.find((x) => x.id === s.id)!;
              return (
                <div
                  key={s.id}
                  className={`vs-node vs-node-abs ${st}`}
                  style={{ left: `${(p.x / 400) * 100}%`, top: `${(p.y / 280) * 100}%`, animationDelay: `${idx * 90}ms` } as any}
                >
                  <div className="vs-crystal">
                    <span className="vs-orb" />
                    {st === 'done' && <span className="vs-check">✓</span>}
                    {st === 'locked' && <span className="vs-lock">·</span>}
                  </div>
                  <div className="vs-label">
                    <div className="vs-num font-orbitron">0{s.id}</div>
                    <div className="vs-name">{s.shortLabel}</div>
                    <div className={`vs-badge ${st}`}>{st === 'done' ? 'Пройдено' : st === 'current' ? 'Сейчас' : 'Закрыто'}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="vs-foot">
          <span className="vs-hint">Дерево этапов — линии как ветви</span>
          <Link to="/roadmap" className="btn-primary sm" onClick={onClose}>Открыть 3D карту →</Link>
        </div>
      </div>
      <style>{`
        .vs-veil{ position:fixed; inset:0; z-index:45; display:grid; place-items:center; padding:20px; background:rgba(4,6,15,.72); backdrop-filter:blur(10px); animation:vsIn .18s ease }
        @keyframes vsIn{ from{opacity:0} to{opacity:1} }
        .vs-modal{
          position:relative; width:min(720px,100%); max-height:86vh; overflow:hidden; display:flex; flex-direction:column;
          background:
            radial-gradient(600px 160px at 50% 0%, rgba(244,114,182,.08), transparent 70%),
            linear-gradient(180deg, rgba(14,22,38,.98), rgba(6,12,24,.98));
          border:1px solid rgba(249,168,212,.18); border-radius:20px;
          box-shadow:0 24px 64px rgba(0,0,0,.55), inset 0 0 30px rgba(244,114,182,.06);
          animation:vsModal .32s cubic-bezier(.2,.8,.2,1);
        }
        @keyframes vsModal{ from{ opacity:0; transform:translateY(8px) scale(.98)} to{opacity:1; transform:none} }
        .vs-top{ display:flex; justify-content:space-between; align-items:flex-start; gap:12px; padding:16px 18px; border-bottom:1px solid rgba(255,255,255,.06); flex-shrink:0 }
        .vs-title{ font-size:13px; font-weight:800; color:#fff; letter-spacing:.04em }
        .vs-sub{ font-size:10px; letter-spacing:.14em; color:#f9a8d4; margin-top:4px; text-transform:uppercase; opacity:.9 }
        .vs-x{ width:28px; height:28px; border-radius:8px; border:1px solid rgba(255,255,255,.08); background:rgba(255,255,255,.04); color:#fff; font-size:18px; display:grid; place-items:center; flex-shrink:0 }
        .vs-tree-wrap{
          position:relative; flex:1; aspect-ratio:400/280; max-width:560px; width:100%; margin:0 auto;
          background:radial-gradient(520px 160px at 50% 0%, rgba(244,114,182,.05), transparent 70%);
          overflow:visible;
          padding:18px 0 12px;
          box-sizing:border-box;
        }
        .vs-svg{ position:absolute; inset:18px 0 12px 0; width:100%; height:calc(100% - 30px); pointer-events:none; }
        .vs-edge{ stroke:rgba(255,255,255,.08); stroke-width:1.6; stroke-linecap:round }
        .vs-edge-progress{ stroke:#f472b6; stroke-width:2.2; stroke-linecap:round; stroke-dasharray:420; stroke-dashoffset:420; animation:drawLine .9s cubic-bezier(.2,.8,.2,1) forwards; filter:drop-shadow(0 0 6px rgba(244,114,182,.6)) }
        .vs-edge-progress.done{ stroke:#c084fc; filter:drop-shadow(0 0 6px rgba(192,132,252,.5)) }
        @keyframes drawLine{ to{ stroke-dashoffset:0 } }
        .vs-nodes-abs{ position:absolute; inset:18px 0 12px 0; }
        .vs-node-abs{ position:absolute; transform:translate(-50%,-50%); display:flex; flex-direction:column; align-items:center; gap:8px; text-align:center; animation:nodeIn .48s cubic-bezier(.2,.8,.2,1) both }
        @keyframes nodeIn{ from{opacity:0; transform:translate(-50%,-44%) scale(.92)} to{opacity:1; transform:translate(-50%,-50%) scale(1)} }
        .vs-crystal{
          position:relative; width:54px; height:54px; display:grid; place-items:center;
          border-radius:12px; background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.06);
        }
        .vs-node.cur .vs-crystal{ border-color:rgba(244,114,182,.42); background:radial-gradient(circle at 30% 30%, rgba(244,114,182,.16), transparent 60%), rgba(244,114,182,.06); box-shadow:0 0 16px rgba(244,114,182,.22) }
        .vs-node.done .vs-crystal{ border-color:rgba(192,132,252,.32); background:rgba(192,132,252,.08) }
        .vs-node.lock{ filter:saturate(.45); opacity:.86 }
        .vs-orb{ width:13px; height:13px; border-radius:3px; transform:rotate(45deg); background:linear-gradient(135deg,#f472b6,#8b5cf6); box-shadow:0 0 10px rgba(244,114,182,.55) }
        .vs-node.done .vs-orb{ background:linear-gradient(135deg,#c084fc,#8b5cf6) }
        .vs-node.lock .vs-orb{ background:#4A6075; box-shadow:none }
        .vs-check{ position:absolute; top:3px; right:3px; width:14px; height:14px; border-radius:50%; display:grid; place-items:center; font-size:9px; color:#fff; background:rgba(192,132,252,.92); box-shadow:0 2px 6px rgba(0,0,0,.3) }
        .vs-lock{ position:absolute; top:3px; right:3px; width:14px; height:14px; border-radius:50%; display:grid; place-items:center; font-size:10px; color:#fff; background:rgba(74,96,117,.9) }
        .vs-label{ display:flex; flex-direction:column; gap:3px; align-items:center }
        .vs-num{ font-size:9.5px; color:#f9a8d4; letter-spacing:.14em }
        .vs-node.lock .vs-num{ color:#4A6075 }
        .vs-name{ font-size:11px; font-weight:600; color:#E2F4FF; line-height:1.1; white-space:nowrap }
        .vs-node.lock .vs-name{ color:#7C94A8 }
        .vs-badge{ font-size:8.5px; letter-spacing:.12em; text-transform:uppercase; padding:2px 6px; border-radius:999px; border:1px solid rgba(255,255,255,.08); color:#7C94A8; font-family:'Orbitron',sans-serif }
        .vs-badge.done{ color:#c084fc; border-color:rgba(192,132,252,.26); background:rgba(192,132,252,.08) }
        .vs-badge.cur{ color:#f472b6; border-color:rgba(244,114,182,.30); background:rgba(244,114,182,.08) }
        .vs-foot{ display:flex; justify-content:space-between; align-items:center; gap:12px; padding:12px 18px; border-top:1px solid rgba(255,255,255,.06); background:rgba(8,16,28,.5); flex-shrink:0 }
        .vs-hint{ font-size:10px; color:var(--muted); letter-spacing:.06em }
        @media(max-width:600px){
          .vs-tree-wrap{ aspect-ratio:400/300; }
        }
        @media (prefers-reduced-motion: reduce){
          .vs-edge-progress{ animation:none; stroke-dashoffset:0 }
          .vs-node-abs{ animation:none }
        }
      `}</style>
    </div>
  );
}
