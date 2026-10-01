import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { usePageMeta } from '../hooks/usePageMeta';

interface ApplicationStatus {
  status: string; // new, in_review, needs_info, approved, account_created, activated, rejected
  updated_at: string;
  comment?: string;
}

const STEPS = [
  { id: 'new', label: 'Заявка принята' },
  { id: 'in_review', label: 'На рассмотрении HR' },
  { id: 'approved', label: 'Одобрено' },
  { id: 'account_created', label: 'Доступы готовы' },
];

export function StatusPage() {
  usePageMeta('Статус заявки — MDIGITAL', 'Проверь статус своей заявки на онбординг.');
  const nav = useNavigate();
  const [searchParams] = useSearchParams();

  const [number, setNumber] = useState('');
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [statusData, setStatusData] = useState<ApplicationStatus | null>(null);
  const [replyText, setReplyText] = useState('');

  // Optional: Auto-fetch if both params provided in URL for quick links
  useEffect(() => {
    const qEmail = searchParams.get('email');
    const qNum = searchParams.get('number');
    if (qEmail && qNum) {
      setEmail(qEmail);
      setNumber(qNum);
      fetchStatus(qNum, qEmail);
    }
  }, [searchParams]);

  const fetchStatus = async (ticket: string, mail: string) => {
    setError(null);
    setLoading(true);
    setStatusData(null);
    try {
      const data = await api.post<ApplicationStatus>('/api/applications/status', { number: ticket, email: mail });
      setStatusData(data);
    } catch (err: any) {
      setError(err.message || 'Заявка не найдена');
    } finally {
      setLoading(false);
    }
  }

  const onCheckStatus = async (e: FormEvent) => {
    e.preventDefault();
    await fetchStatus(number, email);
  };

  const onReply = async () => {
    if (!replyText.trim()) return;
    setLoading(true);
    try {
      await api.post(`/api/applications/${number}/reply`, { reply: replyText, email });
      setReplyText('');
      await fetchStatus(number, email);
    } catch (err: any) {
      setError(err.message || 'Ошибка отправки');
    } finally {
      setLoading(false);
    }
  };

  const currentStepIndex = () => {
    if (!statusData) return 0;
    const s = statusData.status;
    if (s === 'activated') return 4;
    if (s === 'account_created') return 3;
    if (s === 'approved') return 2;
    if (s === 'in_review' || s === 'needs_info') return 1;
    return 0; // new
  };

  return (
    <div className="landing-wrap centered" style={{ padding: '24px' }}>
      <div className="auth-card glass-strong" style={{ maxWidth: 500, width: '100%' }}>
        <div className="auth-head">
          <div className="logo-mark sm" style={{ margin: '0 auto 24px' }}>
            <svg viewBox="0 0 24 24" fill="none" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
            </svg>
          </div>
          <h1>Статус заявки</h1>
          <p>Введи данные для отслеживания процесса</p>
        </div>

        {error && <div className="error animate-in">{error}</div>}

        {!statusData ? (
          <form onSubmit={onCheckStatus} className="animate-in">
            <label className="field">
              <span>Номер заявки (Тикет)</span>
              <input type="text" value={number} onChange={(e) => setNumber(e.target.value.trim())} placeholder="ONB-2026-0001" required />
            </label>
            <label className="field">
              <span>Личная почта</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value.trim())} placeholder="you@mdigital.kg" required />
            </label>
            <button type="submit" className="btn-primary w-full" disabled={loading} style={{ marginTop: '8px' }}>
              {loading ? 'Ищем...' : 'Проверить статус →'}
            </button>
            <button type="button" className="btn-ghost w-full" onClick={() => nav('/intro')} style={{ marginTop: '12px' }}>
              Назад
            </button>
          </form>
        ) : (
          <div className="status-view animate-in">
            <div className="ticket-badge">{number}</div>
            
            {statusData.status === 'rejected' ? (
              <div className="rejected-state">
                <div className="icon">✗</div>
                <h3>Заявка отклонена</h3>
                {statusData.comment && <p>{statusData.comment}</p>}
              </div>
            ) : (
              <div className="stepper">
                {STEPS.map((step, idx) => {
                  const active = currentStepIndex() === idx;
                  const done = currentStepIndex() > idx;
                  return (
                    <div key={step.id} className={`step-item ${active ? 'active' : ''} ${done ? 'done' : ''}`}>
                      <div className="step-circle">{done ? '✓' : (idx + 1)}</div>
                      <div className="step-label">{step.label}</div>
                      {idx < STEPS.length - 1 && <div className="step-line" />}
                    </div>
                  );
                })}
              </div>
            )}

            {statusData.comment && statusData.status !== 'rejected' && (
              <div className="status-comment">
                <div className="comment-label">Сообщение от HR:</div>
                <div className="comment-body">{statusData.comment}</div>
              </div>
            )}

            {statusData.status === 'needs_info' && (
              <div className="reply-section">
                <textarea 
                  className="field" 
                  placeholder="Напиши свой ответ здесь..." 
                  value={replyText} 
                  onChange={(e) => setReplyText(e.target.value)}
                  style={{ minHeight: '80px', marginBottom: '12px' }}
                />
                <button className="btn-primary w-full" onClick={onReply} disabled={loading || !replyText.trim()}>
                  Ответить
                </button>
              </div>
            )}

            <button className="btn-ghost w-full" onClick={() => setStatusData(null)} style={{ marginTop: '32px' }}>
              Проверить другую заявку
            </button>
          </div>
        )}
      </div>

      <style>{`
        .w-full { width: 100%; padding: 12px; }
        
        /* Stepper */
        .stepper { display: flex; flex-direction: column; gap: 0; margin: 32px 0; }
        .step-item { display: flex; gap: 16px; position: relative; padding-bottom: 32px; }
        .step-item:last-child { padding-bottom: 0; }
        
        .step-circle {
          width: 28px; height: 28px; border-radius: 50%;
          background: var(--background); border: 2px solid var(--border);
          display: grid; place-items: center; font-size: 12px; font-weight: bold;
          color: var(--muted-foreground); z-index: 2;
          transition: all 0.3s;
        }
        .step-line {
          position: absolute; top: 28px; left: 13px; width: 2px; height: calc(100% - 28px);
          background: var(--border); z-index: 1; transition: background 0.3s;
        }
        .step-label {
          padding-top: 4px; font-size: 15px; font-weight: 500;
          color: var(--muted-foreground); transition: color 0.3s;
        }

        .step-item.active .step-circle { border-color: var(--primary); color: var(--primary); box-shadow: 0 0 0 4px rgba(37,99,235,0.1); }
        .step-item.active .step-label { color: var(--foreground); font-weight: 600; }
        
        .step-item.done .step-circle { background: var(--primary); border-color: var(--primary); color: var(--primary-foreground); }
        .step-item.done .step-line { background: var(--primary); }
        .step-item.done .step-label { color: var(--foreground); }

        .ticket-badge {
          display: inline-block; padding: 6px 12px; border-radius: 6px;
          background: var(--accent); color: var(--primary);
          font-family: ui-monospace, monospace; font-size: 14px; font-weight: bold;
          margin-bottom: 24px; letter-spacing: 1px;
        }

        .status-comment {
          background: rgba(37,99,235,0.05); border-left: 3px solid var(--primary);
          padding: 16px; border-radius: 4px; margin-bottom: 24px;
        }
        .comment-label { font-size: 11px; color: var(--primary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; font-weight: bold; }
        .comment-body { font-size: 14px; color: var(--foreground); line-height: 1.5; }

        .rejected-state { text-align: center; padding: 24px 0; }
        .rejected-state .icon { width: 48px; height: 48px; border-radius: 50%; background: rgba(239,68,68,0.1); color: #ef4444; display: grid; place-items: center; font-size: 24px; margin: 0 auto 16px; }
        .rejected-state h3 { color: var(--foreground); margin-bottom: 8px; font-size: 18px; }
        .rejected-state p { color: var(--muted-foreground); font-size: 14px; }
      `}</style>
    </div>
  );
}
