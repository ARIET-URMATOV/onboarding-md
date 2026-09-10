import { useState } from 'react';
import type { StageId } from '../../data/stages';
import { useOnboarding } from '../../store/useOnboarding';

interface Props { stageId: StageId }

type TabId = 'A' | 'B' | 'C' | 'D' | 'E';

interface Item { label: string; taskId?: string; hint?: string }

const GROUPS: { id: TabId; title: string; short: string; items: Item[] }[] = [
  {
    id: 'A', title: 'Административные задачи', short: 'Админ',
    items: [
      { label: 'Получил учетные данные (почта, Confluence, Jira, Git)', taskId: '4-mail', hint: 'почта + crm.mdigital.kg + confluence.mdigital.kg' },
      { label: 'Подписал NDA и необходимые документы', hint: 'этап 1 · Трудовой договор и NDA' },
      { label: 'Настроил рабочее место (ноутбук, VPN, ПО)', taskId: '4-workspace', hint: 'ноутбук, VPN, софт' },
      { label: 'Ознакомился с графиком работы и политикой отпусков', hint: 'гибкий 40ч/нед · заявка за 2 недели' },
    ],
  },
  {
    id: 'B', title: 'Инструменты', short: 'Tools',
    items: [
      { label: 'Получил доступ в Jira и понимает workflow задач', taskId: '4-repo', hint: 'crm.mdigital.kg · To Do → Done' },
      { label: 'Получил доступ в Confluence, понимает, где искать документацию', taskId: '4-figma', hint: 'confluence.mdigital.kg · MDIG-FE' },
      { label: 'Получил доступ к репозиториям', taskId: '4-repo', hint: 'github.com/mdigital · PR' },
    ],
  },
  {
    id: 'C', title: 'Знания о компании', short: 'Компания',
    items: [
      { label: 'Ознакомился со структурой компании', hint: 'Продукт → Frontend/Backend/Design/QA → Операции' },
      { label: 'Изучил бизнес-процессы в Confluence', hint: 'confluence.mdigital.kg · Handbook' },
      { label: 'Понимает роль своей команды и взаимодействие с другими отделами', hint: 'канал #frontend, дейли 10:30' },
    ],
  },
  {
    id: 'D', title: 'Техническая подготовка', short: 'Тех',
    items: [
      { label: 'Ознакомился с code style и гидами по разработке', taskId: '4-style', hint: 'style.mdigital.io · ESLint' },
      { label: 'Настроил окружение для разработки', taskId: '4-workspace', hint: 'Node 22 · pnpm · dev' },
      { label: 'Выполнил тестовую задачу', taskId: '4-repo', hint: 'первый PR · review' },
    ],
  },
  {
    id: 'E', title: 'Взаимодействие', short: 'Команда',
    items: [
      { label: 'Познакомился с командой', hint: '#frontend · представься' },
      { label: 'Понимает порядок постановки задач и коммуникации', taskId: '4-messenger', hint: 'MPulse' },
      { label: 'Знает, к кому обращаться при технических или организационных вопросах', hint: 'Lead Елена Петрова · @elena.petrova' },
    ],
  },
];

