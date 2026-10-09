import { useState, type ReactNode } from 'react';
import {
  BarChart3, FolderKanban, Hourglass, Inbox, KeyRound, Layers, Menu,
  RefreshCw, ScrollText, Send, Settings, Users, Wifi, Blocks,
} from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../ui/sheet';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '../../lib/utils';

export type AdminTabId =
  | 'applications' | 'analytics' | 'outbox' | 'pending' | 'users' | 'audit'
  | 'codes' | 'wifi' | 'settings' | 'services' | 'stages' | 'projects';

export interface AdminNavItem {
  id: AdminTabId;
  label: string;
  icon: ReactNode;
  count?: number;
  accent?: boolean;
}

export interface AdminNavGroup {
  title: string;
  items: AdminNavItem[];
}

const ICON_CLS = 'h-4 w-4 shrink-0';

export function adminNav(counts: { applications: number; pending: number; audit: number; services: number }): AdminNavGroup[] {
  return [
    {
      title: 'Рекрутинг',
      items: [
        { id: 'applications', label: 'Заявки', icon: <Inbox className={ICON_CLS} />, count: counts.applications, accent: counts.applications > 0 },
      ],
    },
    {
      title: 'Команда',
      items: [
        { id: 'pending', label: 'Ожидают проверки', icon: <Hourglass className={ICON_CLS} />, count: counts.pending, accent: counts.pending > 0 },
        { id: 'users', label: 'Сотрудники и права', icon: <Users className={ICON_CLS} /> },
        { id: 'projects', label: 'Проекты', icon: <FolderKanban className={ICON_CLS} /> },
        { id: 'wifi', label: 'Wi-Fi запросы', icon: <Wifi className={ICON_CLS} /> },
      ],
    },
    {
      title: 'Контент',
      items: [
        { id: 'stages', label: 'Этапы', icon: <Layers className={ICON_CLS} /> },
        { id: 'services', label: 'Сервисы и ссылки', icon: <Blocks className={ICON_CLS} />, count: counts.services },
        { id: 'settings', label: 'Настройки и тексты', icon: <Settings className={ICON_CLS} /> },
        { id: 'codes', label: 'Коды и интеграции', icon: <KeyRound className={ICON_CLS} /> },
      ],
    },
    {
      title: 'Мониторинг',
      items: [
        { id: 'analytics', label: 'Аналитика', icon: <BarChart3 className={ICON_CLS} /> },
        { id: 'audit', label: 'Журнал', icon: <ScrollText className={ICON_CLS} /> },
        { id: 'outbox', label: 'Очередь писем', icon: <Send className={ICON_CLS} /> },
      ],
    },
  ];
}

function NavList({ groups, active, onPick }: { groups: AdminNavGroup[]; active: AdminTabId; onPick: (id: AdminTabId) => void }) {
  return (
    <div className="flex flex-col gap-4">
      {groups.map((g) => (
        <div key={g.title}>
          <div className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/80">
            {g.title}
          </div>
          <div className="flex flex-col gap-0.5">
            {g.items.map((it) => (
              <button
                key={it.id}
                type="button"
                onClick={() => onPick(it.id)}
                className={cn(
                  'flex min-h-[44px] items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition-all',
                  active === it.id
                    ? 'bg-primary/15 font-semibold text-foreground shadow-[inset_0_0_0_1px_var(--border-strong),0_0_18px_rgba(37,99,235,0.25)]'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground active:scale-[0.98]',
                )}
              >
                <span className={cn(active === it.id ? 'text-primary' : it.accent ? 'text-amber-400' : '')}>{it.icon}</span>
                <span className="flex-1">{it.label}</span>
                {(it.count ?? 0) > 0 && (
                  <Badge variant={it.accent ? 'destructive' : 'secondary'} className="h-5 min-w-5 px-1.5 text-[10px]">
                    {it.count! > 99 ? '99+' : it.count}
                  </Badge>
                )}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function AdminShell({
  groups, active, onChange, liveOn, onRefresh, refreshing, children,
}: {
  groups: AdminNavGroup[];
  active: AdminTabId;
  onChange: (id: AdminTabId) => void;
  liveOn: boolean;
  onRefresh: () => void;
  refreshing: boolean;
  children: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const current = groups.flatMap((g) => g.items).find((i) => i.id === active);

  const pick = (id: AdminTabId) => {
    setMenuOpen(false);
    onChange(id);
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-3 py-4 pb-24 sm:px-4 lg:flex-row lg:items-start">
      {/* Desktop sidebar */}
      <aside className="sticky top-[84px] hidden w-60 shrink-0 lg:block">
        <div className="glass-strong rounded-2xl p-3">
          <AdminShellHeader liveOn={liveOn} onRefresh={onRefresh} refreshing={refreshing} compact />
          <div className="mt-3">
            <NavList groups={groups} active={active} onPick={pick} />
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden">
        <div className="glass-strong flex min-h-[56px] items-center gap-2 rounded-2xl px-3 py-2">
          <Button type="button" variant="ghost" size="icon" className="min-h-[44px] min-w-[44px]" onClick={() => setMenuOpen(true)} aria-label="Меню админки">
            <Menu />
          </Button>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="text-primary">{current?.icon}</span>
            <span className="truncate text-sm font-bold">{current?.label ?? 'Админка'}</span>
            {(current?.count ?? 0) > 0 && (
              <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-[10px]">
                {current!.count! > 99 ? '99+' : current!.count}
              </Badge>
            )}
          </div>
          <span className={cn(
            'rounded-full px-2 py-1 text-[10px] font-bold',
            liveOn ? 'bg-emerald-500/15 text-emerald-300' : 'bg-muted text-muted-foreground',
          )}>
            {liveOn ? '● live' : '○ poll'}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">{children}</div>

      {/* Mobile drawer — выезжает слева */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="flex flex-col gap-3 overflow-hidden">
          <SheetHeader>
            <SheetTitle>HR-панель · разделы</SheetTitle>
          </SheetHeader>
          <ScrollArea className="min-h-0 flex-1 pr-2">
            <NavList groups={groups} active={active} onPick={pick} />
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export function AdminShellHeader({ liveOn, onRefresh, refreshing, compact }: { liveOn: boolean; onRefresh: () => void; refreshing: boolean; compact?: boolean }) {
  return (
    <div className={cn('flex items-center gap-2', compact ? '' : 'flex-wrap')}>
      <h1 className={cn('font-extrabold tracking-tight', compact ? 'text-sm' : 'text-lg')}>HR-панель</h1>
      <Badge variant="outline" className={cn(liveOn ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'text-muted-foreground')}>
        {liveOn ? '● live' : '○ polling'}
      </Badge>
      <Button type="button" size="sm" variant="ghost" onClick={onRefresh} disabled={refreshing} className="ml-auto min-h-[40px]" aria-label="Обновить данные">
        <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
      </Button>
    </div>
  );
}
