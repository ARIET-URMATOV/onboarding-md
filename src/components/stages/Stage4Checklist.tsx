import type { StageId } from '../../data/stages';

interface Props { stageId: StageId }

const QUICK_LINKS = [
  { label: 'Доступ к репо', hint: 'github.com/mdigital' },
  { label: 'Figma · Frontend', hint: 'figma.com/mdigital-frontend' },
  { label: 'Корп. почта', hint: 'web.mdigital.io' },
  { label: 'Style guide', hint: 'style.mdigital.io' },
];

export function Stage4Checklist({ }: Props) {
  return (
    <div className="checklist">
      <div className="quick">
        {QUICK_LINKS.map((q) => (
          <a className="quick-row" href="#" key={q.label} onClick={(e) => e.preventDefault()}>
            <div className="q-icon">↗</div>
            <div className="q-body">
              <div className="q-label">{q.label}</div>
              <div className="q-hint">{q.hint}</div>
            </div>
          </a>
        ))}
      </div>
      <style>{`
        .checklist{ margin-bottom:6px }
        .quick{
          display:grid; grid-template-columns:1fr; gap:10px;
        }
        .quick-row{
          display:flex; align-items:center; gap:10px;
          padding:10px 12px;
          background:rgba(255,255,255,.02);
          border:1px solid var(--border);
          border-radius:9px;
          font-size:11.5px;
          transition:background .15s ease;
          min-height:44px;
          font-family:'Open Sans',sans-serif;
        }
        .quick-row:hover{ background:rgba(59,130,246,.06) }
        .q-icon{
          width:26px; height:26px; border-radius:6px;
          background:rgba(59,130,246,.1);
          color:var(--cyan-l); font-size:12px;
          display:grid; place-items:center; flex-shrink:0;
        }
        .q-body{ min-width:0; flex:1; }
        .q-label{ color:var(--text); font-weight:600; font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .q-hint{ font-size:12px; color:var(--muted); margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        @media (min-width:861px){
          .quick{ grid-template-columns:1fr 1fr; gap:8px; }
          .q-label{ font-size:12px; }
        }
      `}</style>
    </div>
  );
}
