import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { usePageMeta } from '../hooks/usePageMeta';

export function PublicIntroPage() {
  usePageMeta('MDIGITAL — Старт карьеры', 'Знакомство с компанией и подача заявки на онбординг.');
  const nav = useNavigate();
  const [searchParams] = useSearchParams();

  // Intro content state
  const [content, setContent] = useState<any>(null);
  const [contentLoading, setContentLoading] = useState(true);

  // Application state
  const [step, setStep] = useState<'form' | 'verify' | 'success'>('form');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState(() => {
    const saved = localStorage.getItem('onboarding_draft');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return {
      name: '', email: searchParams.get('email') || '', phone: '', 
      department: '', position: '', planned_date: '', lead_name: '', consent_given: false,
    };
  });

  const [code, setCode] = useState('');
  const [ticketNumber, setTicketNumber] = useState<string | null>(null);

  useEffect(() => {
    api.get('/api/public/intro')
      .then(setContent)
      .catch(() => {
        setContent({
          title: 'Добро пожаловать в MDIGITAL',
          mission: 'Мы создаём цифровое будущее, разрабатывая инновационные финтех-решения. Наша миссия — упрощать жизнь миллионов людей с помощью технологий.',
          values: ['Скорость', 'Инновации', 'Ответственность', 'Команда'],
          instruction: 'Заполни заявку ниже. Решение HR занимает до 2 рабочих дней. Данные для входа в корпоративную сеть придут на указанную личную почту.',
        });
      })
      .finally(() => setContentLoading(false));
  }, []);

  useEffect(() => {
    if (step === 'form') {
      localStorage.setItem('onboarding_draft', JSON.stringify(formData));
    }
  }, [formData, step]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev: any) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const onSubmitForm = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formData.consent_given) {
      setError('Необходимо согласие на обработку персональных данных');
      return;
    }
    setLoading(true);
    try {
      await api.post('/api/applications', formData);
      setStep('verify');
    } catch (err: any) {
      const msg = err.message || 'Ошибка отправки заявки';
      if (msg.includes('Активная заявка уже существует')) {
        setError('duplicate');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const onSubmitVerify = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.post<{ ticket_number: string }>('/api/applications/verify-email', {
        email: formData.email, code,
      });
      setTicketNumber(res.ticket_number);
      localStorage.removeItem('onboarding_draft');
      setStep('success');
    } catch (err: any) {
      setError(err.message || 'Неверный код');
    } finally {
      setLoading(false);
    }
  };

  const scrollToForm = () => {
    document.getElementById('apply-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  if (contentLoading) {
    return <div className="landing-wrap centered text-muted">Загрузка...</div>;
  }

  return (
    <div className="landing-wrap">
      {/* Header */}
      <header className="landing-header">
        <div className="logo-row">
          <div className="logo-mark sm">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2l3 4-3 4-3-4 3-4z" />
              <path d="M4 7l4 3v7l-4-3V7z" />
              <path d="M20 7l-4 3v7l4-3V7z" />
              <path d="M8 17l4 3 4-3" />
            </svg>
          </div>
          <span className="logo-text font-orbitron">MDIGITAL</span>
        </div>
        <button className="btn-ghost sm" onClick={() => nav('/status')}>Проверить статус</button>
      </header>

      <main className="landing-main">
        {/* Hero Section */}
        <section className="hero-section">
          <div className="hero-badge animate-in">Онбординг V2</div>
          <h1 className="hero-title animate-in" style={{ animationDelay: '0.1s' }}>
            {content?.title}
          </h1>
          <p className="hero-mission animate-in" style={{ animationDelay: '0.2s' }}>
            {content?.mission}
          </p>
          <div className="hero-actions animate-in" style={{ animationDelay: '0.3s' }}>
            <button className="btn-primary" onClick={scrollToForm}>Подать заявку →</button>
          </div>
        </section>

        {/* Values Section */}
        <section className="values-section animate-in" style={{ animationDelay: '0.4s' }}>
          <h2 className="section-title">Наши ценности</h2>
          <div className="values-grid">
            {content?.values?.map((v: string, i: number) => (
              <div key={i} className="value-card glass">
                <div className="value-icon">✦</div>
                <div className="value-text">{v}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Instruction Section */}
        <section className="instruction-section glass animate-in" style={{ animationDelay: '0.5s' }}>
          <h2 className="section-title" style={{ marginBottom: '12px' }}>Как пройдёт первый день?</h2>
          <p className="instruction-text">{content?.instruction}</p>
        </section>

        {/* Application Form Section */}
        <section id="apply-form" className="form-section">
          <div className="form-container glass-strong">
            {step === 'form' && (
              <>
                <div className="form-header">
                  <h2>Заявка кандидата</h2>
                  <p>Заполни форму для получения доступов к корпоративной сети.</p>
                </div>

                {error === 'duplicate' ? (
                  <div className="duplicate-alert animate-in">
                    <h3>У вас уже есть активная заявка</h3>
                    <p>Заявка с почтой <b>{formData.email}</b> уже зарегистрирована в системе.</p>
                    <button className="btn-primary" onClick={() => nav(`/status?email=${encodeURIComponent(formData.email)}`)}>
                      Узнать статус заявки
                    </button>
                  </div>
                ) : (
                  <form onSubmit={onSubmitForm} className="apply-form animate-in">
                    {error && <div className="error">{error}</div>}
                    
                    <div className="form-grid">
                      <label className="field">
                        <span>ФИО</span>
                        <input type="text" name="name" value={formData.name} onChange={handleInputChange} placeholder="Иванов Иван" required />
                      </label>
                      <label className="field">
                        <span>Личная почта</span>
                        <input type="email" name="email" value={formData.email} onChange={handleInputChange} placeholder="you@mdigital.kg" required />
                      </label>
                      <label className="field">
                        <span>Телефон</span>
                        <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} placeholder="+996 555 123 456" required />
                      </label>
                      <label className="field">
                        <span>Дата выхода</span>
                        <input type="date" name="planned_date" value={formData.planned_date} onChange={handleInputChange} required />
                      </label>
                      <label className="field">
                        <span>Департамент</span>
                        <select name="department" value={formData.department} onChange={handleInputChange} required>
                          <option value="" disabled>Выбрать...</option>
                          <option value="Frontend">Frontend</option>
                          <option value="Backend">Backend</option>
                          <option value="Design">Design</option>
                        </select>
                      </label>
                      <label className="field">
                        <span>Должность</span>
                        <input type="text" name="position" value={formData.position} onChange={handleInputChange} placeholder="Middle React Dev" required />
                      </label>
                      <label className="field" style={{ gridColumn: '1 / -1' }}>
                        <span>Имя руководителя</span>
                        <input type="text" name="lead_name" value={formData.lead_name} onChange={handleInputChange} placeholder="ФИО Лида" required />
                      </label>
                    </div>

                    <label className="checkbox-field">
                      <input type="checkbox" name="consent_given" checked={formData.consent_given} onChange={handleInputChange} />
                      <div className="checkbox-text">Я даю согласие на обработку моих персональных данных в соответствии с политикой конфиденциальности.</div>
                    </label>

                    <button type="submit" className="btn-primary w-full" disabled={loading}>
                      {loading ? 'Отправка...' : 'Продолжить →'}
                    </button>
                  </form>
                )}
              </>
            )}

            {step === 'verify' && (
              <div className="verify-block animate-in">
                <div className="verify-icon">✉️</div>
                <h2>Подтверди почту</h2>
                <p>Мы отправили 6-значный код на <b>{formData.email}</b>. Он действителен 15 минут.</p>
                <form onSubmit={onSubmitVerify}>
                  {error && <div className="error">{error}</div>}
                  <input 
                    className="code-input"
                    type="text" 
                    maxLength={6} 
                    value={code} 
                    onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))} 
                    placeholder="123456" 
                    autoFocus
                    required 
                  />
                  <div className="verify-actions">
                    <button type="button" className="btn-ghost" onClick={() => setStep('form')} disabled={loading}>Назад</button>
                    <button type="submit" className="btn-primary" disabled={loading || code.length < 6}>
                      {loading ? 'Проверка...' : 'Подтвердить'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {step === 'success' && ticketNumber && (
              <div className="success-block animate-in">
                <div className="success-icon">✓</div>
                <h2>Заявка успешно отправлена!</h2>
                <p>Твой номер заявки (тикет Service Desk):</p>
                <div className="ticket-box">{ticketNumber}</div>
                <p className="success-hint">
                  Мы отправили этот номер на <b>{formData.email}</b>. Используй его для проверки статуса. Ожидай письма с решением HR.
                </p>
                <button className="btn-primary w-full" onClick={() => nav(`/status?email=${encodeURIComponent(formData.email)}`)}>
                  Перейти к трекеру статуса
                </button>
              </div>
            )}
          </div>
        </section>
      </main>

      <style>{`
        .landing-wrap {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }
        .landing-header {
          display: flex; justify-content: space-between; align-items: center;
          padding: 20px 32px;
          border-bottom: 1px solid var(--border);
          background: var(--background);
        }
        .logo-row { display: flex; align-items: center; gap: 12px; }
        .logo-mark.sm { width: 32px; height: 32px; border-radius: 8px; }
        .logo-text { font-size: 16px; font-weight: bold; color: var(--foreground); }
        
        .landing-main {
          flex: 1;
          max-width: 900px;
          margin: 0 auto;
          padding: 60px 24px;
          width: 100%;
        }

        .hero-section { text-align: center; margin-bottom: 64px; }
        .hero-badge {
          display: inline-block; padding: 4px 12px; border-radius: 999px;
          font-size: 12px; font-weight: 600; color: var(--primary);
          background: var(--accent); border: 1px solid var(--border);
          margin-bottom: 24px;
        }
        .hero-title {
          font-size: 42px; font-weight: 800; line-height: 1.1;
          color: var(--foreground); margin-bottom: 24px;
          letter-spacing: -0.03em;
        }
        .hero-mission {
          font-size: 18px; color: var(--muted-foreground);
          max-width: 600px; margin: 0 auto 32px; line-height: 1.6;
        }

        .section-title {
          font-size: 20px; font-weight: 600; color: var(--foreground);
          margin-bottom: 24px; letter-spacing: -0.02em;
        }

        .values-grid {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px; margin-bottom: 64px;
        }
        .value-card {
          padding: 20px; display: flex; align-items: center; gap: 12px;
          background: rgba(255,255,255,0.02);
        }
        .value-icon { color: var(--primary); font-size: 18px; }
        .value-text { font-weight: 500; font-size: 15px; }

        .instruction-section {
          padding: 32px; border-radius: var(--radius);
          background: rgba(255,255,255,0.02);
          margin-bottom: 64px;
        }
        .instruction-text {
          font-size: 15px; color: var(--muted-foreground); line-height: 1.6;
        }

        .form-section { margin-bottom: 64px; }
        .form-container {
          padding: 40px; border-radius: var(--radius);
          background: var(--card); border: 1px solid var(--border);
        }
        .form-header { margin-bottom: 32px; text-align: center; }
        .form-header h2 { font-size: 24px; font-weight: 700; margin-bottom: 8px; }
        .form-header p { color: var(--muted-foreground); font-size: 14px; }

        .form-grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: 20px;
        }
        @media (max-width: 640px) { .form-grid { grid-template-columns: 1fr; } }
        
        .checkbox-field {
          display: flex; align-items: flex-start; gap: 12px; margin: 24px 0;
          cursor: pointer;
        }
        .checkbox-field input { width: 18px; height: 18px; margin-top: 2px; accent-color: var(--primary); }
        .checkbox-text { font-size: 13px; color: var(--muted-foreground); line-height: 1.5; }

        .w-full { width: 100%; padding: 14px; font-size: 15px; }

        .duplicate-alert {
          text-align: center; padding: 32px; background: rgba(37,99,235,0.05);
          border: 1px solid rgba(37,99,235,0.2); border-radius: var(--radius);
        }
        .duplicate-alert h3 { color: var(--foreground); margin-bottom: 8px; font-size: 18px; }
        .duplicate-alert p { color: var(--muted-foreground); font-size: 14px; margin-bottom: 24px; }

        /* Verify Block */
        .verify-block, .success-block { text-align: center; max-width: 400px; margin: 0 auto; }
        .verify-icon, .success-icon {
          width: 56px; height: 56px; border-radius: 50%;
          display: grid; place-items: center; font-size: 24px;
          margin: 0 auto 20px;
        }
        .verify-icon { background: var(--accent); color: var(--primary); }
        .success-icon { background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2); }
        
        .verify-block h2, .success-block h2 { font-size: 22px; margin-bottom: 8px; }
        .verify-block p, .success-block p { color: var(--muted-foreground); font-size: 14px; line-height: 1.5; margin-bottom: 24px; }
        
        .code-input {
          width: 100%; padding: 16px; font-size: 24px; letter-spacing: 0.2em;
          text-align: center; background: var(--background);
          border: 1px solid var(--border); border-radius: var(--radius);
          margin-bottom: 24px; color: var(--foreground); outline: none;
        }
        .code-input:focus { border-color: var(--primary); }
        .verify-actions { display: flex; gap: 12px; }
        .verify-actions button { flex: 1; padding: 14px; }

        .ticket-box {
          font-family: ui-monospace, SFMono-Regular, monospace;
          font-size: 24px; font-weight: bold; letter-spacing: 0.1em;
          padding: 16px; background: rgba(255,255,255,0.03);
          border: 1px dashed var(--border); border-radius: var(--radius);
          color: var(--foreground); margin-bottom: 24px;
        }
        .success-hint { margin-bottom: 32px !important; }

        .centered { display: grid; place-items: center; }
      `}</style>
    </div>
  );
}
