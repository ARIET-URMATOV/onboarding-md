import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Check, LoaderCircle, RefreshCw, X } from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../components/ui/ToastProvider';
import { useOnboarding } from '../store/useOnboarding';
import { AdminApplications } from '../components/admin/AdminApplications';
import { AdminAnalytics } from '../components/admin/AdminAnalytics';
import { AdminOutbox } from '../components/admin/AdminOutbox';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Skeleton } from '../components/ui/skeleton';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { FadeContent } from '../components/bits';
import { cn } from '../lib/utils';

interface AdminUser {
  id: number;
  email: string;
  name: string;
  role: string | null;
  is_staff: boolean;
  created_at: string | null;
  done_stage1: string[];
  lead_email: string;
}

interface AuditRow {
  id: number;
  user_id: number;
  task_id: string;
  verified_by: number | null;
  method: string;
  details: string;
  created_at: string | null;
}

interface PendingRow {
  id: number;
  user_id: number;
  email: string;
  name: string;
  task_id: string;
  note: string;
  created_at: string | null;
}

interface MpulseCode {
  id: number;
  code: string;
  batch_name: string;
  is_active: boolean;
  created_at: string | null;
}

interface Links {
  telegram_invite_link: string;
  figma_team_url: string;
  confluence_url: string;
  mpulse_android_url: string;
  mpulse_ios_url: string;
}

const DOC_TASKS = ['1-dogovor', '1-nda', '1-pdp', '1-ip', '1-sn'];
const ACCESS_TASKS = ['1-mbusiness', '1-accountant', '1-wifi', '1-proxy', '1-telegram'];

const TASK_LABELS: Record<string, string> = {
  '1-dogovor': 'Договор', '1-nda': 'NDA', '1-pdp': 'Персональные данные',
  '1-ip': 'Свидетельство ИП', '1-sn': 'Справка о несудимости',
  '1-mbusiness': 'MBusiness', '1-accountant': 'Бухгалтер', '1-wifi': 'Wi-Fi',
  '1-proxy': 'Прокси-карта', '1-telegram': 'Telegram',
  '1-jira': 'Jira', '1-figma': 'Figma', '1-gitlab': 'GitLab',
  '1-mpulse': 'MPulse', '1-mpulse-schedule': 'MPulse (график)',
  '1-mpulse-checkin': 'MPulse (check-in)', '1-mpulse-code': 'MPulse (код)',
  '1-mpulse-news': 'MPulse (новости)', '1-confluence-read': 'Confluence',
};
function taskLabel(tid: string): string { return TASK_LABELS[tid] || tid.replace('1-', ''); }

function ago(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s} сек назад`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} мин назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч назад`;
  return `${Math.floor(h / 24)} дн назад`;
}

function prettyDetails(raw: string): string {
  try {
    const d = JSON.parse(raw || '{}') as Record<string, unknown>;
    const parts: string[] = [];
    if (d.elapsed_s !== undefined) parts.push(`читал ${d.elapsed_s}с`);
    if (d.via_api) parts.push('через API');
    if (d.opened_at) parts.push(`открыт ${new Date(String(d.opened_at)).toLocaleString('ru-RU')}`);
    return parts.join(' · ');
  } catch {
    return '';
  }
}

