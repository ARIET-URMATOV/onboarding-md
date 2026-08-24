import type { StageId } from '../../data/stages';

interface Props { stageId: StageId }

const TEAM = [
  { name: 'Елена Петрова', role: 'Frontend Lead', initials: 'ЕП', color: '#3B82F6', bio: 'Тимлид. Любит чистый код и хороший кофе.' },
  { name: 'Артём Соколов', role: 'Senior Frontend', initials: 'АС', color: '#3B82F6', bio: 'Ментор по React. Знает всё про анимации.' },
  { name: 'Мария Иванова', role: 'Frontend Developer', initials: 'МИ', color: '#2563EB', bio: 'Специалист по дизайн-системам.' },
  { name: 'Дмитрий Кузнецов', role: 'Backend Developer', initials: 'ДК', color: '#60A5FA', bio: 'Поможет, если застрянешь с API.' },
];

export function Stage2Team({ }: Props) {
  return (
    <div className="team-grid">
      {TEAM.map((m) => (
        <div className="team-card" key={m.name}>
          <div className="tc-avatar font-orbitron" style={{ background: `linear-gradient(135deg, ${m.color}, var(--cyan))` }}>
            {m.initials}
          </div>
          <div className="tc-name">{m.name}</div>
          <div className="tc-role">{m.role}</div>
          <div className="tc-bio">{m.bio}</div>
        </div>
      ))}
      <style>{`
        .team-grid{
          display:grid; grid-template-columns:1fr; gap:9px;
          margin-bottom:6px;
        }
        .team-card{
          padding:12px;
          background:rgba(255,255,255,.02);
          border:1px solid var(--border);
          border-radius:11px;
          text-align:center;
        }
        .tc-avatar{
          width:42px; height:42px; border-radius:50%;
          margin:0 auto 8px;
          display:grid; place-items:center;
          color:#fff; font-weight:700; font-size:13px;
          box-shadow:0 0 14px rgba(37,99,235,.3);
          font-family:'Open Sans',sans-serif;
        }
        .tc-name{ font-family:'Open Sans',sans-serif; font-size:14px; color:#fff; font-weight:700 }
        .tc-role{ font-family:'Open Sans',sans-serif; font-size:11px; color:var(--cyan-l); margin-top:2px; letter-spacing:.08em; text-transform:uppercase }
        .tc-bio{ font-family:'Open Sans',sans-serif; font-size:11.5px; color:var(--muted); margin-top:6px; line-height:1.4 }
        @media (min-width:861px){
          .team-grid{ grid-template-columns:1fr 1fr; }
        }
      `}</style>
    </div>
  );
}
