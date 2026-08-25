import { useState } from 'react';
import type { StageId } from '../../data/stages';
import { useOnboarding } from '../../store/useOnboarding';
import { DocumentModal } from './DocumentModal';

interface Props { stageId: StageId }

type DocKey = 'docs' | 'lead' | 'mplus' | 'jira' | 'confluence';
const docToTask: Record<DocKey, string> = { docs: '1-docs', lead: '1-lead', mplus: '1-mplus', jira: '1-jira', confluence: '1-confluence' };

function DocCard({ k, doneFlag, icon, title, sub, action, onOpen }: { k: DocKey; doneFlag: boolean; icon: React.ReactNode; title: string; sub: string; action: string; onOpen: (k: DocKey)=>void }) {
  return (
    <button type="button" className={`doc-card ${doneFlag ? 'done' : ''}`} onClick={() => onOpen(k)} aria-label={`${title} — ${doneFlag ? 'прочитано, открыть повторно' : action.replace('→','').trim()}`}>
      <div className={`dc-icon ${k === 'mplus' ? 'mplus' : ''} ${doneFlag ? 'dc-done' : ''}`}>{doneFlag ? '✓' : icon}</div>
      <div className="dc-body">
        <div className="dc-title">{title} {doneFlag && <span className="dc-badge">прочитано</span>}</div>
        <div className="dc-sub">{sub}</div>
      </div>
      <span className={`dc-chevron ${doneFlag ? 'is-done' : ''}`} aria-hidden>
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3l5 5-5 5"/></svg>
      </span>
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
      <DocCard k="jira" doneFlag={isDone('jira')} icon={<span className="font-orbitron" style={{fontSize:10,fontWeight:800}}>JR</span>} title="Jira · таск-трекер" sub="Доска задач · пролистай до конца" action="ОТКРЫТЬ →" onOpen={setOpen} />
      <DocCard k="confluence" doneFlag={isDone('confluence')} icon={<span className="font-orbitron" style={{fontSize:10,fontWeight:800}}>CF</span>} title="Confluence · база знаний" sub="Пространства · пролистай до конца" action="ОТКРЫТЬ →" onOpen={setOpen} />

      <div className="doc-hint font-orbitron">Открой каждый документ и пролистай до конца — иначе не подтвердится.</div>

      <DocumentModal kind="docs" open={open==='docs'} onClose={()=>setOpen(null)} alreadyDone={isDone('docs')} onConfirm={()=>handleConfirm('docs')} />
      <DocumentModal kind="lead" open={open==='lead'} onClose={()=>setOpen(null)} alreadyDone={isDone('lead')} onConfirm={()=>handleConfirm('lead')} />
      <DocumentModal kind="mplus" open={open==='mplus'} onClose={()=>setOpen(null)} alreadyDone={isDone('mplus')} onConfirm={()=>{ handleConfirm('mplus'); downloadStub(); }} />
      <DocumentModal kind="jira" open={open==='jira'} onClose={()=>setOpen(null)} alreadyDone={isDone('jira')} onConfirm={()=>handleConfirm('jira')} />
      <DocumentModal kind="confluence" open={open==='confluence'} onClose={()=>setOpen(null)} alreadyDone={isDone('confluence')} onConfirm={()=>handleConfirm('confluence')} />

      <style>{`
        .stage-content{ display:flex; flex-direction:column; gap:9px; margin-bottom:6px; font-family:'Open Sans',sans-serif }
        .stage-content .font-orbitron{ font-family:'Open Sans',sans-serif !important }
        .doc-card{
          display:flex; align-items:center; gap:12px;
          padding:11px 13px; width:100%; text-align:left;
          background:rgba(255,255,255,.02); border:1px solid var(--border); border-radius:11px; cursor:pointer;
          transition:background .15s, border-color .15s, transform .12s;
        }
        .doc-card:hover{ background:rgba(59,130,246,.06); border-color:rgba(59,130,246,.28); transform:translateY(-1px) }
        .doc-card.done{ background:rgba(96,165,250,.06); border-color:rgba(96,165,250,.24) }
        .dc-icon, .dc-avatar{ width:36px; height:36px; border-radius:9px; background:rgba(59,130,246,.08); border:1px solid rgba(59,130,246,.25); display:grid; place-items:center; font-size:15px; flex-shrink:0 }
        .dc-icon.mplus{ background:linear-gradient(135deg,#2563EB,#2563EB); color:#fff; font-family:'Open Sans',sans-serif; font-size:12px; font-weight:700; border:none }
        .dc-icon.dc-done{ background:rgba(96,165,250,.18); border-color:rgba(96,165,250,.35); color:#60A5FA }
        .dc-body{ flex:1; min-width:0 }
        .dc-title{ font-family:'Open Sans',sans-serif; font-size:13.5px; color:var(--text); font-weight:700; display:flex; align-items:center; gap:8px; flex-wrap:wrap }
        .dc-badge{ font-size:9px; letter-spacing:.14em; padding:2px 6px; border-radius:999px; background:rgba(96,165,250,.14); border:1px solid rgba(96,165,250,.3); color:#60A5FA; font-family:'Open Sans',sans-serif; text-transform:uppercase }
        .dc-sub{ font-family:'Open Sans',sans-serif; font-size:11.5px; color:var(--muted); margin-top:2px }
        .dc-chevron{ width:18px; height:18px; display:grid; place-items:center; flex-shrink:0; color:rgba(96,165,250,.72); transition: transform .18s ease, color .18s ease, filter .18s ease, opacity .18s ease; }
        .dc-chevron svg{ width:14px; height:14px; }
        .doc-card:hover .dc-chevron{ color:#DBEAFE; transform:translateX(2px); filter:drop-shadow(0 0 6px rgba(37,99,235,.45)); }
        .doc-card.done .dc-chevron{ opacity:.42; }
        .doc-card.done:hover .dc-chevron{ opacity:.85; }
        .doc-hint{ font-family:'Open Sans',sans-serif; font-size:10px; letter-spacing:1px; text-transform:uppercase; color:var(--dim); text-align:center; padding:8px 10px; border:1px dashed rgba(255,255,255,.08); border-radius:8px; margin-top:2px }
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
