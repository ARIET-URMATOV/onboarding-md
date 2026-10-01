import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { api } from '../../api/client';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';

interface OutboxEvent {
  id: number;
  kind: string;
  status: string;
  retries: number;
  payload: unknown;
  error_msg?: string | null;
}

export function AdminOutbox() {
  const [events, setEvents] = useState<OutboxEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.get<OutboxEvent[]>('/api/admin/outbox');
      setEvents(data);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const retry = async (id: number) => {
    try {
      await api.post(`/api/admin/outbox/${id}/retry`);
      await load();
    } catch { /* ignore */ }
  };

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw /> Обновить
        </Button>
      </div>
      {events.map((e) => (
        <Card key={e.id}>
          <CardContent className="flex flex-col gap-2 pt-5">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <b>{e.kind.toUpperCase()}</b>
              <Badge
                variant="outline"
                className={
                  e.status === 'failed'
                    ? 'border-destructive/40 bg-destructive/10 text-destructive'
                    : e.status === 'done'
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                      : 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                }
              >
                {e.status}
              </Badge>
              <span className="text-xs text-muted-foreground">Попыток: {e.retries}</span>
            </div>
            <div className="break-all rounded bg-background p-2 font-mono text-[11px] text-muted-foreground">
              {JSON.stringify(e.payload)}
            </div>
            {e.error_msg && <div className="text-xs text-destructive">Ошибка: {e.error_msg}</div>}
            {(e.status === 'failed' || e.status === 'pending') && (
              <div>
                <Button size="sm" variant="outline" onClick={() => void retry(e.id)}>Повторить</Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
      {!loading && events.length === 0 && (
        <p className="py-5 text-center text-sm text-muted-foreground">Очередь пуста</p>
      )}
    </div>
  );
}
