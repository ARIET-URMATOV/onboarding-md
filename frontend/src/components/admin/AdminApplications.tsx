import { useState, useEffect } from 'react';
import { api } from '../../api/client';

interface ApplicationOut {
  id: number;
  number: string;
  name: string;
  email: string;
  phone: string;
  department: string | null;
  position: string | null;
  planned_date: string | null;
  lead_name: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export function AdminApplications() {
  const [apps, setApps] = useState<ApplicationOut[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('');
  
  const [replyReason, setReplyReason] = useState<Record<number, string>>({});
  const [adLogin, setAdLogin] = useState<Record<number, string>>({});
  const [expandedEvents, setExpandedEvents] = useState<Record<number, any[]>>({});

  const loadEvents = async (id: number) => {
    if (expandedEvents[id]) {
      // Toggle off
      const next = {...expandedEvents};
      delete next[id];
      setExpandedEvents(next);
      return;
    }
    try {
      const data = await api.get<any[]>(`/api/admin/applications/${id}/events`);
      setExpandedEvents(prev => ({...prev, [id]: data}));
    } catch { /* ignore */ }
  };

  const loadApps = async () => {
    setLoading(true);
    try {
      const qs = filterStatus ? `?status=${filterStatus}` : '';
      const data = await api.get<ApplicationOut[]>(`/api/admin/applications${qs}`);
      setApps(data);
    } catch (e: any) {
      setMsg(e.message || 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApps();
  }, [filterStatus]);

  const handleDecision = async (id: number, decision: string) => {
    const comment = replyReason[id] || (decision === 'approve' ? 'Одобрено' : '');
    if ((decision === 'reject' || decision === 'needs_info') && !comment.trim()) {
      setMsg('Необходим комментарий (причина)');
      return;
    }

    try {
      await api.post(`/api/admin/applications/${id}/decision`, { decision, comment });
      setMsg(`Заявка #${id} — ${decision}`);
      loadApps();
    } catch (e: any) {
      setMsg(e.message || 'Ошибка');
    }
  };

  const handleAccountCreated = async (id: number) => {
    const login = adLogin[id];
    if (!login) {
      setMsg('Введите AD логин');
      return;
    }
    try {
      await api.post(`/api/admin/applications/${id}/account`, { ad_login: login });
      setMsg(`AD логин ${login} выдан заявке #${id}`);
      loadApps();
    } catch (e: any) {
      setMsg(e.message || 'Ошибка');
    }
  };

  const statusLabel = (s: string) => {
    switch (s) {
      case 'new': return 'Новая';
      case 'in_review': return 'На рассмотрении';
      case 'needs_info': return 'Ждём ответа';
      case 'approved': return 'Одобрена (ждёт AD)';
      case 'account_created': return 'Учётка готова';
      case 'activated': return 'Активирована';
      case 'rejected': return 'Отклонена';
      default: return s;
    }
  };

  return (
    <div className="admin-list">
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {['', 'new', 'in_review', 'needs_info', 'approved', 'account_created', 'activated'].map((f) => (
          <button key={f} type="button" onClick={() => setFilterStatus(f)} className={`admin-tab ${filterStatus === f ? 'active' : ''}`}>
            {f === '' ? 'Все' : statusLabel(f)}
          </button>
        ))}
        <button className="admin-tab" onClick={loadApps} disabled={loading}>↻</button>
      </div>

      {msg && <div className="admin-msg" style={{ marginBottom: 8 }}>{msg}</div>}

      {apps.map((app) => (
        <div key={app.id} className="admin-card hr-doc" style={{ borderColor: app.status === 'new' ? 'rgba(52, 211, 153, 0.5)' : undefined }}>
          <div className="admin-card-head">
            <span className="admin-avatar">{app.name.charAt(0).toUpperCase()}</span>
            <div>
              <b>{app.name}</b> <span className="admin-staff-badge">{statusLabel(app.status)}</span>
              <div className="admin-email">{app.email} · {app.phone}</div>
            </div>
          </div>
          
          <div className="admin-card-sub" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, margin: '8px 0' }}>
            <div><b>Департамент:</b> {app.department || '—'}</div>
            <div><b>Должность:</b> {app.position || '—'}</div>
            <div><b>Руководитель:</b> {app.lead_name || '—'}</div>
            <div><b>Дата выхода:</b> {app.planned_date ? new Date(app.planned_date).toLocaleDateString() : '—'}</div>
            <div style={{ gridColumn: '1 / -1' }}><b>Тикет:</b> <code style={{fontFamily: 'monospace'}}>{app.number}</code></div>
            <div style={{ gridColumn: '1 / -1', marginTop: 4 }}>
              <button className="btn-ghost sm" onClick={() => loadEvents(app.id)}>
                {expandedEvents[app.id] ? 'Скрыть историю' : 'Показать историю'}
              </button>
            </div>
          </div>

          {expandedEvents[app.id] && (
            <div style={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginTop: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>История (Timeline)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {expandedEvents[app.id].map((evt: any) => (
                  <div key={evt.id} style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                    <div style={{ color: 'var(--primary)', flexShrink: 0, fontFamily: 'monospace' }}>
                      {new Date(evt.created_at).toLocaleTimeString('ru-RU', {hour: '2-digit', minute:'2-digit'})}
                    </div>
                    <div>
                      <div style={{ color: 'var(--foreground)' }}>
                        <b>{evt.from_status || 'start'}</b> → <b>{evt.to_status}</b>
                      </div>
                      <div style={{ color: 'var(--muted-foreground)', marginTop: 2 }}>{evt.comment}</div>
                    </div>
                  </div>
                ))}
                {expandedEvents[app.id].length === 0 && <div style={{ color: 'var(--muted-foreground)', fontSize: 12 }}>Нет событий</div>}
              </div>
            </div>
          )}

          {(app.status === 'new' || app.status === 'in_review' || app.status === 'needs_info') && (
            <div style={{ background: 'rgba(0,0,0,0.1)', padding: 12, borderRadius: 8, marginTop: 8 }}>
              <textarea 
                value={replyReason[app.id] || ''} 
                onChange={e => setReplyReason(p => ({...p, [app.id]: e.target.value}))}
                placeholder="Комментарий для одобрения / отклонения / уточнения"
                className="admin-input"
                style={{ width: '100%', marginBottom: 8, minHeight: 60 }}
              />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="admin-verify-btn" onClick={() => handleDecision(app.id, 'approve')}>Одобрить</button>
                <button className="admin-reject-btn" onClick={() => handleDecision(app.id, 'needs_info')}>Запросить уточнение</button>
                <button className="admin-reject-btn" style={{ background: 'rgba(239,68,68,0.2)' }} onClick={() => handleDecision(app.id, 'reject')}>Отклонить</button>
              </div>
            </div>
          )}

          {app.status === 'approved' && (
            <div style={{ background: 'rgba(59,130,246,0.1)', padding: 12, borderRadius: 8, marginTop: 8 }}>
              <div style={{ fontSize: 11, color: '#93C5FD', marginBottom: 8 }}>Действие Sysadmin: Укажите выданный логин AD</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input 
                  className="admin-input" 
                  value={adLogin[app.id] || ''}
                  onChange={e => setAdLogin(p => ({...p, [app.id]: e.target.value}))}
                  placeholder="AD Login (e.g. i.ivanov)" 
                />
                <button className="admin-btn" onClick={() => handleAccountCreated(app.id)}>Выдать</button>
              </div>
            </div>
          )}
        </div>
      ))}
      
      {!loading && apps.length === 0 && <div className="admin-empty">Заявок не найдено</div>}
    </div>
  );
}
