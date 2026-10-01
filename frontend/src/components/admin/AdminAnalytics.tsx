import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { Card, CardContent } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { CountUp, FadeContent } from '../bits';

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
      .catch(() => { /* ignore */ });
  }, []);

  if (!metrics) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full" />)}
      </div>
    );
  }

  const cards = [
    { label: 'Всего заявок', value: metrics.total_applications, suffix: '', tone: 'text-primary' },
    { label: 'Воронка (активировано)', value: metrics.conversion_rate, suffix: '%', tone: 'text-emerald-400' },
    { label: 'Решение HR (SLA)', value: metrics.avg_hr_hours, suffix: ' ч', tone: 'text-sky-400' },
    { label: 'Выдача учётки (SLA)', value: metrics.avg_sysadmin_hours, suffix: ' ч', tone: 'text-violet-400' },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c, i) => (
        <FadeContent key={c.label} delay={i * 0.08}>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">{c.label}</div>
              <div className={`mt-2 text-3xl font-bold ${c.tone}`}>
                <CountUp to={c.value} />{c.suffix}
              </div>
            </CardContent>
          </Card>
        </FadeContent>
      ))}
    </div>
  );
}
