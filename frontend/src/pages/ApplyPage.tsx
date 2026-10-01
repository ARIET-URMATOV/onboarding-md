import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { usePageMeta } from '../hooks/usePageMeta';

export function ApplyPage() {
  usePageMeta('Заявка кандидата — MDIGITAL', 'Заполни заявку для получения доступа к порталу.');
  const nav = useNavigate();

  // Form State
  const [formData, setFormData] = useState<any>(() => {
    const saved = localStorage.getItem('onboarding_draft');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return {
      name: '', email: '', phone: '', department: '', position: '',
      planned_date: '', lead_name: '', consent_given: false,
    };
  });

  useEffect(() => {
    localStorage.setItem('onboarding_draft', JSON.stringify(formData));
  }, [formData]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Verification Step
  const [step, setStep] = useState<'form' | 'verify'>('form');
  const [code, setCode] = useState('');
  const [ticketNumber, setTicketNumber] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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
      // Create draft application, sends code to email
      await api.post('/api/applications', formData);
      setStep('verify');
    } catch (err: any) {
      setError(err.message || 'Ошибка отправки заявки');
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
        email: formData.email,
        code,
      });
      setTicketNumber(res.ticket_number);
      localStorage.removeItem('onboarding_draft');
    } catch (err: any) {
      setError(err.message || 'Неверный код или срок действия истёк');
    } finally {
      setLoading(false);
    }
  };

  if (ticketNumber) {
    return (
      <div className="auth-wrap">
        <div className="auth-card glass-strong" style={{ textAlign: 'center', maxWidth: 460 }}>
          <div className="logo-mark" style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}>
            <svg viewBox="0 0 24 24" fill="none" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
          <h1 className="font-orbitron" style={{ fontSize: 18, color: '#10B981', marginBottom: 12 }}>ЗАЯВКА ОТПРАВЛЕНА</h1>
          <p style={{ color: '#E5E7EB', fontSize: 14, marginBottom: 24 }}>
            Твой номер заявки (тикет Service Desk):
          </p>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: 8, fontSize: 24, fontWeight: 'bold', color: '#fff', letterSpacing: '2px', marginBottom: 24 }}>
            {ticketNumber}
          </div>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 32, lineHeight: 1.5 }}>
            Мы отправили этот номер на <b>{formData.email}</b>. Используй его для проверки статуса. Ожидай письма с решением HR.
          </p>
          <button className="btn-primary" onClick={() => nav('/status')} style={{ width: '100%' }}>
            ПРОВЕРИТЬ СТАТУС
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card glass-strong" style={{ maxWidth: 500 }}>
        <div className="auth-head" style={{ marginBottom: 20 }}>
          <h1 className="font-orbitron">ПОДАЧА ЗАЯВКИ</h1>
          <p>{step === 'form' ? 'Заполни данные о себе' : 'Подтверди почту'}</p>
        </div>

        {error && <div className="error" style={{ marginBottom: 16 }}>{error}</div>}

        {step === 'form' ? (
          <form onSubmit={onSubmitForm} className="apply-form">
            <label className="field">
              <span>ФИО</span>
              <input type="text" name="name" value={formData.name} onChange={handleInputChange} placeholder="Иванов Иван Иванович" required />
            </label>
            
            <label className="field">
              <span>Личная почта</span>
              <input type="email" name="email" value={formData.email} onChange={handleInputChange} placeholder="you@mdigital.kg" required />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label className="field">
                <span>Телефон</span>
                <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} placeholder="+996 555 123 456" required />
              </label>
              
              <label className="field">
                <span>Дата выхода</span>
                <input type="date" name="planned_date" value={formData.planned_date} onChange={handleInputChange} required />
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
            </div>

            <label className="field">
              <span>Имя руководителя</span>
              <input type="text" name="lead_name" value={formData.lead_name} onChange={handleInputChange} placeholder="ФИО Лида" required />
            </label>

            <label className="checkbox-field">
              <input type="checkbox" name="consent_given" checked={formData.consent_given} onChange={handleInputChange} />
              <span>Я согласен(на) на обработку персональных данных</span>
            </label>

            <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: 24, width: '100%' }}>
              {loading ? 'ОТПРАВКА...' : 'ДАЛЕЕ →'}
            </button>
            <button type="button" className="btn-link" onClick={() => nav('/intro')} style={{ width: '100%', marginTop: 12 }}>
              НАЗАД К ЗНАКОМСТВУ
            </button>
          </form>
        ) : (
          <form onSubmit={onSubmitVerify}>
            <p style={{ color: '#E5E7EB', fontSize: 13, marginBottom: 20, textAlign: 'center', lineHeight: 1.5 }}>
              Мы отправили 6-значный код на <b>{formData.email}</b>. Код действителен 15 минут.
            </p>
            <label className="field">
              <span style={{ textAlign: 'center' }}>КОД ИЗ ПИСЬМА</span>
              <input 
                type="text" 
                maxLength={6} 
                value={code} 
                onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))} 
                placeholder="123456" 
                style={{ textAlign: 'center', letterSpacing: '4px', fontSize: 20 }} 
                required 
              />
            </label>
            <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: 16, width: '100%' }}>
              {loading ? 'ПРОВЕРКА...' : 'ПОДТВЕРДИТЬ КОД'}
            </button>
            <button type="button" className="btn-link" onClick={() => setStep('form')} style={{ width: '100%', marginTop: 16 }}>
              НАЗАД К ФОРМЕ
            </button>
          </form>
        )}
      </div>

      <style>{`
        .auth-wrap { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
        .auth-card { width: 100%; padding: 38px 32px; border-radius: 18px; }
        .auth-head { text-align: center; }
        .auth-head h1 { font-size: 16px; letter-spacing: .15em; color: #fff; margin-bottom: 8px; }
        .auth-head p { font-size: 13px; color: var(--muted); }

        .field { display: block; margin-bottom: 16px; }
        .field span { display: block; font-size: 10px; letter-spacing: .2em; text-transform: uppercase; color: var(--muted); margin-bottom: 8px; }
        .field input, .field select {
          width: 100%; padding: 13px 16px;
          background: rgba(255,255,255,.04);
          border: 1px solid var(--border);
          border-radius: 10px; color: var(--text); font-size: 14px;
          outline: none; transition: border-color .15s ease, box-shadow .15s ease;
        }
        .field input:focus, .field select:focus { border-color: var(--cyan-l); box-shadow: 0 0 0 3px rgba(59,130,246,.15); }
        .field select option { background: #0A0F1E; }

        .checkbox-field {
          display: flex; align-items: flex-start; gap: 10px; margin-top: 20px;
          cursor: pointer;
        }
        .checkbox-field span { font-size: 12px; color: #9CA3AF; line-height: 1.4; }

        .error {
          padding: 10px 14px; border: 1px solid rgba(248,113,113,.4);
          background: rgba(248,113,113,.08); color: #FCA5A5; font-size: 12.5px; border-radius: 10px; text-align: center;
        }
        .btn-primary { width: 100%; padding: 14px; font-weight: 600; cursor: pointer; }
        
        .btn-link {
          background: none; border: none; color: var(--muted);
          font-size: 11px; letter-spacing: .1em; text-transform: uppercase;
          cursor: pointer; transition: color 0.2s;
        }
        .btn-link:hover { color: #fff; }
      `}</style>
    </div>
  );
}