export function AdminPage() {
  const user = useOnboarding((s) => s.user);
  const [q, setQ] = useState('');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<'applications' | 'analytics' | 'outbox' | 'pending' | 'users' | 'audit' | 'codes' | 'wifi' | 'settings' | 'services'>('applications');
  const [taskFilter, setTaskFilter] = useState<string>('all');
  const [contacts, setContacts] = useState<Record<string, string>>({});
  const [wifiReqs, setWifiReqs] = useState<{ user_id: number; email: string; name: string; mac: string; sent_at: string | null; has_password: boolean; verified: boolean }[]>([]);
  const [wifiPwForm, setWifiPwForm] = useState<Record<number, string>>({});
  const [liveOn, setLiveOn] = useState(false);
  const prevPending = useRef(0);
  const [codes, setCodes] = useState<MpulseCode[]>([]);
  const [links, setLinks] = useState<Links | null>(null);
  const [newCode, setNewCode] = useState('');
  const [newBatch, setNewBatch] = useState('');
  const [wifiPw, setWifiPw] = useState<Record<number, string>>({});
  const [leadForm, setLeadForm] = useState<Record<number, string>>({});
  const [tgGroupsJson, setTgGroupsJson] = useState('[]');
  const [tgRights, setTgRights] = useState<{ bot: string; groups: { title: string; ok: boolean; detail: string; roles?: string[] }[] } | null>(null);
  const [tgWhStatus, setTgWhStatus] = useState<{ url?: string; has_custom_certificate?: boolean; pending_update_count?: number; last_error_message?: string; last_error_date?: number } | null>(null);
  const [tgWhRegistering, setTgWhRegistering] = useState(false);
  const [svcList, setSvcList] = useState<{ key: string; title: string; subtitle: string; url: string; icon_key: string; category: string; task_id: string | null; roles: string[]; sort_order: number; is_visible: boolean; open_new_tab: boolean; extra: Record<string, string>; details: string }[]>([]);
  const [svcForm, setSvcForm] = useState<{ key: string; title: string; subtitle: string; url: string; icon_key: string; category: string; task_id: string | null; roles: string[]; sort_order: number; is_visible: boolean; open_new_tab: boolean; extra: Record<string, string>; details: string }>({ key: '', title: '', subtitle: '', url: '', icon_key: 'Link', category: 'access', task_id: null, roles: [], sort_order: 0, is_visible: true, open_new_tab: true, extra: {}, details: '' });
  const [svcEditKey, setSvcEditKey] = useState<string | null>(null);

  const loadTgGroups = useCallback(async () => {
    try {
      const r = await api.get<{ groups: { title: string; chat_id: string }[] }>('/api/integrations/telegram-groups');
      setTgGroupsJson(JSON.stringify(r.groups, null, 1));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { void loadTgGroups(); }, [loadTgGroups]);

  const [v2Pending, setV2Pending] = useState(0);

  const loadExtras = useCallback(async () => {
    try {
      const [w, s, svcs, v2apps] = await Promise.all([
        api.get<{ user_id: number; email: string; name: string; mac: string; sent_at: string | null; has_password: boolean; verified: boolean }[]>('/api/admin/wifi-requests'),
        api.get<{ contacts: Record<string, string>; instructions: Record<string, string>; intro: Record<string, string>; stage5: Record<string, string> }>('/api/admin/settings'),
        api.get<{ key: string; title: string; subtitle: string; url: string; icon_key: string; category: string; task_id: string | null; roles: string[]; sort_order: number; is_visible: boolean; open_new_tab: boolean; extra: Record<string, string>; details: string }[]>('/api/admin/services'),
        api.get<any[]>('/api/admin/applications?status=new'),
      ]);
      setWifiReqs(w);
      setContacts(s.contacts);
      setSvcList(svcs);
      setV2Pending(v2apps.length);
      if (s.instructions) setContacts((prev) => ({ ...prev, ...s.instructions }));
      if (s.intro) setContacts((prev) => ({ ...prev, ...s.intro }));
      if (s.stage5) setContacts((prev) => ({ ...prev, ...s.stage5 }));
    } catch { /* ignore */ }
  }, []);

  const saveContact = async (key: string) => {
    try {
      const r = await api.patch<{ contacts: Record<string, string>; instructions: Record<string, string>; intro: Record<string, string>; stage5: Record<string, string> }>('/api/admin/settings', { key, value: contacts[key] ?? '' });
      setContacts({ ...r.contacts, ...r.instructions, ...r.intro, ...r.stage5 });
      setMsg(`✓ ${key} сохранён`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Ошибка сохранения');
    }
  };

  const setWifiPwAdmin = async (userId: number) => {
    const password = (wifiPwForm[userId] ?? '').trim();
    try {
      const r = await api.post<{ ok: boolean; password: string; user_id: number }>(
        '/api/admin/wifi-password', { user_id: userId, password },
      );
      setWifiPw((prev) => ({ ...prev, [userId]: r.password }));
      setWifiPwForm((prev) => ({ ...prev, [userId]: '' }));
      setMsg(password ? '✓ Пароль сохранён, сотрудник увидит его в интерфейсе' : '✓ Пароль сгенерирован (показан один раз)');
      await loadExtras();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Ошибка');
    }
  };

  const saveTgGroups = async () => {
    try {
      await api.patch('/api/admin/settings', { key: 'telegram.groups_json', value: tgGroupsJson });
      setMsg('✓ Группы Telegram сохранены');
      await loadTgGroups();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Ошибка сохранения');
    }
  };

  const checkTgRights = async () => {
    try {
      const r = await api.get<{ bot: string; groups: { title: string; ok: boolean; detail: string; roles?: string[] }[] }>('/api/integrations/telegram-check-rights');
      setTgRights(r);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Бот недоступен');
    }
  };

  const registerTgWebhook = async () => {
    setTgWhRegistering(true);
    try {
      await api.post('/api/admin/telegram-webhook/register');
      setMsg('✓ Webhook зарегистрирован');
      await checkTgWhStatus();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Ошибка webhook');
    } finally {
      setTgWhRegistering(false);
    }
  };

  const checkTgWhStatus = async () => {
    try {
      const r = await api.get<{ url?: string; has_custom_certificate?: boolean; pending_update_count?: number; last_error_message?: string; last_error_date?: number }>('/api/admin/telegram-webhook/status');
      setTgWhStatus(r);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Webhook недоступен');
    }
  };
  const toast = useToast();
  const [rejectFor, setRejectFor] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [svcToDelete, setSvcToDelete] = useState<{ key: string; title: string } | null>(null);

  const DOC_TITLES: Record<string, string> = {
    '1-dogovor': 'Договор об оказании услуг (2 экз., подписан)',
    '1-nda': 'NDA (2 экз., подписано)',
    '1-pdp': 'Соглашение о персональных данных (подписано)',
    '1-ip': 'Реквизиты ИП (приложены)',
    '1-sn': 'Справка о несудимости (актуальна)',
  };

  // группировка очереди по сотрудникам: один мини-документ на человека (+ фильтр по задаче)
  const visiblePending = taskFilter === 'all' ? pending : pending.filter((r) => r.task_id === taskFilter);
  const pendingByUser = visiblePending.reduce<Record<number, { user_id: number; email: string; name: string; rows: PendingRow[] }>>((acc, r) => {
    (acc[r.user_id] ??= { user_id: r.user_id, email: r.email, name: r.name, rows: [] }).rows.push(r);
    return acc;
  }, {});
  const pendingGroups = Object.values(pendingByUser);

  const verifyBatch = async (userId: number) => {
    try {
      await api.post('/api/verify-docs-batch', { task_ids: DOC_TASKS, user_id: userId });
      setMsg('✓ Пакет документов подтверждён (+5 баллов сотруднику)');
      await load(true);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Ошибка верификации');
    }
  };

  const rejectBatch = async (userId: number) => {
    const reason = rejectReason.trim();
    if (reason.length < 10) { setMsg('Укажите причину отклонения (мин 10 символов)'); return; }
    try {
      const rows = pendingByUser[userId]?.rows ?? [];
      for (const r of rows.filter((x) => DOC_TASKS.includes(x.task_id))) {
        await api.post(`/api/admin/pending/${r.id}/reject`, { reason });
      }
      setRejectFor(null);
      setRejectReason('');
      setMsg('Пакет отклонён, сотрудник уведомлён');
      await load(true);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Ошибка отклонения');
    }
  };

  const load = useCallback(async (quiet = false) => {
    if (!quiet) { setLoading(true); setMsg(null); }
    try {
      const [p, a, c, l] = await Promise.all([
        api.get<PendingRow[]>('/api/admin/pending-verifications'),
        api.get<AuditRow[]>('/api/admin/audit'),
        api.get<MpulseCode[]>('/api/admin/mpulse-code'),
        api.get<Links>('/api/integrations/links'),
      ]);
      // тост о новых запросах (не при первой загрузке)
      if (prevPending.current && p.length > prevPending.current) {
        const fresh = p[0];
        const text = fresh ? `Новый запрос: ${fresh.name} — ${fresh.task_id}` : 'Новые запросы';
        setMsg(`🔔 ${text}`);
        toast.info(text, 'Откройте вкладку «Ожидают»');
        try {
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Онбординг HR', { body: text });
          }
        } catch { /* ignore */ }
      }
      prevPending.current = p.length;
      setPending(p);
      setAudit(a);
      setCodes(c);
      setLinks(l);
    } catch (e) {
      if (!quiet) setMsg(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // live: WS + polling 15с + refetch на focus/visible
  useEffect(() => {
    let ws: WebSocket | null = null;
    try {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(`${proto}//${window.location.host}/ws/admin`);
      ws.onmessage = () => { setLiveOn(true); void load(true); void loadExtras(); };
      ws.onclose = () => setLiveOn(false);
      ws.onerror = () => { try { ws?.close(); } catch { /* ignore */ } };
    } catch { /* WS недоступен — polling */ }
    const id = setInterval(() => { void load(true); void loadExtras(); }, 15000);
    const refetch = () => { void load(true); void loadExtras(); };
    document.addEventListener('visibilitychange', refetch);
    window.addEventListener('focus', refetch);
    try {
      if ('Notification' in window && Notification.permission === 'default') {
        void Notification.requestPermission();
      }
    } catch { /* ignore */ }
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', refetch);
      window.removeEventListener('focus', refetch);
      try { ws?.close(); } catch { /* ignore */ }
    };
  }, [load]);

  const search = async () => {
    setLoading(true);
    try {
      const u = await api.get<AdminUser[]>(`/api/admin/users?q=${encodeURIComponent(q)}`);
      setUsers(u);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Ошибка поиска');
    } finally {
      setLoading(false);
    }
  };

  const verify = async (userId: number, taskId: string) => {
    const endpoint = DOC_TASKS.includes(taskId) ? '/api/verify-docs' : '/api/verify-access';
    try {
      await api.post(endpoint, { user_id: userId, task_id: taskId });
      setMsg(`✓ ${taskId} подтверждена`);
      await load(true);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Ошибка верификации');
    }
  };

  const verifyRow = async (r: PendingRow) => {
    await verify(r.user_id, r.task_id);
  };

  const rejectRow = async (r: PendingRow) => {
    try {
      await api.post(`/api/admin/pending/${r.id}/reject`, { reason: 'Отклонено HR — уточните детали у HR' });
      setMsg(`Запрос ${r.task_id} (${r.email}) отклонён`);
      await load(true);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Ошибка отклонения');
    }
  };

  const verifyAllDocs = async (u: AdminUser) => {
    const docs = DOC_TASKS.filter((t) => u.done_stage1.includes(t));
    if (!docs.length) return;
    try {
      for (const t of docs) {
        await api.post('/api/verify-docs', { user_id: u.id, task_id: t });
      }
      setMsg(`✓ Все документы ${u.email} подтверждены (${docs.length})`);
      await load(true);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Ошибка верификации');
    }
  };

  const genWifiPassword = async (u: AdminUser) => {
    try {
      const r = await api.post<{ ok: boolean; password: string; user_id: number }>(
        '/api/admin/wifi-password', { user_id: u.id, task_id: '1-wifi' },
      );
      setWifiPw((prev) => ({ ...prev, [u.id]: r.password }));
      setMsg(`✓ Пароль для ${u.email} сгенерирован — передайте вне системы (показан один раз)`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Ошибка генерации');
    }
  };

  const toggleStaff = async (u: AdminUser) => {
    try {
      const updated = await api.patch<AdminUser>(`/api/admin/users/${u.id}/staff`, { is_staff: !u.is_staff });
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, is_staff: updated.is_staff } : x)));
      setPending((prev) => prev.map((x) => (x.id === u.id ? { ...x, is_staff: updated.is_staff } : x)));
      setMsg(`${u.email} — staff: ${updated.is_staff ? 'да' : 'нет'}`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Ошибка');
    }
  };

  const rotateCode = async () => {
    const code = newCode.trim();
    if (!code) { setMsg('Введите новый код MPulse'); return; }
    try {
      const created = await api.post<MpulseCode>('/api/admin/mpulse-code', { code, batch_name: newBatch.trim() });
      setCodes((prev) => [created, ...prev.map((c) => ({ ...c, is_active: false }))]);
      setNewCode('');
      setMsg(`✓ Новый код батча «${created.batch_name || '—'}» активен`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Ошибка ротации');
    }
  };

  if (!user?.isStaff) return <Navigate to="/dashboard" replace />;

  const renderTasks = (u: AdminUser) => {
    const tasks = [...DOC_TASKS, ...ACCESS_TASKS].filter((t) => u.done_stage1.includes(t));
    if (!tasks.length) return <span className="text-xs opacity-50">нет отметок</span>;
    return (
      <div className="flex flex-wrap gap-1.5">
        {tasks.map((t) => (
          <Button key={t} type="button" size="sm" variant="outline" onClick={() => verify(u.id, t)} title="Подтвердить" className="h-7 text-xs">
            {t} <Check className="h-3 w-3" />
          </Button>
        ))}
      </div>
    );
  };

  const TABS = [
    { id: 'applications', label: 'Заявки V2', count: v2Pending },
    { id: 'analytics', label: 'Аналитика', count: 0 },
    { id: 'outbox', label: 'Очередь (Outbox)', count: 0 },
    { id: 'pending', label: 'Ожидают', count: pending.length },
    { id: 'users', label: 'Сотрудники', count: 0 },
    { id: 'audit', label: 'Журнал', count: audit.length },
    { id: 'codes', label: 'Коды и ссылки', count: 0 },
    { id: 'wifi', label: 'Wi-Fi запросы', count: 0 },
    { id: 'services', label: 'Сервисы', count: svcList.length },
    { id: 'settings', label: 'Настройки', count: 0 },
  ] as const;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-3 py-4 pb-20 sm:px-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-extrabold tracking-tight">HR-панель · Этап 1 «Документы и доступы»</h1>
        <Badge variant="outline" className={cn(liveOn ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'text-muted-foreground')} title={liveOn ? 'Live-подключение активно' : 'Live недоступен, polling 15с'}>
          {liveOn ? '● live' : '○ polling'}
        </Badge>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <div className="flex items-start gap-2">
          <TabsList className="flex h-auto flex-wrap justify-start">
            {TABS.map((t) => (
              <TabsTrigger key={t.id} value={t.id} className="gap-1.5">
                {t.label}
                {t.count > 0 && (
                  <Badge variant="secondary" className="h-5 min-w-5 bg-primary/15 px-1 text-[10px] text-primary">{t.count}</Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
          <Button type="button" size="sm" variant="ghost" onClick={() => { load(); loadExtras(); }} disabled={loading} className="shrink-0">
            <RefreshCw className={cn(loading && 'animate-spin')} />
          </Button>
        </div>

        {msg && (
          <Alert className="mt-3 border-emerald-500/30 bg-emerald-500/10">
            <AlertDescription className="text-emerald-200">{msg}</AlertDescription>
          </Alert>
        )}

        <TabsContent value="applications" className="mt-4"><AdminApplications /></TabsContent>
        <TabsContent value="analytics" className="mt-4"><AdminAnalytics /></TabsContent>
        <TabsContent value="outbox" className="mt-4"><AdminOutbox /></TabsContent>

      <TabsContent value="pending" className="mt-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5">
            {['all', '1-mbusiness', '1-accountant', '1-wifi', '1-proxy', '1-telegram', '1-jira', '1-figma', '1-gitlab'].map((f) => (
              <Button key={f} type="button" size="sm" variant={taskFilter === f ? 'secondary' : 'ghost'} onClick={() => setTaskFilter(f)}>
                {f === 'all' ? 'Все' : f.replace('1-', '')}
              </Button>
            ))}
          </div>
          {loading && !pending.length && [0, 1, 2].map((i) => (
            <Card key={i}>
              <CardContent className="space-y-2 pt-5">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
          {pendingGroups.filter((g) => g.rows.some((r) => DOC_TASKS.includes(r.task_id))).map((g) => {
            const first = g.rows[0];
            const docRows = g.rows.filter((r) => DOC_TASKS.includes(r.task_id));
            return (
              <FadeContent key={g.user_id}>
                <Card className="border-primary/30 bg-primary/5">
                  <CardContent className="flex flex-col gap-3 pt-5">
                    <div className="flex items-center gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-sm font-extrabold text-primary-foreground">
                        {(g.name || g.email).slice(0, 1).toUpperCase()}
                      </span>
                      <div>
                        <b className="text-sm">{g.name}</b>
                        <div className="text-xs text-muted-foreground">{g.email} · отправлено {first.created_at ? ago(first.created_at) : '—'}</div>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">Пакет документов на физическую проверку — сверьте 5 пунктов, затем подтвердите:</p>
                    <ul className="flex flex-col gap-1.5">
                      {DOC_TASKS.map((tid) => {
                        const sent = docRows.some((r) => r.task_id === tid);
                        return (
                          <li key={tid} className={cn('flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-2 text-xs', sent ? 'border-emerald-500/30' : 'opacity-55')}>
                            <span className={cn('font-extrabold', sent ? 'text-emerald-400' : 'text-muted-foreground')}>
                              {sent ? <Check className="h-3.5 w-3.5" /> : <span className="inline-block h-3.5 w-3.5 text-center">○</span>}
                            </span>
                            {DOC_TITLES[tid]}
                          </li>
                        );
                      })}
                    </ul>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" onClick={() => verifyBatch(g.user_id)}>
                        <Check /> Подтвердить получение и проверку документов
                      </Button>
                      <Button type="button" size="sm" variant="destructive" onClick={() => { setRejectFor(rejectFor === g.user_id ? null : g.user_id); setRejectReason(''); }}>
                        Отклонить
                      </Button>
                    </div>
                    {rejectFor === g.user_id && (
                      <div className="flex flex-col gap-2">
                        <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Причина отклонения (мин 10 символов), например: не хватает справки о несудимости" rows={2} />
                        <Button type="button" size="sm" variant="destructive" onClick={() => rejectBatch(g.user_id)} disabled={rejectReason.trim().length < 10}>
                          Отклонить пакет
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </FadeContent>
            );
          })}
          {pending.filter((r) => !DOC_TASKS.includes(r.task_id)).map((r) => (
            <Card key={r.id}>
              <CardContent className="flex flex-col gap-2 pt-5">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <b>{r.name}</b> <span className="text-xs text-muted-foreground">{r.email}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  <b className="text-foreground">{taskLabel(r.task_id)}</b>
                  {' · '}
                  {r.created_at ? ago(r.created_at) : '—'}
                  {r.note ? ` · «${r.note}»` : ''}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={() => verifyRow(r)}><Check /> Подтвердить</Button>
                  <Button type="button" size="sm" variant="destructive" onClick={() => rejectRow(r)}>Отклонить</Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {!pending.length && !loading && <p className="py-5 text-center text-sm text-muted-foreground">Нет ожидающих запросов</p>}
        </div>
      </TabsContent>

      <TabsContent value="wifi" className="mt-4">
        <div className="flex flex-col gap-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Wi-Fi запросы</CardTitle>
              <CardDescription>MAC от сотрудников · введите пароль → Сохранить → система покажет его сотруднику под полем MAC.</CardDescription>
            </CardHeader>
          </Card>
          {wifiReqs.map((w) => (
            <Card key={`${w.user_id}-${w.mac}`}>
              <CardContent className="flex flex-col gap-2 pt-5">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <b>{w.name}</b> <span className="text-xs text-muted-foreground">{w.email}</span>
                  {w.verified && <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300">подтверждён</Badge>}
                  {!w.verified && w.has_password && <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-300">пароль задан</Badge>}
                </div>
                <div className="text-xs text-muted-foreground">
                  MAC: <code className="font-mono">{w.mac}</code> · отправлен {w.sent_at ? ago(w.sent_at) : '—'}
                </div>
                {!w.verified && (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      value={wifiPwForm[w.user_id] ?? ''}
                      onChange={(e) => setWifiPwForm((p) => ({ ...p, [w.user_id]: e.target.value }))}
                      placeholder="Пароль (пусто = сгенерировать)"
                    />
                    <Button type="button" size="sm" onClick={() => setWifiPwAdmin(w.user_id)} className="shrink-0">Сохранить</Button>
                  </div>
                )}
                {wifiPw[w.user_id] && (
                  <Alert className="border-amber-500/40 bg-amber-500/10">
                    <AlertDescription className="text-amber-200">
                      <code className="font-mono text-sm text-foreground">{wifiPw[w.user_id]}</code>
                      {' '}— показан один раз, сотрудник уже видит его в интерфейсе
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          ))}
          {!wifiReqs.length && !loading && <p className="py-5 text-center text-sm text-muted-foreground">MAC-адресов пока нет</p>}
        </div>
      </TabsContent>

      <TabsContent value="settings" className="mt-4">
        <div className="flex flex-col gap-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Настройки → Контакты</CardTitle>
              <CardDescription>Email ответственных (можно несколько через запятую). Уведомления о запросах уходят сюда; если пусто — HR. Меняются в любой момент без редеплоя.</CardDescription>
            </CardHeader>
          </Card>
          {[
            { key: 'contacts.hr_email', label: 'HR' },
            { key: 'contacts.sysadmin_email', label: 'Сетевик(и) — можно несколько через запятую' },
            { key: 'contacts.lead_email', label: 'Lead / PM (глобальный; per-employee задаётся в карточке сотрудника)' },
            { key: 'contacts.accountant_email', label: 'Бухгалтер' },
            { key: 'contacts.teamlead_email', label: 'Тимлид' },
          ].map((c) => (
            <Card key={c.key}>
              <CardContent className="flex flex-col gap-2 pt-5">
                <Label className="text-sm font-semibold">{c.label}</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={contacts[c.key] ?? ''}
                    onChange={(e) => setContacts((p) => ({ ...p, [c.key]: e.target.value }))}
                    placeholder="email@example.com"
                  />
                  <Button type="button" size="sm" onClick={() => saveContact(c.key)} className="shrink-0">Сохранить</Button>
                </div>
              </CardContent>
            </Card>
          ))}
          <Card>
            <CardContent className="flex flex-col gap-2 pt-5">
              <Label className="text-sm font-semibold">Инструкция для бухгалтера</Label>
              <p className="text-xs text-muted-foreground">Показывается сотруднику в задаче «Доступ бухгалтеру».</p>
              <Textarea
                value={contacts['instruction.accountant'] ?? ''}
                onChange={(e) => setContacts((p) => ({ ...p, ['instruction.accountant']: e.target.value }))}
                rows={3}
                placeholder="Текст инструкции…"
              />
              <div><Button type="button" size="sm" onClick={() => saveContact('instruction.accountant')}>Сохранить инструкцию</Button></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Контент: Знакомство с компанией (Этап 1 V2)</CardTitle>
              <CardDescription>Редактирование публичной страницы.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Заголовок</Label>
                <Input value={contacts['intro.title'] ?? ''} onChange={(e) => setContacts((p) => ({ ...p, 'intro.title': e.target.value }))} placeholder="Добро пожаловать в MDIGITAL" />
                <div><Button type="button" size="sm" variant="outline" onClick={() => saveContact('intro.title')}>Сохранить заголовок</Button></div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Миссия (подзаголовок)</Label>
                <Textarea value={contacts['intro.mission'] ?? ''} onChange={(e) => setContacts((p) => ({ ...p, 'intro.mission': e.target.value }))} rows={2} />
                <div><Button type="button" size="sm" variant="outline" onClick={() => saveContact('intro.mission')}>Сохранить миссию</Button></div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Ценности (JSON array)</Label>
                <Input value={contacts['intro.values'] ?? ''} onChange={(e) => setContacts((p) => ({ ...p, 'intro.values': e.target.value }))} placeholder='["Скорость", "Инновации"]' className="font-mono" />
                <div><Button type="button" size="sm" variant="outline" onClick={() => saveContact('intro.values')}>Сохранить ценности</Button></div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Инструкция</Label>
                <Textarea value={contacts['intro.instruction'] ?? ''} onChange={(e) => setContacts((p) => ({ ...p, 'intro.instruction': e.target.value }))} rows={3} />
                <div><Button type="button" size="sm" variant="outline" onClick={() => saveContact('intro.instruction')}>Сохранить инструкцию</Button></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Задачи Этапа 5 (Департаменты)</CardTitle>
              <CardDescription>Настройка задач по департаментам (JSON: [{`{"title": "Задача", "url": "https...", "xp": 100}`}])</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {['Frontend', 'Backend', 'Design'].map((dept) => {
                const key = `stage5.${dept.toLowerCase()}`;
                return (
                  <div key={dept} className="space-y-2">
                    <Label className="text-xs font-bold">{dept}</Label>
                    <Textarea
                      value={contacts[key] ?? ''}
                      onChange={(e) => setContacts((p) => ({ ...p, [key]: e.target.value }))}
                      rows={2}
                      className="font-mono text-xs"
                      placeholder='[{"title":"Пройти тест", "url":"link", "xp": 50}]'
                    />
                    <div><Button type="button" size="sm" variant="outline" onClick={() => saveContact(key)}>Сохранить {dept}</Button></div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="services" className="mt-4">
        <div className="flex flex-col gap-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{svcEditKey ? 'Редактировать сервис' : 'Добавить сервис'}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Input value={svcForm.key} onChange={(e) => setSvcForm((p) => ({ ...p, key: e.target.value }))} placeholder="key (slug)" disabled={!!svcEditKey} />
                <Input value={svcForm.title} onChange={(e) => setSvcForm((p) => ({ ...p, title: e.target.value }))} placeholder="Название" />
                <Input value={svcForm.url} onChange={(e) => setSvcForm((p) => ({ ...p, url: e.target.value }))} placeholder="URL" />
                <Select value={svcForm.icon_key} onValueChange={(v) => setSvcForm((p) => ({ ...p, icon_key: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['Link','ClipboardCheck','KeyRound','Send','Smartphone','Apple','BookOpen','Globe','Lock','Wifi','FileText','MessageSquare','ExternalLink','Download'].map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={svcForm.category} onValueChange={(v) => setSvcForm((p) => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['access','mpulse','knowledge'].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={svcForm.task_id ?? ''} onValueChange={(v) => setSvcForm((p) => ({ ...p, task_id: v || null }))}>
                  <SelectTrigger><SelectValue placeholder="Нет задачи (info)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Нет задачи (info)</SelectItem>
                    {['1-jira','1-figma','1-gitlab'].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <span className="text-xs text-muted-foreground">Роли:</span>
                {['frontend','backend','design'].map((r) => (
                  <Label key={r} className="flex items-center gap-1.5 text-xs font-normal">
                    <Checkbox checked={svcForm.roles.includes(r)} onCheckedChange={(c) => setSvcForm((p) => ({ ...p, roles: c === true ? [...p.roles, r] : p.roles.filter((x) => x !== r) }))} />
                    {r}
                  </Label>
                ))}
                <Label className="flex items-center gap-1.5 text-xs font-normal">
                  <Checkbox checked={svcForm.is_visible} onCheckedChange={(c) => setSvcForm((p) => ({ ...p, is_visible: c === true }))} />
                  Видимый
                </Label>
              </div>
              <Textarea
                value={svcForm.details}
                onChange={(e) => setSvcForm((p) => ({ ...p, details: e.target.value }))}
                placeholder="Подробная инструкция (показывается в модалке «Подробнее»)"
                rows={4}
              />
              <div>
                <Button type="button" size="sm" onClick={async () => {
                  if (!svcForm.key || !svcForm.title) { setMsg('key и title обязательны'); return; }
                  try {
                    const payload = { ...svcForm, task_id: !svcForm.task_id || svcForm.task_id === 'none' ? null : svcForm.task_id };
                    if (svcEditKey) {
                      await api.patch(`/api/admin/services/${svcEditKey}`, payload);
                      setMsg(`✓ «${svcForm.title}» обновлён`);
                    } else {
                      await api.post('/api/admin/services', payload);
                      setMsg(`✓ «${svcForm.title}» создан`);
                    }
                    setSvcForm({ key: '', title: '', subtitle: '', url: '', icon_key: 'Link', category: 'access', task_id: null, roles: [], sort_order: 0, is_visible: true, open_new_tab: true, extra: {}, details: '' });
                    setSvcEditKey(null);
                    await loadExtras();
                  } catch (e) { setMsg(e instanceof Error ? e.message : 'Ошибка'); }
                }}>{svcEditKey ? 'Обновить' : 'Добавить'}</Button>
              </div>
            </CardContent>
          </Card>
          {svcList.map((s) => (
            <Card key={s.key} className={cn(!s.is_visible && 'opacity-60')}>
              <CardContent className="flex flex-col gap-2 pt-5">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <b>{s.title}</b>
                  <Badge variant="secondary">{s.category}</Badge>
                  {s.task_id && <Badge variant="outline">{taskLabel(s.task_id)}</Badge>}
                  {!s.is_visible && <Badge variant="destructive">скрыт</Badge>}
                </div>
                <div className="text-xs text-muted-foreground">{s.subtitle} · {s.url || '—'} · icon: {s.icon_key} · roles: {s.roles.length ? s.roles.join(',') : 'все'}</div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => { setSvcForm({ ...s, task_id: s.task_id ?? '' }); setSvcEditKey(s.key); }}>Редактировать</Button>
                  <Button type="button" size="sm" variant="destructive" onClick={() => setSvcToDelete({ key: s.key, title: s.title })}>Удалить</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={async () => {
                    try { await api.patch(`/api/admin/services/${s.key}`, { is_visible: !s.is_visible }); setMsg(`✓ «${s.title}» ${s.is_visible ? 'скрыт' : 'показан'}`); await loadExtras(); } catch (e) { setMsg(e instanceof Error ? e.message : 'Ошибка'); }
                  }}>{s.is_visible ? 'Скрыть' : 'Показать'}</Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {!svcList.length && !loading && <p className="py-5 text-center text-sm text-muted-foreground">Сервисов пока нет</p>}
        </div>
      </TabsContent>

      <AlertDialog open={svcToDelete !== null} onOpenChange={(o) => { if (!o) setSvcToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить «{svcToDelete?.title}»?</AlertDialogTitle>
            <AlertDialogDescription>Действие нельзя отменить. Сервис пропадёт из каталога сотрудников.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              if (!svcToDelete) return;
              try {
                await api.del(`/api/admin/services/${svcToDelete.key}`);
                setMsg(`✓ «${svcToDelete.title}» удалён`);
                await loadExtras();
              } catch (e) { setMsg(e instanceof Error ? e.message : 'Ошибка'); }
              setSvcToDelete(null);
            }}>Удалить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TabsContent value="users" className="mt-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') search(); }} placeholder="email или имя" />
            <Button type="button" onClick={search} disabled={loading} className="shrink-0">Найти</Button>
          </div>
          <div className="flex flex-col gap-3">
            {users.map((u) => (
              <Card key={u.id}>
                <CardContent className="flex flex-col gap-3 pt-5">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <b>{u.name}</b> <span className="text-xs text-muted-foreground">{u.email}</span>
                    {u.is_staff && <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-300">staff</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">Stage 1: {u.done_stage1.length} задач · Лид: {u.lead_email || '— (глобальный)'}</div>
                  {renderTasks(u)}
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      value={leadForm[u.id] ?? u.lead_email}
                      onChange={(e) => setLeadForm((p) => ({ ...p, [u.id]: e.target.value }))}
                      placeholder="Email лида (пусто = глобальный)"
                    />
                    <Button type="button" size="sm" variant="outline" onClick={async () => {
                      try {
                        const updated = await api.patch<AdminUser>(`/api/admin/users/${u.id}/lead`, { lead_email: leadForm[u.id] ?? '' });
                        setUsers((prev) => prev.map((x) => (x.id === u.id ? updated : x)));
                        setMsg(`✓ Лид для ${u.email}: ${updated.lead_email || 'глобальный'}`);
                      } catch (e) {
                        setMsg(e instanceof Error ? e.message : 'Ошибка');
                      }
                    }} className="shrink-0">Лид</Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => toggleStaff(u)}>
                      {u.is_staff ? 'Снять staff' : 'Дать staff'}
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => genWifiPassword(u)}>
                      Wi-Fi пароль
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => verifyAllDocs(u)}>
                      <Check /> Все доки
                    </Button>
                  </div>
                  {wifiPw[u.id] && (
                    <Alert className="border-amber-500/40 bg-amber-500/10">
                      <AlertDescription className="text-amber-200">
                        <code className="font-mono text-sm text-foreground">{wifiPw[u.id]}</code>
                        {' '}— показан один раз, скопируйте и передайте сотруднику
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </TabsContent>

      <TabsContent value="audit" className="mt-4">
        <div className="flex flex-col gap-2">
          {audit.map((r) => (
            <Card key={r.id}>
              <CardContent className="pt-4 text-xs">
                <b>{taskLabel(r.task_id)}</b> · user #{r.user_id} · {r.method} · by #{r.verified_by ?? '—'} ·{' '}
                {r.created_at ? new Date(r.created_at).toLocaleString('ru-RU') : '—'}
                {prettyDetails(r.details) && <span className="text-muted-foreground"> · {prettyDetails(r.details)}</span>}
              </CardContent>
            </Card>
          ))}
          {!audit.length && !loading && <p className="py-5 text-center text-sm text-muted-foreground">Журнал пуст</p>}
        </div>
      </TabsContent>

      <TabsContent value="codes" className="mt-4">
        <div className="flex flex-col gap-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Ротация кода MPulse</CardTitle>
              <CardDescription>Новый код деактивирует предыдущие. Сообщите код сотрудникам.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="Новый код" />
                <Input value={newBatch} onChange={(e) => setNewBatch(e.target.value)} placeholder="Батч (напр. 09-2026)" />
                <Button type="button" onClick={rotateCode} className="shrink-0">Выпустить</Button>
              </div>
            </CardContent>
          </Card>
          {codes.map((c) => (
            <Card key={c.id}>
              <CardContent className="pt-4 text-xs">
                <b className="font-mono">{c.code}</b> · {c.batch_name || '—'} ·{' '}
                {c.is_active ? <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300">активен ✓</Badge> : <Badge variant="outline">неактивен</Badge>} ·{' '}
                {c.created_at ? new Date(c.created_at).toLocaleString('ru-RU') : '—'}
              </CardContent>
            </Card>
          ))}
          {!codes.length && !loading && <p className="py-5 text-center text-sm text-muted-foreground">Кодов в БД нет — действует MPULSE_VERIFICATION_CODE из env</p>}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Telegram-группы (auto-add)</CardTitle>
              <CardDescription>JSON: title + chat_id + roles (frontend/backend/design; пустой = всем). Бот должен быть админом (can_invite_users).</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Textarea value={tgGroupsJson} onChange={(e) => setTgGroupsJson(e.target.value)} rows={3} className="font-mono text-[11px]" placeholder='[{"title":"Dev","chat_id":"-100123"}]' />
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={saveTgGroups}>Сохранить группы</Button>
                <Button type="button" size="sm" variant="outline" onClick={checkTgRights}>Проверить права бота</Button>
                <Button type="button" size="sm" variant="outline" onClick={registerTgWebhook} disabled={tgWhRegistering}>
                  {tgWhRegistering && <LoaderCircle className="animate-spin" />}
                  {tgWhRegistering ? 'Регистрирую…' : 'Зарегистрировать webhook'}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={checkTgWhStatus}>Статус webhook</Button>
              </div>
              {tgWhStatus && (
                <div className="text-xs leading-relaxed">
                  <div>URL: <code className="font-mono">{tgWhStatus.url || '—'}</code></div>
                  <div>Ожидает апдейтов: <b>{tgWhStatus.pending_update_count ?? 0}</b></div>
                  {tgWhStatus.last_error_message && <div className="text-destructive">Последняя ошибка: {tgWhStatus.last_error_message}</div>}
                  {tgWhStatus.has_custom_certificate !== undefined && <div>Свой сертификат: {tgWhStatus.has_custom_certificate ? 'да' : 'нет (OK)'}</div>}
                </div>
              )}
              {tgRights && (
                <div className="text-xs leading-relaxed">
                  <div>Бот: @{tgRights.bot || '—'}</div>
                  {tgRights.groups.map((g: { title: string; chat_id?: string; ok: boolean; detail: string; roles?: string[] }) => (
                    <div key={g.title} className="flex flex-wrap items-center gap-2">
                      <span>{g.ok ? <Check className="mr-1 inline h-3 w-3 text-emerald-400" /> : <X className="mr-1 inline h-3 w-3 text-destructive" />}{g.title} [{(g.roles && g.roles.length ? g.roles : ['все']).join(',')}] — {g.detail}</span>
                      {g.chat_id && (
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={async () => {
                            try {
                              const cur = JSON.parse(tgGroupsJson || '[]') as { title: string; chat_id: string; roles?: string[] }[];
                              const rest = cur.filter((x) => String(x.chat_id) !== String(g.chat_id));
                              await api.patch('/api/admin/settings', { key: 'telegram.groups_json', value: JSON.stringify(rest), mode: 'replace' });
                              setMsg(`✓ Группа ${g.title} удалена`);
                              await loadTgGroups();
                            } catch (e) {
                              setMsg(e instanceof Error ? e.message : 'Ошибка удаления');
                            }
                          }}
                        >
                          Удалить
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Ссылки внешних систем</CardTitle>
              <CardDescription>Онбординг даёт ссылки, LDAP — настройки самих систем.</CardDescription>
            </CardHeader>
            <CardContent>
              {links && (
                <div className="text-xs leading-loose">
                  <div>Telegram: {links.telegram_invite_link || '— (TELEGRAM_INVITE_LINK)'}</div>
                  <div>Figma: {links.figma_team_url || '— (FIGMA_TEAM_URL)'}</div>
                  <div>Confluence: {links.confluence_url}</div>
                  <div>MPulse Android: {links.mpulse_android_url}</div>
                  <div>MPulse iOS: {links.mpulse_ios_url}</div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      </Tabs>
    </div>
  );
}
