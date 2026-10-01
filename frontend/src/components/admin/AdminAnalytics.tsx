import { useState, useEffect } from 'react';
import { api } from '../../api/client';

interface MetricsOut {
  total_applications: number;
  conversion_rate: number;
  avg_hr_hours: number;
  avg_sysadmin_hours: number;
}

export function AdminAnalytics() {
  const [metrics, setMetrics] = useState<MetricsOut | null>(null);

  useEffect(() => {
    api.get<MetricsOut>('/api/admin/applications/metrics')
       .then(setMetrics)
       .catch(() => {});
  }, []);

  if (!metrics) return <div className="admin-empty">Загрузка метрик...</div>;

  return (
    <div className="admin-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
      <div className="admin-card" style={{ padding: '24px', textAlign: 'center' }}>
        <div style={{ color: 'var(--muted-foreground)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Всего заявок</div>
        <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--primary)', marginTop: '8px' }}>{metrics.total_applications}</div>
      </div>
      <div className="admin-card" style={{ padding: '24px', textAlign: 'center' }}>
        <div style={{ color: 'var(--muted-foreground)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Воронка (Активировано)</div>
        <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--success)', marginTop: '8px' }}>{metrics.conversion_rate}%</div>
      </div>
      <div className="admin-card" style={{ padding: '24px', textAlign: 'center' }}>
        <div style={{ color: 'var(--muted-foreground)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Решение HR (SLA)</div>
        <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--blue)', marginTop: '8px' }}>{metrics.avg_hr_hours} ч</div>
      </div>
      <div className="admin-card" style={{ padding: '24px', textAlign: 'center' }}>
        <div style={{ color: 'var(--muted-foreground)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Выдача учётки (SLA)</div>
        <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--cyan)', marginTop: '8px' }}>{metrics.avg_sysadmin_hours} ч</div>
      </div>
    </div>
  );
}
