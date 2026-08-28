import { TopBar } from '../components/layout/TopBar';
import { STAGES } from '../data/stages';
import { useOnboarding } from '../store/useOnboarding';
import { usePageMeta } from '../hooks/usePageMeta';

const RESOURCES = [
  { label: 'Notion · База знаний', icon: 'N', color: '#3B82F6' },
  { label: 'GitHub · Репозиторий', icon: 'G', color: '#2563EB' },
  { label: 'Figma · Дизайн-система', icon: 'F', color: '#3B82F6' },
  { label: 'Slack · Команда', icon: 'S', color: '#60A5FA' },
];

export function CompletePage() {
  usePageMeta("Достижения — MDIGITAL Онбординг", "Поздравляем! Ты прошёл все этапы онбординга MDIGITAL. Посмотри свои достижения.");
  const user = useOnboarding((s) => s.user);
  return (
    <>
      <TopBar />
      <main className="cp-wrap">
        <div className="cp-eyebrow font-orbitron">ПОЗДРАВЛЯЕМ</div>
        <h1 className="cp-title font-orbitron gradient-text">
          Онбординг<br />завершён!
        </h1>
        <p className="cp-sub">
          {user?.name?.split(' ')[0] || 'Друг'}, ты прошёл все 5 этапов. Добро пожаловать в команду MDIGITAL!
        </p>

        <div className="cp-stats">
          <div className="stat glass" style={{gridColumn:'1 / -1', maxWidth:'320px', margin:'0 auto'}}>
            <div className="stat-num font-orbitron">5/5</div>
            <div className="stat-lbl">этапов пройдено</div>
          </div>
        </div>

        <div className="cp-section">
          <h3 className="font-orbitron">ДОСТИЖЕНИЯ</h3>
          <div className="achv-grid">
            {STAGES.map((s) => (
              <div className="achv" key={s.id}>
                <div className="achv-icon">🏆</div>
                <div className="achv-name font-orbitron">{s.rewardName}</div>
                <div className="achv-stage">Этап 0{s.id} · {s.shortLabel}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="cp-section">
          <h3 className="font-orbitron">РЕСУРСЫ КОМАНДЫ</h3>
          <div className="res-grid">
            {RESOURCES.map((r) => (
              <a href="#" key={r.label} className="res" style={{ ['--c' as any]: r.color }}>
                <div className="res-icon font-orbitron">{r.icon}</div>
                <div className="res-label">{r.label}</div>
                <div className="res-arrow">→</div>
              </a>
            ))}
          </div>
        </div>

        <div className="cp-cta">
          <a href="/dashboard" className="btn-primary">НА ГЛАВНУЮ</a>
          <a href="/map" className="btn-ghost">ПРОСМОТРЕТЬ КАРТУ</a>
        </div>
      </main>

      <style>{`
        .cp-wrap{
          max-width:880px; margin:0 auto;
          padding:80px 24px 80px;
          text-align:center;
        }
        .cp-eyebrow{
          display:inline-block;
          font-size:11px; letter-spacing:.32em; color:var(--cyan-l);
          padding:7px 16px; border-radius:999px;
          border:1px solid rgba(147,197,253,.4);
          background:rgba(59,130,246,.08);
        }
        .cp-title{
        letter-spacing:-1px;
          font-size:clamp(40px, 7vw, 76px);
          font-weight:900; line-height:1.05;
          margin:24px 0 14px;
        }
        .cp-sub{ color:var(--muted); font-size:15px; max-width:520px; margin:0 auto 40px }

        .cp-stats{
          display:grid; grid-template-columns:repeat(3, 1fr);
          gap:14px; margin-bottom:48px;
        }
        .stat{
          padding:22px 18px;
          border-radius:14px;
        }
        .stat-num{ font-size:28px; font-weight:700; color:var(--cyan-l); text-shadow:0 0 14px rgba(59,130,246,.5) }
        .stat-lbl{ font-size:10.5px; letter-spacing:.18em; text-transform:uppercase; color:var(--muted); margin-top:6px }

        .cp-section{ margin-bottom:40px; text-align:left }
        .cp-section h3{ font-size:11px; letter-spacing:.26em; color:var(--cyan-l); text-align:center; margin-bottom:18px }

        .achv-grid{
          display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr));
          gap:12px;
        }
        .achv{
          padding:18px;
          background:linear-gradient(135deg, rgba(96,165,250,.1), rgba(59,130,246,.06));
          border:1px solid rgba(96,165,250,.3);
          border-radius:14px;
          text-align:center;
          animation:float-up .4s ease-out;
        }
        .achv-icon{ font-size:30px; margin-bottom:8px }
        .achv-name{ font-size:12px; color:var(--mint); letter-spacing:.04em }
        .achv-stage{ font-size:10px; color:var(--muted); margin-top:4px; letter-spacing:.08em }

        .res-grid{
          display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));
          gap:10px;
        }
        .res{
          display:flex; align-items:center; gap:12px;
          padding:14px 16px;
          background:rgba(8,16,28,.6);
          border:1px solid var(--border);
          border-radius:12px;
          transition:transform .15s ease, border-color .15s ease;
        }
        .res:hover{ transform:translateY(-2px); border-color:var(--c) }
        .res-icon{
          width:34px; height:34px; border-radius:9px;
          background:color-mix(in srgb, var(--c) 25%, transparent);
          color:var(--c);
          display:grid; place-items:center;
          font-weight:700;
        }
        .res-label{ flex:1; text-align:left; font-size:13px }
        .res-arrow{ color:var(--muted); font-size:16px; display:flex; align-items:center }

        .cp-cta{ display:flex; justify-content:center; gap:14px; margin-top:20px; flex-wrap:wrap }

        @media (max-width: 640px){
          .cp-stats{ grid-template-columns:1fr }
        }
      `}</style>
    </>
  );
}
