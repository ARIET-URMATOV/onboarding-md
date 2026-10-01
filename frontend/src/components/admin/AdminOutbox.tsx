import { useState, useEffect } from 'react';
import { api } from '../../api/client';

export function AdminOutbox() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.get<any[]>('/api/admin/outbox');
      setEvents(data);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const retry = async (id: number) => {
    try {
      await api.post(`/api/admin/outbox/${id}/retry`);
      load();
    } catch {}
  };

  return (
    <div className="admin-list">
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <button className="admin-btn small" onClick={load} disabled={loading}>Обновить</button>
      </div>
      {events.map((e) => (
        <div key={e.id} className="admin-card">
          <div className="admin-card-head">
            <b>{e.kind.toUpperCase()}</b>
            <span className="admin-staff-badge" style={{ color: e.status === 'failed' ? '#FCA5A5' : e.status === 'done' ? '#86EFAC' : '#FDE68A', borderColor: 'currentColor', background: 'transparent' }}>
              {e.status}
            </span>
            <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Попыток: {e.retries}</span>
          </div>
          <div className="admin-card-sub" style={{ fontFamily: 'monospace', fontSize: 11, background: 'var(--background)', padding: 8, borderRadius: 4, marginTop: 4 }}>
            {JSON.stringify(e.payload)}
          </div>
          {e.error_msg && <div style={{ color: '#FCA5A5', fontSize: 11, marginTop: 4 }}>Ошибка: {e.error_msg}</div>}
          
          {(e.status === 'failed' || e.status === 'pending') && (
            <div style={{ marginTop: 8 }}>
              <button className="admin-btn small" onClick={() => retry(e.id)}>Повторить</button>
            </div>
          )}
        </div>
      ))}
      {!loading && events.length === 0 && <div className="admin-empty">Очередь пуста</div>}
    </div>
  );
}
