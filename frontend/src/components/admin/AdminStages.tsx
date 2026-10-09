import { useEffect, useMemo, useState } from 'react';
import { LoaderCircle, Plus, Save } from 'lucide-react';
import { api } from '../../api/client';
import { useOnboarding } from '../../store/useOnboarding';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';

interface StageTask {
  id: string;
  stage_id: number;
  title: string;
  xp: number;
  sort_order: number;
  verification_type: string;
  responsible_role: string;
  department: string | null;
}

const DEPTS = ['Frontend', 'Backend', 'Design'];
const VTYPES = ['info_read', 'manual_hr', 'manual_staff', 'technical_code', 'technical_password', 'technical_timer', 'self_link', 'self'];

const inputCls = 'h-8 text-xs';
const selectCls = 'h-8 rounded-md border border-input bg-background px-2 text-xs';

/** Вкладка «Этапы» (FR-407): лиды и HR редактируют задачи этапов —
 *  тексты, XP, тип проверки и привязку к департаменту. Ссылки
 *  (репозиторий, Figma, style guide) живут во вкладке «Сервисы». */
export function AdminStages() {
  const me = useOnboarding((s) => s.user);
  const leadOnly = !!me?.isLead && !me?.isStaff;
  const myDept = typeof me?.department === 'string' ? me.department : me?.department?.display_name ?? '';
  const [tasks, setTasks] = useState<StageTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [dept, setDept] = useState<string>('all');
  const [draft, setDraft] = useState<Record<string, Partial<StageTask>>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({ id: '', stage_id: 4, title: '', xp: 0, verification_type: 'info_read', department: 'Frontend' });

  const load = () => {
    setLoading(true);
    api.get<StageTask[]>('/api/admin/stage-tasks')
      .then((r) => setTasks(Array.isArray(r) ? r : []))
      .catch((e) => setErr(e instanceof Error ? e.message : 'Ошибка загрузки'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);
  // Лид без staff работает только в своём департаменте (FR-407).
  useEffect(() => {
    if (leadOnly && myDept && DEPTS.includes(myDept)) setDept(myDept);
  }, [leadOnly, myDept]);

  const filtered = useMemo(() => {
    if (dept === 'all') return tasks;
    if (dept === 'shared') return tasks.filter((t) => !t.department);
    return tasks.filter((t) => t.department === dept);
  }, [tasks, dept]);

  const patch = async (id: string) => {
    const d = draft[id];
    if (!d || Object.keys(d).length === 0) return;
    setSaving(id);
    setErr(null);
    try {
      const updated = await api.patch<StageTask>(`/api/admin/stage-tasks/${encodeURIComponent(id)}`, d);
      setTasks((ts) => ts.map((t) => (t.id === id ? updated : t)));
      setDraft((dr) => { const n = { ...dr }; delete n[id]; return n; });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ошибка сохранения');
    } finally {
      setSaving(null);
    }
  };

  const create = async () => {
    const deptValue = leadOnly ? myDept : form.department;
    if (!form.id.trim() || !form.title.trim()) { setErr('Укажи id и название задачи'); return; }
    setCreating(true);
    setErr(null);
    try {
      const created = await api.post<StageTask>('/api/admin/stage-tasks', {
        id: form.id.trim(), stage_id: form.stage_id, title: form.title.trim(),
        xp: form.xp, sort_order: tasks.length, verification_type: form.verification_type,
        responsible_role: '', department: deptValue || null,
      });
      setTasks((ts) => [...ts, created]);
      setForm({ id: '', stage_id: 4, title: '', xp: 0, verification_type: 'info_read', department: 'Frontend' });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ошибка создания');
    } finally {
      setCreating(false);
    }
  };

  const set = (id: string, k: keyof StageTask, v: string | number | null) =>
    setDraft((dr) => ({ ...dr, [id]: { ...dr[id], [k]: v } }));

  if (loading) return <div className="grid place-items-center py-10 text-muted-foreground"><LoaderCircle className="animate-spin" /></div>;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Задачи этапов</CardTitle>
          <CardDescription className="text-xs">Этап 4 (департамент) ведут лиды; остальное — HR. Ссылки — во вкладке «Сервисы».</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5">
            {(leadOnly ? [myDept] : ['all', 'shared', ...DEPTS]).map((d) => (
              <Button key={d} variant={dept === d ? 'default' : 'outline'} size="sm" onClick={() => setDept(d)}>
                {d === 'all' ? 'Все' : d === 'shared' ? 'Общие' : d}
              </Button>
            ))}
          </div>
          {err && <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{err}</div>}
          <div className="flex flex-col gap-2">
            {filtered.map((t) => {
              const d = draft[t.id] ?? {};
              const dirty = Object.keys(d).length > 0;
              return (
                <div key={t.id} className="grid gap-2 rounded-xl border border-border bg-card/60 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">Этап {t.stage_id}</Badge>
                    <span className="font-mono text-[11px] text-muted-foreground">{t.id}</span>
                    <Badge variant="outline" className="text-[10px]">{t.department ?? 'общая'}</Badge>
                    {dirty && (
                      <Button size="sm" className="ml-auto h-7 gap-1.5 text-xs" onClick={() => patch(t.id)} disabled={saving === t.id}>
                        {saving === t.id ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        Сохранить
                      </Button>
                    )}
                  </div>
                  <Input className={inputCls} value={d.title ?? t.title} onChange={(e) => set(t.id, 'title', e.target.value)} />
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">Этап
                      <select className={selectCls} value={d.stage_id ?? t.stage_id} onChange={(e) => set(t.id, 'stage_id', Number(e.target.value))}>
                        {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">XP
                      <Input className={inputCls} type="number" min={0} max={500} value={d.xp ?? t.xp} onChange={(e) => set(t.id, 'xp', Number(e.target.value))} />
                    </label>
                    <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">Порядок
                      <Input className={inputCls} type="number" min={0} value={d.sort_order ?? t.sort_order} onChange={(e) => set(t.id, 'sort_order', Number(e.target.value))} />
                    </label>
                    <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">Проверка
                      <select className={selectCls} value={d.verification_type ?? t.verification_type} onChange={(e) => set(t.id, 'verification_type', e.target.value)}>
                        {VTYPES.map((v) => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">Департамент
                      <select className={selectCls} disabled={leadOnly} value={d.department ?? t.department ?? ''} onChange={(e) => set(t.id, 'department', e.target.value || null)}>
                        <option value="">общая</option>
                        {DEPTS.map((x) => <option key={x} value={x}>{x}</option>)}
                      </select>
                    </label>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && <div className="py-6 text-center text-xs text-muted-foreground">Нет задач</div>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Новая задача</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          <Input className={inputCls} placeholder="id (латиница, напр. 5-git)" value={form.id} onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))} />
          <Input className={inputCls} placeholder="Название" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">Этап
            <select className={selectCls} value={form.stage_id} onChange={(e) => setForm((f) => ({ ...f, stage_id: Number(e.target.value) }))}>
              {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">XP
            <Input className={inputCls} type="number" min={0} max={500} value={form.xp} onChange={(e) => setForm((f) => ({ ...f, xp: Number(e.target.value) }))} />
          </label>
          <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">Проверка
            <select className={selectCls} value={form.verification_type} onChange={(e) => setForm((f) => ({ ...f, verification_type: e.target.value }))}>
              {VTYPES.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">Департамент
            <select className={selectCls} value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}>
              {DEPTS.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </label>
          <Button className="gap-2 sm:col-span-2" onClick={create} disabled={creating}>
            {creating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Создать задачу
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
