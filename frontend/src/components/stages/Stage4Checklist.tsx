import type { StageId } from '../../data/stages';

interface Props { stageId: StageId }

export function Stage4Checklist({ }: Props) {
  return (
    <div className="checklist-single">
      <div className="cl-single-head">
        <div className="cl-single-title">Чек-лист готовности</div>
        <div className="cl-single-sub">Один лист — отметь, что всё готово к работе (5 XP)</div>
      </div>
      <div className="cl-single-body">
        Отметь задачу ниже, когда проверишь доступы и рабочее место.
      </div>
      <style>{`
        .checklist-single{ margin-bottom:6px; font-family:'Open Sans',sans-serif }
        .cl-single-head{ padding:10px 12px; border:1px solid rgba(255,255,255,.06); border-radius:10px; background:rgba(255,255,255,.02); margin-bottom:8px }
        .cl-single-title{ font-size:13px; font-weight:800; color:var(--text) }
        .cl-single-sub{ font-size:11px; color:var(--muted); margin-top:4px }
        .cl-single-body{ padding:10px 12px; border:1px dashed var(--border); border-radius:10px; background:rgba(59,130,246,.04); font-size:12px; color:var(--muted) }
      `}</style>
    </div>
  );
}
