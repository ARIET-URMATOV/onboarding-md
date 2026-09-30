import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { usePageMeta } from '../hooks/usePageMeta';

interface ApplicationStatus {
  status: string; // new, in_review, needs_info, approved, account_created, activated, rejected
  updated_at: string;
  comment?: string;
}

export function StatusPage() {
  usePageMeta('Статус заявки — MDIGITAL', 'Проверь статус своей заявки на онбординг.');
  const nav = useNavigate();

  const [number, setNumber] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [statusData, setStatusData] = useState<ApplicationStatus | null>(null);
  const [replyText, setReplyText] = useState('');

  const onCheckStatus = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setStatusData(null);
    try {
      // Endpoint expects POST to not leak email in URL parameters
      const data = await api.post<ApplicationStatus>('/api/applications/status', { number, email });
      setStatusData(data);
    } catch (err: any) {
      setError(err.message || 'Заявка не найдена');
    } finally {
      setLoading(false);
    }
  };

  const onReply = async () => {
    if (!replyText.trim()) return;
    setLoading(true);
    try {
      await api.post(`/api/applications/${number}/reply`, { reply: replyText, email });
      setReplyText('');
      // refresh status
      const data = await api.post<ApplicationStatus>('/api/applications/status', { number, email });
      setStatusData(data);
    } catch (err: any) {
      setError(err.message || 'Ошибка отправки');
    } finally {
      setLoading(false);
    }
  };

  const getStatusDisplay = (status: string) => {
    switch(status) {
      case 'new': return { label: 'Новая заявка', color: '#60A5FA' };
      case 'in_review': return { label: 'На рассмотрении HR', color: '#FBBF24' };
      case 'needs_info': return { label: 'Требуется уточнение', color: '#F87171' };
      case 'approved': return { label: 'Одобрено. Ожидание учётки', color: '#34D399' };
      case 'account_created': return { label: 'Доступы готовы', color: '#10B981' };
      case 'activated': return { label: 'Активирована', color: '#059669' };
      case 'rejected': return { label: 'Отклонена', color: '#9CA3AF' };
      default: return { label: status, color: '#fff' };
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card glass-strong" style={{ maxWidth: 460 }}>
        <div className="auth-head">
          <h1 className="font-orbitron">СТАТУС ЗАЯВКИ</h1>
          <p>Введи данные для проверки</p>
        </div>

        {error && <div className="error" style={{ marginBottom: 16 }}>{error}</div>}

        {!statusData ? (
          <form onSubmit={onCheckStatus}>
            <label className="field">
              <span>Номер заявки (Тикет)</span>
              <input type="text" value={number} onChange={(e) => setNumber(e.target.value.trim())} placeholder="ONB-2026-0001" required />
            </label>
            <label className="field">
              <span>Личная почта</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value.trim())} placeholder="you@mdigital.kg" required />
            </label>
            <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: 12, width: '100%' }}>
              {loading ? 'ИЩЕМ...' : 'ПРОВЕРИТЬ →'}
            </button>
            <button type="button" className="btn-link" onClick={() => nav('/intro')} style={{ width: '100%', marginTop: 16 }}>
              НАЗАД
            </button>
          </form>
        ) : (
          <div className="status-view">
            <div className="status-header">
              <span className="ticket-badge">{number}</span>
            </div>
            
            <div className="status-indicator">
              <div className="status-dot" style={{ background: getStatusDisplay(statusData.status).color, boxShadow: `0 0 12px ${getStatusDisplay(statusData.status).color}` }} />
              <div className="status-text" style={{ color: getStatusDisplay(statusData.status).color }}>
                {getStatusDisplay(statusData.status).label}
              </div>
            </div>

            {statusData.comment && (
              <div className="status-comment">
                <div className="comment-label">Комментарий HR:</div>
                <div className="comment-body">{statusData.comment}</div>
              </div>
            )}

            {statusData.status === 'needs_info' && (
              <div className="reply-section">
                <textarea 
                  className="reply-box" 
                  placeholder="Твой ответ..." 
                  value={replyText} 
                  onChange={(e) => setReplyText(e.target.value)}
                />
                <button className="btn-primary" onClick={onReply} disabled={loading || !replyText.trim()}>
                  ОТВЕТИТЬ
                </button>
              </div>
            )}

            <div style={{ marginTop: 32, textAlign: 'center' }}>
               <button className="btn-link" onClick={() => setStatusData(null)}>← ПРОВЕРИТЬ ДРУГУЮ</button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .auth-wrap { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
        .auth-card { width: 100%; padding: 38px 32px; border-radius: 18px; }
        .auth-head { text-align: center; margin-bottom: 24px; }
        .auth-head h1 { font-size: 16px; letter-spacing: .15em; color: #fff; margin-bottom: 8px; }
        .auth-head p { font-size: 13px; color: var(--muted); }

        .field { display: block; margin-bottom: 16px; }
        .field span { display: block; font-size: 10px; letter-spacing: .2em; text-transform: uppercase; color: var(--muted); margin-bottom: 8px; }
        .field input {
          width: 100%; padding: 13px 16px;
          background: rgba(255,255,255,.04); border: 1px solid var(--border);
          border-radius: 10px; color: var(--text); font-size: 14px;
          outline: none; transition: border-color .15s ease, box-shadow .15s ease;
        }
        .field input:focus { border-color: var(--cyan-l); box-shadow: 0 0 0 3px rgba(59,130,246,.15); }

        .error { padding: 10px 14px; border: 1px solid rgba(248,113,113,.4); background: rgba(248,113,113,.08); color: #FCA5A5; font-size: 12.5px; border-radius: 10px; text-align: center; }
        
        .btn-primary { width: 100%; padding: 14px; font-weight: 600; cursor: pointer; }
        .btn-link { background: none; border: none; color: var(--muted); font-size: 11px; letter-spacing: .1em; text-transform: uppercase; cursor: pointer; transition: color 0.2s; }
        .btn-link:hover { color: #fff; }

        /* Status View Styles */
        .status-header { text-align: center; margin-bottom: 20px; }
        .ticket-badge { background: rgba(255,255,255,0.05); padding: 6px 12px; border-radius: 6px; font-family: 'Orbitron', monospace; letter-spacing: 1px; font-size: 14px; color: #9CA3AF; }
        
        .status-indicator { display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 24px; padding: 20px; background: rgba(0,0,0,0.2); border-radius: 12px; }
        .status-dot { width: 12px; height: 12px; border-radius: 50%; }
        .status-text { font-size: 15px; font-weight: bold; letter-spacing: 0.05em; text-transform: uppercase; }

        .status-comment { background: rgba(248, 113, 113, 0.05); border-left: 3px solid #F87171; padding: 12px 16px; border-radius: 4px; margin-bottom: 20px; }
        .comment-label { font-size: 11px; color: #F87171; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 6px; }
        .comment-body { font-size: 13.5px; color: #E5E7EB; line-height: 1.5; }

        .reply-section { display: flex; flex-direction: column; gap: 12px; }
        .reply-box {
          width: 100%; height: 100px; padding: 12px; background: rgba(255,255,255,0.02);
          border: 1px solid var(--border); border-radius: 8px; color: #fff; font-family: inherit;
          resize: none; outline: none;
        }
        .reply-box:focus { border-color: #3B82F6; }
      `}</style>
    </div>
  );
}
