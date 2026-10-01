import { useState, useEffect, useCallback } from 'react';
import { Check, History, LoaderCircle, RefreshCw } from 'lucide-react';
import { api } from '../../api/client';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Separator } from '../ui/separator';
import { cn } from '../../lib/utils';

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

interface AppEvent {
  id: number;
  from_status: string | null;
  to_status: string;
  comment: string;
  created_at: string;
}

const STATUS_META: Record<string, { label: string; className: string }> = {
  new: { label: 'Новая', className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' },
  in_review: { label: 'На рассмотрении', className: 'border-sky-500/40 bg-sky-500/10 text-sky-300' },
  needs_info: { label: 'Ждём ответа', className: 'border-amber-500/40 bg-amber-500/10 text-amber-300' },
  approved: { label: 'Одобрена (ждёт AD)', className: 'border-primary/40 bg-primary/10 text-primary' },
  account_created: { label: 'Учётка готова', className: 'border-violet-500/40 bg-violet-500/10 text-violet-300' },
  activated: { label: 'Активирована', className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' },
  rejected: { label: 'Отклонена', className: 'border-destructive/40 bg-destructive/10 text-destructive' },
};

function statusMeta(s: string) {
  return STATUS_META[s] ?? { label: s, className: '' };
}

const FILTERS = ['', 'new', 'in_review', 'needs_info', 'approved', 'account_created', 'activated'];

export function AdminApplications() {
  const [apps, setApps] = useState<ApplicationOut[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('');

  const [replyReason, setReplyReason] = useState<Record<number, string>>({});
  const [adLogin, setAdLogin] = useState<Record<number, string>>({});
  const [expandedEvents, setExpandedEvents] = useState<Record<number, AppEvent[]>>({});

  const loadApps = useCallback(async () => {
    setLoading(true);
    try {
      const qs = filterStatus ? `?status=${filterStatus}` : '';
      const data = await api.get<ApplicationOut[]>(`/api/admin/applications${qs}`);
      setApps(data);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    void loadApps();
  }, [loadApps]);

  const loadEvents = async (id: number) => {
    if (expandedEvents[id]) {
      const next = { ...expandedEvents };
      delete next[id];
      setExpandedEvents(next);
      return;
    }
    try {
      const data = await api.get<AppEvent[]>(`/api/admin/applications/${id}/events`);
      setExpandedEvents((prev) => ({ ...prev, [id]: data }));
    } catch { /* ignore */ }
  };

  const handleDecision = async (id: number, decision: string) => {
    const comment = replyReason[id] || (decision === 'approve' ? 'Одобрено' : '');
    if ((decision === 'reject' || decision === 'needs_info') && !comment.trim()) {
      setMsg('Необходим комментарий (причина)');
      return;
    }
    try {
      await api.post(`/api/admin/applications/${id}/decision`, { decision, comment });
      setMsg(`Заявка #${id} — ${decision}`);
      await loadApps();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Ошибка');
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
      await loadApps();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Ошибка');
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <Button key={f} type="button" size="sm" variant={filterStatus === f ? 'secondary' : 'ghost'} onClick={() => setFilterStatus(f)}>
            {f === '' ? 'Все' : statusMeta(f).label}
          </Button>
        ))}
        <Button size="sm" variant="ghost" onClick={() => void loadApps()} disabled={loading}>
          <RefreshCw className={cn(loading && 'animate-spin')} />
        </Button>
      </div>

      {msg && (
        <Alert>
          <AlertDescription>{msg}</AlertDescription>
        </Alert>
      )}

      {apps.map((app) => {
        const meta = statusMeta(app.status);
        const events = expandedEvents[app.id];
        return (
          <Card key={app.id} className={cn(app.status === 'new' && 'border-emerald-500/40')}>
            <CardContent className="flex flex-col gap-3 pt-5">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback className="bg-primary font-bold text-primary-foreground">
                    {app.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <b>{app.name}</b>
                    <Badge variant="outline" className={meta.className}>{meta.label}</Badge>
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{app.email} · {app.phone}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-1.5 text-xs text-muted-foreground sm:grid-cols-2">
                <div><b className="text-foreground">Департамент:</b> {app.department || '—'}</div>
                <div><b className="text-foreground">Должность:</b> {app.position || '—'}</div>
                <div><b className="text-foreground">Руководитель:</b> {app.lead_name || '—'}</div>
                <div><b className="text-foreground">Дата выхода:</b> {app.planned_date ? new Date(app.planned_date).toLocaleDateString() : '—'}</div>
                <div className="sm:col-span-2"><b className="text-foreground">Тикет:</b> <code className="font-mono">{app.number}</code></div>
              </div>

              <div>
                <Button size="sm" variant="ghost" onClick={() => void loadEvents(app.id)}>
                  <History /> {events ? 'Скрыть историю' : 'Показать историю'}
                </Button>
              </div>

              {events && (
                <div className="rounded-md border border-border bg-background p-3">
                  <div className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">История (Timeline)</div>
                  <div className="flex flex-col gap-2">
                    {events.map((evt) => (
                      <div key={evt.id} className="flex gap-3 text-xs">
                        <div className="shrink-0 font-mono text-primary">
                          {new Date(evt.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div>
                          <div><b>{evt.from_status || 'start'}</b> → <b>{evt.to_status}</b></div>
                          <div className="mt-0.5 text-muted-foreground">{evt.comment}</div>
                        </div>
                      </div>
                    ))}
                    {events.length === 0 && <div className="text-xs text-muted-foreground">Нет событий</div>}
                  </div>
                </div>
              )}

              {(app.status === 'new' || app.status === 'in_review' || app.status === 'needs_info') && (
                <div className="rounded-md bg-muted/40 p-3">
                  <Textarea
                    value={replyReason[app.id] || ''}
                    onChange={(e) => setReplyReason((p) => ({ ...p, [app.id]: e.target.value }))}
                    placeholder="Комментарий для одобрения / отклонения / уточнения"
                    className="mb-2 min-h-14"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => void handleDecision(app.id, 'approve')}>
                      <Check /> Одобрить
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void handleDecision(app.id, 'needs_info')}>Запросить уточнение</Button>
                    <Button size="sm" variant="destructive" onClick={() => void handleDecision(app.id, 'reject')}>Отклонить</Button>
                  </div>
                </div>
              )}

              {app.status === 'approved' && (
                <div className="rounded-md bg-primary/10 p-3">
                  <Label className="mb-2 block text-[11px] text-primary">Действие Sysadmin: укажите выданный логин AD</Label>
                  <div className="flex gap-2">
                    <Input
                      value={adLogin[app.id] || ''}
                      onChange={(e) => setAdLogin((p) => ({ ...p, [app.id]: e.target.value }))}
                      placeholder="AD Login (e.g. i.ivanov)"
                    />
                    <Button size="sm" onClick={() => void handleAccountCreated(app.id)}>Выдать</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {!loading && apps.length === 0 && (
        <p className="py-5 text-center text-sm text-muted-foreground">Заявок не найдено</p>
      )}
      {loading && (
        <p className="flex items-center justify-center gap-2 py-5 text-sm text-muted-foreground">
          <LoaderCircle className="h-4 w-4 animate-spin" /> Загрузка…
        </p>
      )}
      <Separator />
    </div>
  );
}
