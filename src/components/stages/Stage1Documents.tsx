import { useState } from 'react';
import type { StageId } from '../../data/stages';
import { useOnboarding } from '../../store/useOnboarding';
import { DocumentModal } from './DocumentModal';

interface Props { stageId: StageId }

type DocKey = 'docs' | 'lead' | 'mplus';
const docToTask: Record<DocKey, string> = { docs: '1-docs', lead: '1-lead', mplus: '1-mplus' };

function DocCard({ k, doneFlag, icon, title, sub, action, onOpen }: { k: DocKey; doneFlag: boolean; icon: React.ReactNode; title: string; sub: string; action: string; onOpen: (k: DocKey)=>void }) {
  return (
    <button type="button" className={`doc-card ${doneFlag ? 'done' : ''}`} onClick={() => onOpen(k)}>
      <div className={`dc-icon ${k === 'mplus' ? 'mplus' : ''} ${doneFlag ? 'dc-done' : ''}`}>{doneFlag ? '✓' : icon}</div>
      <div className="dc-body">
        <div className="dc-title">{title} {doneFlag && <span className="dc-badge">прочитано</span>}</div>
        <div className="dc-sub">{sub}</div>
      </div>
      <span className={`dc-link ${doneFlag ? 'is-done' : ''}`}>{doneFlag ? 'ПОВТОРНО' : action}</span>
    </button>
  );
}

export function Stage1Documents({ stageId }: Props) {
  const done = useOnboarding((s) => s.doneTasks[stageId] || []);
  const toggle = useOnboarding((s) => s.toggleTask);
  const [open, setOpen] = useState<DocKey | null>(null);

  const isDone = (k: DocKey) => done.includes(docToTask[k]);

  const handleConfirm = (k: DocKey) => {
    if (!isDone(k)) toggle(stageId, docToTask[k]);
  };

  return (
    <div className="stage-content">
      <DocCard k="docs" doneFlag={isDone('docs')} icon="📄" title="Трудовой договор и NDA" sub="Открой и пролистай до конца" action="ЧИТАТЬ →" onOpen={setOpen} />
      <DocCard k="lead" doneFlag={isDone('lead')} icon={<span className="font-orbitron" style={{fontSize:11,fontWeight:800}}>ЕП</span>} title="Елена Петрова — руководитель" sub="Профиль · пролистай до конца" action="ОТКРЫТЬ →" onOpen={setOpen} />
      <DocCard k="mplus" doneFlag={isDone('mplus')} icon="M+" title="mPLuse · корп. мессенджер" sub="Инструкция · пролистай до конца" action="ИНСТРУКЦИЯ →" onOpen={setOpen} />

      <div className="doc-hint font-orbitron">Открой каждый документ и пролистай до конца — иначе не подтвердится. Следующий этап откроется только после всех трёх.</div>

      <DocumentModal kind="docs" open={open==='docs'} onClose={()=>setOpen(null)} alreadyDone={isDone('docs')} onConfirm={()=>handleConfirm('docs')} />
      <DocumentModal kind="lead" open={open==='lead'} onClose={()=>setOpen(null)} alreadyDone={isDone('lead')} onConfirm={()=>handleConfirm('lead')} />
      <DocumentModal kind="mplus" open={open==='mplus'} onClose={()=>setOpen(null)} alreadyDone={isDone('mplus')} onConfirm={()=>{ handleConfirm('mplus'); downloadStub(); }} />

      <style>{`
        .stage-content{ display:flex; flex-direction:column; gap:9px; margin-bottom:6px }
        .doc-card{
          display:flex; align-items:center; gap:12px;
          padding:11px 13px; width:100%; text-align:left;
          background:rgba(255,255,255,.02); border:1px solid var(--border); border-radius:11px; cursor:pointer;
          transition:background .15s, border-color .15s, transform .12s;
        }
        .doc-card:hover{ background:rgba(244,114,182,.06); border-color:rgba(244,114,182,.28); transform:translateY(-1px) }
        .doc-card.done{ background:rgba(192,132,252,.06); border-color:rgba(192,132,252,.24) }
        .dc-icon, .dc-avatar{ width:36px; height:36px; border-radius:9px; background:rgba(244,114,182,.08); border:1px solid rgba(244,114,182,.25); display:grid; place-items:center; font-size:15px; flex-shrink:0 }
        .dc-icon.mplus{ background:linear-gradient(135deg,#8B5CF6,#8b5cf6); color:#fff; font-family:'Orbitron',sans-serif; font-size:12px; font-weight:700; border:none }
        .dc-icon.dc-done{ background:rgba(192,132,252,.18); border-color:rgba(192,132,252,.35); color:#c084fc }
        .dc-body{ flex:1; min-width:0 }
        .dc-title{ font-size:12.5px; color:var(--text); font-weight:500; display:flex; align-items:center; gap:8px; flex-wrap:wrap }
        .dc-badge{ font-size:9px; letter-spacing:.14em; padding:2px 6px; border-radius:999px; background:rgba(192,132,252,.14); border:1px solid rgba(192,132,252,.3); color:#c084fc; font-family:'Orbitron',sans-serif; text-transform:uppercase }
        .dc-sub{ font-size:10.5px; color:var(--muted); margin-top:2px }
        .dc-link{ font-family:'Orbitron',sans-serif; font-size:9.5px; letter-spacing:.14em; padding:7px 10px; border-radius:8px; border:1px solid rgba(249,168,212,.35); color:var(--cyan-l); flex-shrink:0 }
        .dc-link.is-done{ border-color:rgba(192,132,252,.35); color:#c084fc; background:rgba(192,132,252,.08) }
        .doc-hint{ font-size:10px; letter-spacing:.12em; text-transform:uppercase; color:var(--dim); text-align:center; padding:8px 10px; border:1px dashed rgba(255,255,255,.08); border-radius:8px; margin-top:2px }
      `}</style>
    </div>
  );
}

function downloadStub() {
  const blob = new Blob(['mPLuse installer (mock)\n\nЭто мок-файл. В реальной сборке здесь будет бинарь.\n'], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'mPlus-installer.txt';
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 100);
}
