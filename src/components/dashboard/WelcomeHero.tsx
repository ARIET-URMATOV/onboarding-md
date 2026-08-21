import { Link } from 'react-router-dom';
import { ProgressBar } from './ProgressBar';

export function WelcomeHero() {
  return (
    <section className="hero">
      <div className="hero-inner">
        <div className="pill font-orbitron">FRONTEND DEVELOPER</div>
        <h1 className="hero-title font-orbitron gradient-text">
          Добро пожаловать<br />в <span>MDIGITAL</span>
        </h1>
        <p className="hero-sub">
          Начни свой путь в команде. Пройди все 5 этапов<br />
          онбординга и стань частью нашей команды.
        </p>
        <div className="hero-actions">
          <Link to="/roadmap" className="btn-primary">
            НАЧАТЬ ОНБОРДИНГ →
          </Link>
          <Link to="/roadmap" className="btn-ghost">
            КАРТА ЭТАПОВ
          </Link>
        </div>
        <ProgressBar />
      </div>

      <style>{`
        .hero{
          position:relative;
          padding:80px 24px 60px;
          overflow:hidden;
        }
        .hero::before{
          content:''; position:absolute; inset:0;
          background:
            radial-gradient(ellipse at 50% 30%, rgba(244,114,182,.18), transparent 55%),
            radial-gradient(ellipse at 80% 60%, rgba(139,92,246,.12), transparent 50%);
          pointer-events:none;
        }
        .hero-inner{
          position:relative;
          max-width:780px; margin:0 auto; text-align:center;
        }
        .pill{
          display:inline-block;
          padding:7px 18px; border-radius:999px;
          font-size:10px; letter-spacing:.3em; text-transform:uppercase;
          color:var(--cyan-l);
          border:1px solid rgba(249,168,212,.4);
          background:rgba(244,114,182,.08);
        }
        .hero-title{
          font-size:clamp(38px, 7vw, 72px);
          font-weight:900;
          line-height:1.05;
          letter-spacing:.02em;
          margin:24px 0 18px;
        }
        .hero-sub{
          font-size:15px; color:var(--muted); line-height:1.7;
          margin:0 auto 32px; max-width:520px;
        }
        .hero-actions{display:flex; justify-content:center; gap:14px; flex-wrap:wrap}
        @media (max-width: 600px){
          .hero{padding:48px 16px 40px}
        }
      `}</style>
    </section>
  );
}
