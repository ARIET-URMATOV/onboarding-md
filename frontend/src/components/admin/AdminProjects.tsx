import { useCallback, useEffect, useState } from 'react';
import { FolderKanban, LoaderCircle, Plus, RefreshCw, UserPlus } from 'lucide-react';
import { api } from '../../api/client';
import { useToast } from '../ui/ToastProvider';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { cn } from '../../lib/utils';

interface ProjectRow {
  id: number;
  name: string;
  client: string;
  category: string;
  is_active: boolean;
  members: number;
  docs: number;
}

interface MemberRow {
  user_id: number;
  email: string;
  name: string;
  role: string;
  responsibility: string;
  contact_tg: string;
  is_mentor: boolean;
}

const CATEGORY_LABEL: Record<string, string> = {
  product: 'Продуктовая', fintech: 'Финтех', near_product: 'Околопродуктовая',
};

export function AdminProjects() {
  const toast = useToast();
  const [rows, setRows] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [memberOpen, setMemberOpen] = useState<number | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);

  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [category, setCategory] = useState('product');
  const [description, setDescription] = useState('');

  const [mUserId, setMUserId] = useState('');
  const [mRole, setMRole] = useState('dev');
  const [mResp, setMResp] = useState('');
  const [mTg, setMTg] = useState('');
  const [mMentor, setMMentor] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await api.get<ProjectRow[]>('/api/admin/projects'));
    } catch (e) {
      toast.error('Ошибка загрузки проектов', e instanceof Error ? e.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  const loadMembers = async (pid: number) => {
    try {
      setMembers(await api.get<MemberRow[]>(`/api/admin/projects/${pid}/members`));
    } catch { setMembers([]); }
  };

  const openMembers = (pid: number) => {
    setMemberOpen(pid);
    void loadMembers(pid);
  };

  const create = async () => {
    if (!name.trim()) { toast.warning('Введите название проекта'); return; }
    try {
      const r = await api.post<{ id: number }>('/api/admin/projects', {
        name: name.trim(), client: client.trim(), category, description: description.trim(),
      });
      toast.success(`Проект «${name.trim()}» создан`, `ID #${r.id} — заполните карточку и команду`);
      setName(''); setClient(''); setDescription(''); setCategory('product');
      setCreateOpen(false);
      await load();
    } catch (e) {
      toast.error('Ошибка создания', e instanceof Error ? e.message : undefined);
    }
  };

  const addMember = async () => {
    if (memberOpen == null || !mUserId.trim()) { toast.warning('Введите user_id сотрудника'); return; }
    try {
      await api.post(`/api/admin/projects/${memberOpen}/members`, {
        user_id: Number(mUserId), role: mRole,
        responsibility: mResp.trim(), contact_tg: mTg.trim(), is_mentor: mMentor,
      });
      toast.success('Сотрудник назначен', 'Этап 6 открыт для него');
      setMUserId(''); setMResp(''); setMTg(''); setMMentor(false); setMRole('dev');
      await loadMembers(memberOpen);
      await load();
    } catch (e) {
      toast.error('Ошибка назначения', e instanceof Error ? e.message : undefined);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-2 text-base font-extrabold">
          <FolderKanban className="h-5 w-5 text-primary" /> Проекты · этап 6
        </h2>
        <div className="ml-auto flex gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={() => void load()} disabled={loading} className="min-h-[44px]" aria-label="Обновить список проектов">
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
          <Button type="button" size="sm" onClick={() => setCreateOpen(true)} className="min-h-[44px]">
            <Plus className="h-4 w-4" /> Новый проект
          </Button>
        </div>
      </div>

      {loading && !rows.length && (
        <p className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
          <LoaderCircle className="h-4 w-4 animate-spin" /> Загрузка проектов…
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {rows.map((p) => (
          <Card key={p.id} className={cn(!p.is_active && 'opacity-60')}>
            <CardContent className="flex flex-col gap-2.5 pt-5">
              <div className="flex items-start gap-2.5">
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarFallback className="bg-primary/15 font-bold text-primary">
                    {p.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">{p.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {p.client || '—'} · #{p.id}
                  </div>
                </div>
                <Badge variant="outline" className="shrink-0 text-[10px]">
                  {CATEGORY_LABEL[p.category] ?? p.category}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-1.5 text-[11px]">
                <Badge variant="secondary">👥 {p.members}</Badge>
                <Badge variant="secondary">📄 {p.docs}</Badge>
                {!p.is_active && <Badge variant="destructive">архив</Badge>}
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => openMembers(p.id)} className="min-h-[44px] flex-1">
                  <UserPlus className="h-4 w-4" /> Команда и назначение
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!loading && !rows.length && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Проектов пока нет. Создайте первый — PM заполнит карточку, дальше её получит каждый новичок.
          </CardContent>
        </Card>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Новый проект</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="space-y-1.5">
              <Label>Название *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Напр. MBusiness" className="min-h-[48px] text-base" />
            </div>
            <div className="space-y-1.5">
              <Label>Клиент / продукт</Label>
              <Input value={client} onChange={(e) => setClient(e.target.value)} placeholder="Напр. Внутренний продукт" className="min-h-[48px] text-base" />
            </div>
            <div className="space-y-1.5">
              <Label>Категория</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="min-h-[48px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="product">Продуктовая</SelectItem>
                  <SelectItem value="fintech">Финтех</SelectItem>
                  <SelectItem value="near_product">Околопродуктовая</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Краткое описание</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Чем занимается проект…" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)} className="min-h-[48px]">Отмена</Button>
            <Button type="button" onClick={() => void create()} className="min-h-[48px]">Создать проект</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Members dialog */}
      <Dialog open={memberOpen != null} onOpenChange={(o) => { if (!o) setMemberOpen(null); }}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Команда проекта #{memberOpen}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {members.map((m) => (
              <div key={m.user_id} className="flex items-center gap-2.5 rounded-xl border border-border bg-card/60 px-3 py-2">
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarFallback className="bg-secondary text-xs font-bold">{m.name.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{m.name}</div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {m.role} · {m.responsibility || '—'} {m.is_mentor ? '· ⭐ ментор' : ''}
                  </div>
                </div>
              </div>
            ))}
            {!members.length && <p className="py-2 text-center text-xs text-muted-foreground">Участников пока нет</p>}
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Назначить сотрудника</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2.5">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">user_id *</Label>
                  <Input value={mUserId} onChange={(e) => setMUserId(e.target.value)} inputMode="numeric" placeholder="123" className="min-h-[48px] text-base" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Роль</Label>
                  <Select value={mRole} onValueChange={setMRole}>
                    <SelectTrigger className="min-h-[48px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['pm', 'lead', 'dev', 'design', 'qa'].map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Зона ответственности</Label>
                <Input value={mResp} onChange={(e) => setMResp(e.target.value)} placeholder="Напр. платежи и чеки" className="min-h-[48px] text-base" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Telegram для связи</Label>
                <Input value={mTg} onChange={(e) => setMTg(e.target.value)} placeholder="@username" className="min-h-[48px] text-base" />
              </div>
              <label className="flex min-h-[44px] items-center gap-2 text-sm">
                <input type="checkbox" checked={mMentor} onChange={(e) => setMMentor(e.target.checked)} className="h-5 w-5 accent-blue-600" />
                Ментор новичка
              </label>
            </CardContent>
          </Card>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setMemberOpen(null)} className="min-h-[48px]">Готово</Button>
            <Button type="button" onClick={() => void addMember()} className="min-h-[48px]">Назначить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
