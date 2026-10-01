import { useEffect, useState } from 'react';
import { Bell, BellDot, LogOut, Sparkles, User as UserIcon } from 'lucide-react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useOnboarding, getProgress } from '../../store/useOnboarding';
import { api } from '../../api/client';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Progress } from '../ui/progress';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import { cn } from '../../lib/utils';

export function DefaultAvatar({ size = 18 }: { size?: number }) {
  return <UserIcon size={size} className="text-muted-foreground" />;
}

export function TopBar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const user = useOnboarding((s) => s.user);
  const xp = useOnboarding((s) => s.xp);
  const doneTasks = useOnboarding((s) => s.doneTasks);
  const progress = getProgress(doneTasks);
  const lvl = Math.floor(xp / 100) + 1;
  const pct = Math.min(100, Math.max(0, progress.pct));
  const isDashboard = pathname === '/dashboard';
  const isStaff = user?.isStaff ?? false;
  const [pendingCount, setPendingCount] = useState(0);
  const unreadCount = useOnboarding((s) => s.unreadCount);
  const fetchNotifications = useOnboarding((s) => s.fetchNotifications);
  const markAllNotificationsRead = useOnboarding((s) => s.markAllNotificationsRead);
  const logout = useOnboarding((s) => s.logout);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifications = useOnboarding((s) => s.notifications);

  useEffect(() => {
    if (!isStaff) {
      setPendingCount(0);
      return;
    }
    let alive = true;
    const fetchCount = () => {
      api
        .get<{ pending: number }>('/api/admin/pending-count')
        .then((r) => {
          if (alive) setPendingCount(r.pending);
        })
        .catch(() => {});
    };
    fetchCount();
    const id = setInterval(fetchCount, 30000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [isStaff]);

  useEffect(() => {
    if (!isStaff) {
      fetchNotifications();
      const id = setInterval(fetchNotifications, 60000);
      return () => clearInterval(id);
    }
  }, [isStaff, fetchNotifications]);

  const onLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className={cn(
      'left-0 right-0 z-40 flex items-center justify-between px-4 transition-colors sm:px-10',
      isDashboard ? 'absolute top-0 h-[76px] border-b border-white/5 bg-transparent' : 'sticky top-0 h-[68px] border-b border-border bg-background/80 shadow-lg backdrop-blur-xl',
    )}>
      <nav className="flex items-center gap-2">
        <NavLink
          to="/dashboard"
          className={({ isActive }) => cn(
            'rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:px-4',
            isActive && 'bg-accent font-semibold text-foreground shadow-inner',
          )}
        >
          Dashboard
        </NavLink>
        <NavLink
          to="/stages"
          className={({ isActive }) => cn(
            'rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:px-4',
            isActive && 'bg-accent font-semibold text-foreground shadow-inner',
          )}
        >
          Onboarding
        </NavLink>
      </nav>

      <div className="flex items-center gap-2 sm:gap-3.5">
        {isStaff && (
          <Button variant="outline" size="icon" className="relative" onClick={() => navigate('/admin')} title="HR Panel: Pending Requests" aria-label="Open HR Panel">
            <Bell />
            {pendingCount > 0 && (
              <Badge variant="destructive" className="absolute -right-1.5 -top-1.5 h-[18px] min-w-[18px] rounded-full px-1 text-[10px]">
                {pendingCount > 99 ? '99+' : pendingCount}
              </Badge>
            )}
          </Button>
        )}

        {!isStaff && (
          <Popover open={notifOpen} onOpenChange={setNotifOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" className="relative" title="Уведомления" aria-label="Уведомления">
                {unreadCount > 0 ? <BellDot className="text-amber-400" /> : <Bell />}
                {unreadCount > 0 && (
                  <Badge variant="destructive" className="absolute -right-1.5 -top-1.5 h-[18px] min-w-[18px] rounded-full px-1 text-[10px]">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[340px] p-0" align="end">
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm font-bold">Уведомления</span>
                {unreadCount > 0 && (
                  <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => markAllNotificationsRead()}>
                    Прочитать все
                  </Button>
                )}
              </div>
              <Separator />
              <ScrollArea className="max-h-[360px]">
                {notifications.length === 0 && (
                  <div className="px-4 py-7 text-center text-xs text-muted-foreground">Нет уведомлений</div>
                )}
                {notifications.slice(0, 20).map((n) => (
                  <div
                    key={n.id}
                    className={cn('cursor-pointer border-b border-border/50 px-4 py-2.5 transition-colors last:border-0 hover:bg-accent/50', !n.read && 'border-l-[3px] border-l-primary bg-primary/5')}
                    onClick={() => { if (!n.read) useOnboarding.getState().markNotificationRead(n.id); }}
                  >
                    <div className="mb-0.5 text-xs font-semibold">{n.title}</div>
                    {n.body && <div className="text-[11px] leading-snug text-muted-foreground">{n.body}</div>}
                    {n.created_at && <div className="mt-1 text-[10px] tabular-nums text-muted-foreground/70">{new Date(n.created_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>}
                  </div>
                ))}
              </ScrollArea>
            </PopoverContent>
          </Popover>
        )}

        <div className="hidden min-w-[120px] flex-col gap-1.5 rounded-xl border border-border bg-card/60 px-3.5 py-1.5 backdrop-blur md:flex" title={`${xp} XP · ${progress.done}/5 Tasks Completed`}>
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary">
              <Sparkles className="h-3 w-3" /> Lv.{lvl}
            </span>
            <span className="text-[11px] font-semibold text-muted-foreground">
              {xp >= 1000 ? `${(xp / 1000).toFixed(1)}k` : xp} <small className="text-[9px] font-bold uppercase">XP</small>
            </span>
          </div>
          <Progress value={pct} className="h-1" />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2.5 rounded-full py-1 pl-1 pr-3.5" aria-label="Open Profile">
              <Avatar className="h-8 w-8">
                {user?.avatar ? <AvatarImage src={user.avatar} alt={user.name || 'User Avatar'} /> : null}
                <AvatarFallback className="bg-secondary">
                  <DefaultAvatar />
                </AvatarFallback>
              </Avatar>
              <span className="hidden max-w-[100px] overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-semibold sm:inline">
                {user?.name?.split(' ')[0] || 'Guest'}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="truncate">{user?.email || 'Guest'}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/profile')}>
              <UserIcon /> Профиль
            </DropdownMenuItem>
            {isStaff && (
              <DropdownMenuItem onClick={() => navigate('/admin')}>
                <Bell /> HR-панель
                {pendingCount > 0 && <Badge variant="destructive" className="ml-auto h-5 min-w-5 px-1 text-[10px]">{pendingCount}</Badge>}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onLogout}>
              <LogOut /> Выйти
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