export function Stage4Checklist({ stageId }: Props) {
  const done = useOnboarding((s) => s.doneTasks[stageId] || []);
  const toggle = useOnboarding((s) => s.toggleTask);
  const [active, setActive] = useState<TabId>('A');

  const group = GROUPS.find((g) => g.id === active)!;

  return (
    <div className="checklist">
      <div className="cl-tabs">
        {GROUPS.map((g) => (
          <button
            key={g.id}
            type="button"
            className={`cl-tab ${active === g.id ? 'is-active' : ''}`}
            onClick={() => setActive(g.id)}
            aria-pressed={active === g.id}
          >
            <span className="cl-tab-id">{g.id}</span>
            <span className="cl-tab-short">{g.short}</span>
          </button>
        ))}
      </div>

      <div className="cl-head">
        <div className="cl-title">{group.title}</div>
        <div className="cl-sub">Отметь пункты — прогресс считается по 6 чек-точкам этапа (25 XP каждая)</div>
      </div>

      <div className="cl-list">
        {group.items.map((it) => {
          const canToggle = !!it.taskId;
          const isDone = canToggle ? done.includes(it.taskId!) : false;
          return (
            <button
              key={it.label}
              type="button"
              className={`cl-row ${isDone ? 'is-done' : ''} ${!canToggle ? 'is-info' : ''}`}
              onClick={() => { if (canToggle && it.taskId) toggle(stageId, it.taskId); }}
              disabled={!canToggle}
              title={canToggle ? (isDone ? 'Сняь отметку' : 'Отметить') : it.hint}
            >
              <span className={`cl-check ${isDone ? 'on' : ''}`}>{isDone ? '✓' : ''}</span>
              <span className="cl-body">
                <span className="cl-label">{it.label}</span>
                {it.hint && <span className="cl-hint">{it.hint}</span>}
              </span>
              {canToggle && <span className="cl-xp">25 XP</span>}
            </button>
          );
        })}
      </div>

      <style>{`
        .checklist{ margin-bottom:6px; font-family:'Open Sans',sans-serif }
        .cl-tabs{ display:flex; gap:6px; margin-bottom:10px; overflow:auto; padding-bottom:2px }
        .cl-tab{ display:flex; align-items:center; gap:6px; padding:8px 10px; border-radius:999px; border:1px solid var(--border); background:rgba(255,255,255,.02); color:var(--muted); font-size:12px; font-weight:700; white-space:nowrap; flex-shrink:0 }
        .cl-tab.is-active{ background:rgba(59,130,246,.14); border-color:rgba(59,130,246,.35); color:#DBEAFE }
        .cl-tab-id{ width:18px; height:18px; border-radius:50%; display:grid; place-items:center; background:rgba(59,130,246,.2); color:#60A5FA; font-size:10px }
        .cl-tab.is-active .cl-tab-id{ background:#2563EB; color:#fff }
        .cl-head{ margin-bottom:8px; padding:10px 12px; border:1px solid rgba(255,255,255,.06); border-radius:10px; background:rgba(255,255,255,.02) }
        .cl-title{ font-size:13px; font-weight:800; color:var(--text) }
        .cl-sub{ font-size:11px; color:var(--muted); margin-top:4px }
        .cl-list{ display:flex; flex-direction:column; gap:8px }
        .cl-row{ display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:10px; border:1px solid var(--border); background:rgba(255,255,255,.02); text-align:left; width:100% }
        .cl-row.is-info{ opacity:.85; cursor:default }
        .cl-row:not(.is-info):hover{ background:rgba(59,130,246,.06); border-color:rgba(59,130,246,.22) }
        .cl-row.is-done{ background:rgba(96,165,250,.06); border-color:rgba(96,165,250,.24) }
        .cl-check{ width:22px; height:22px; border-radius:6px; border:1px solid rgba(96,165,250,.35); display:grid; place-items:center; font-size:11px; color:#60A5FA; background:rgba(59,130,246,.08); flex-shrink:0 }
        .cl-check.on{ background:#2563EB; border-color:#2563EB; color:#fff }
        .cl-body{ flex:1; min-width:0 }
        .cl-label{ font-size:12.5px; color:var(--text); font-weight:600; line-height:1.3 }
        .cl-row.is-done .cl-label{ color:#93C5FD }
        .cl-hint{ display:block; font-size:11px; color:var(--muted); margin-top:2px }
        .cl-xp{ font-size:10px; letter-spacing:.08em; color:#60A5FA; border:1px solid rgba(96,165,250,.28); background:rgba(96,165,250,.08); padding:2px 6px; border-radius:999px; flex-shrink:0 }
        @media(min-width:861px){ .cl-tabs{gap:8px} .cl-tab{padding:8px 12px} }
      `}</style>
    </div>
  );
}
