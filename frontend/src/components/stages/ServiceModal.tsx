import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

interface Props {
  title: string;
  sub?: string;
  body: string;
  onClose: () => void;
  onConfirm?: () => void;
  confirmLabel?: string;
  alreadyDone?: boolean;
}

export function ServiceModal({ title, sub, body, onClose, onConfirm, confirmLabel, alreadyDone }: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [pct, setPct] = useState(0);
  const [canConfirm, setCanConfirm] = useState(alreadyDone ?? false);

  useEffect(() => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    const check = () => {
      if (!el) return;
      const p = el.scrollHeight <= el.clientHeight ? 100
        : Math.round(((el.scrollTop + el.clientHeight) / el.scrollHeight) * 100);
      setPct(Math.min(100, p));
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 16) setCanConfirm(true);
    };
    check();
    el.addEventListener('scroll', check, { passive: true });
    const ro = new ResizeObserver(check);
    ro.observe(el);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      el.removeEventListener('scroll', check);
      ro.disconnect();
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    };
  }, [onClose]);

  return (
    <div className="svc-modal-veil" onClick={onClose}>
      <div className="svc-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="svc-modal-head">
          <div>
            <div className="svc-modal-title">{title}</div>
            {sub && <div className="svc-modal-sub">{sub}</div>}
          </div>
          <button className="svc-modal-x" onClick={onClose} aria-label="Закрыть"><X size={14} /></button>
        </div>
        <div className="svc-modal-body-wrap">
          <div className="svc-modal-bar" style={{ height: `${pct}%` }} />
          <div ref={scrollRef} className="svc-modal-body">
            {body.split('\n').map((line, i) => {
              const trimmed = line.trim();
              if (!trimmed) return <br key={i} />;
              if (trimmed.match(/^\d+\./)) {
                return <div key={i} className="svc-modal-step">{trimmed}</div>;
              }
              return <p key={i}>{trimmed}</p>;
            })}
          </div>
        </div>
        <div className="svc-modal-foot">
          {onConfirm ? (
            <button
              className="svc-modal-btn"
              disabled={!canConfirm}
              style={!canConfirm ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
              onClick={() => { onConfirm(); onClose(); }}
            >
              {alreadyDone ? 'Ознакомлен(-а) ✓' : (confirmLabel ?? 'Подтвердить прочтение')}
            </button>
          ) : (
            <button className="svc-modal-btn" onClick={onClose}>Понятно</button>
          )}
        </div>
      </div>
      <style>{`
        .svc-modal-veil{ position:fixed; inset:0; z-index:80; display:grid; place-items:center; padding:10px; background:rgba(2,6,15,.72); backdrop-filter:blur(10px); animation:svcIn .18s ease }
        @keyframes svcIn{ from{opacity:0} to{opacity:1} }
        .svc-modal{ width:min(520px,100%); max-height:90vh; display:flex; flex-direction:column; background:rgba(6,12,24,.98); border:1px solid rgba(147,197,253,.22); border-radius:12px; box-shadow:0 20px 60px rgba(0,0,0,.55); overflow:hidden; animation:svcModalIn .22s cubic-bezier(.2,.8,.2,1) }
        @keyframes svcModalIn{ from{opacity:0; transform:translateY(8px) scale(.98)} to{opacity:1; transform:none} }
        .svc-modal-head{ display:flex; justify-content:space-between; align-items:flex-start; gap:10px; padding:14px 16px 12px; border-bottom:1px solid rgba(255,255,255,.06) }
        .svc-modal-title{ font-size:14px; font-weight:800; color:#fff; letter-spacing:.01em }
        .svc-modal-sub{ font-size:11px; color:var(--muted); margin-top:3px; line-height:1.4 }
        .svc-modal-x{ width:26px; height:26px; border-radius:7px; border:1px solid rgba(255,255,255,.08); background:rgba(255,255,255,.04); color:#fff; display:grid; place-items:center; flex-shrink:0 }
        .svc-modal-body-wrap{ position:relative; flex:1; min-height:0; overflow:hidden }
        .svc-modal-bar{ position:absolute; left:0; top:0; width:3px; background:linear-gradient(180deg,#3B82F6,#1E3A8A); border-radius:0 2px 2px 0; transition:height .12s ease; z-index:1 }
        .svc-modal-body{ flex:1; overflow:auto; padding:14px 16px 14px 20px; font-size:13px; line-height:1.7; color:rgba(226,244,255,.88) }
        .svc-modal-body p{ margin:6px 0 }
        .svc-modal-body .svc-modal-step{ margin:8px 0 4px; padding-left:4px; font-size:13px; color:rgba(226,244,255,.95) }
        .svc-modal-foot{ display:flex; justify-content:flex-end; padding:10px 16px; border-top:1px solid rgba(255,255,255,.06) }
        .svc-modal-btn{ padding:8px 20px; border-radius:8px; border:none; cursor:pointer; font-size:11px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; background:linear-gradient(90deg,#1E3A8A,#2563EB); color:#fff; transition:filter .15s }
        .svc-modal-btn:hover{ filter:brightness(1.1) }
      `}</style>
    </div>
  );
}
