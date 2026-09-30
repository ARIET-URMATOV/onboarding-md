import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { usePageMeta } from '../hooks/usePageMeta';

export function PublicIntroPage() {
  usePageMeta('Добро пожаловать в MDIGITAL', 'Знакомство с компанией, миссией и ценностями.');
  const nav = useNavigate();
  const [content, setContent] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Attempt to fetch dynamic intro content from backend if it exists
    api.get('/api/public/intro')
      .then((res) => setContent(res))
      .catch(() => {
        // Fallback content if backend is not yet ready or failed
        setContent({
          title: 'Добро пожаловать в MDIGITAL',
          mission: 'Мы создаём цифровое будущее, разрабатывая инновационные финтех-решения, такие как MBusiness и MPulse.',
          values: ['Скорость', 'Инновации', 'Ответственность', 'Команда'],
          instruction: 'Заполни заявку, чтобы получить доступ к корпоративной сети и начать онбординг. Решение HR занимает до 2 рабочих дней. Данные для входа придут на указанную личную почту.',
        });
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="auth-wrap">
      <div className="auth-card glass-strong" style={{ maxWidth: 600 }}>
        <div className="auth-head">
          <div className="logo-mark">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2l3 4-3 4-3-4 3-4z" />
              <path d="M4 7l4 3v7l-4-3V7z" />
              <path d="M20 7l-4 3v7l4-3V7z" />
              <path d="M8 17l4 3 4-3" />
            </svg>
          </div>
          <h1 className="font-orbitron">ЗНАКОМСТВО С КОМПАНИЕЙ</h1>
          <p>Этап 1: До получения доступа</p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '20px 0' }}>Загрузка...</div>
        ) : (
          <div className="intro-content">
            <h2>{content?.title}</h2>
            <p className="highlight-box">{content?.mission}</p>
            
            <h3>Наши ценности</h3>
            <ul className="values-list">
              {content?.values?.map((v: string, i: number) => (
                <li key={i}><span className="icon">✓</span> {v}</li>
              ))}
            </ul>

            <div className="divider" />

            <h3>Как проходит первый день?</h3>
            <p className="instruction-box">{content?.instruction}</p>

            <div style={{ marginTop: 24, display: 'flex', gap: 12, flexDirection: 'column' }}>
              <button className="btn-primary" onClick={() => nav('/apply')}>
                ПОДАТЬ ЗАЯВКУ →
              </button>
              <button className="btn-demo" onClick={() => nav('/status')}>
                УЗНАТЬ СТАТУС ЗАЯВКИ
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .auth-wrap { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
        .auth-card { width: 100%; padding: 38px 32px; border-radius: 18px; }
        .auth-head { text-align: center; margin-bottom: 28px; }
        .logo-mark {
          width: 54px; height: 54px; border-radius: 14px;
          background: linear-gradient(135deg, #3B82F6, #2563EB);
          display: grid; place-items: center; margin: 0 auto 16px;
          box-shadow: 0 0 32px rgba(59, 130, 246, .55);
        }
        .logo-mark svg { width: 26px; height: 26px; stroke: #02060d; }
        .auth-head h1 { font-size: 16px; letter-spacing: .15em; color: #fff; margin-bottom: 8px; }
        .auth-head p { font-size: 13px; color: var(--muted); }

        .intro-content h2 { font-size: 18px; color: #fff; margin-bottom: 12px; }
        .intro-content h3 { font-size: 14px; color: var(--cyan-l); margin: 20px 0 10px; text-transform: uppercase; letter-spacing: .1em; }
        
        .highlight-box {
          background: rgba(59, 130, 246, 0.1);
          border-left: 3px solid #3B82F6;
          padding: 12px 16px;
          color: #E5E7EB;
          font-size: 14px;
          line-height: 1.5;
          border-radius: 4px;
        }

        .values-list { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .values-list li { display: flex; align-items: center; font-size: 14px; color: #E5E7EB; }
        .values-list .icon { color: #3B82F6; margin-right: 8px; font-weight: bold; }

        .divider { height: 1px; background: rgba(255, 255, 255, 0.1); margin: 24px 0; }

        .instruction-box {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
          padding: 14px;
          border-radius: 8px;
          font-size: 13px;
          color: #9CA3AF;
          line-height: 1.5;
        }

        .btn-primary { width: 100%; padding: 14px; text-align: center; }
        .btn-demo {
          width: 100%; padding: 13px 16px; background: transparent;
          border: 1px solid var(--cyan-l); border-radius: 12px;
          color: var(--cyan-l); font-size: 12px; font-weight: 700;
          letter-spacing: .14em; cursor: pointer; transition: all .18s ease;
          font-family: 'Orbitron', sans-serif;
        }
        .btn-demo:hover { background: rgba(0, 242, 254, .08); box-shadow: 0 0 20px rgba(0, 242, 254, .2); }
      `}</style>
    </div>
  );
}
