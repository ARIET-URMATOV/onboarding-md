import { create } from 'zustand';
import { api, type MeResponse, type ProgressResponse, type UserResponse } from '../api/client';
import { STAGES } from '../data/stages';
import type { StageId, Role } from '../data/stages';

export type StageStatus = 'locked' | 'current' | 'done';

export interface SlaStatus {
  deadline: string;
  days_left: number;
  total_days: number;
  status: 'active' | 'due_today' | 'overdue' | 'done' | 'done_late';
  started_at: string;
}

export interface NotificationItem {
  id: number;
  kind: string;
  title: string;
  body: string;
  meta: Record<string, unknown>;
  created_at: string | null;
  read: boolean;
}

interface User {
  id: number;
  email: string;
  name: string;
  avatar: string | null;
  createdAt?: string | null;
  isStaff?: boolean;
  telegramUsername?: string;
  department?: string | null;
  position?: string | null;
  office?: string | null;
  ad_login?: string | null;
  oidc_sub?: string | null;
}

interface OnboardingState {
  user: User | null;
  role: Role | null;
  introSeen: boolean;
  voiceEnabled: boolean;
  doneTasks: Record<StageId, string[]>;
  xp: number;
  level: number;
  completedAt: string | null;
  createdAt: string | null;
  hydrated: boolean;
  pending: string[];
  rejected: { task_id: string; note: string }[];
  lastVerifiedAt: number | null;
  lastVerifiedTask: string | null;
  sla: SlaStatus | null;
  unreadCount: number;
  notifications: NotificationItem[];
  // actions
  hydrate: (me: MeResponse) => void;
  refreshMe: () => Promise<void>;
  fetchPending: () => Promise<void>;
  login: (me: MeResponse) => void;
  logout: () => Promise<void>;
  setRole: (r: Role) => Promise<void>;
  updateProfile: (patch: { name?: string; avatar?: string | null }) => Promise<void>;
  toggleTask: (stageId: StageId, taskId: string) => Promise<void>;
  requestTask: (taskId: string, note?: string) => Promise<void>;
  completeStage: (stageId: StageId) => Promise<void>;
  uncompleteStage: (stageId: StageId) => Promise<void>;
  markIntroSeen: () => Promise<void>;
  setVoiceEnabled: (enabled: boolean) => Promise<void>;
  connectLive: () => () => void;
  consumeVerified: () => void;
  fetchNotifications: () => Promise<void>;
  markNotificationRead: (id: number) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
}

let liveSocket: WebSocket | null = null;

function wsUrl(path: string): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}${path}`;
}

const emptyTasks = (): Record<StageId, string[]> => ({
  1: [], 2: [], 3: [], 4: [], 5: [],
});

// Сервер-авторитетный пересчёт XP (зеркало server/stages_data.py) — для optimistic update
const xpFromTasks = (doneTasks: Record<StageId, string[]>): number => {
  let total = 0;
  for (const stage of STAGES) {
    const done = doneTasks[stage.id] || [];
    for (const t of stage.subTasks) {
      if (done.includes(t.id)) total += t.xp;
    }
    if (stage.subTasks.every((t) => done.includes(t.id))) total += stage.xpReward;
  }
  return total;
};

export const useOnboarding = create<OnboardingState>()((set, get) => ({
  user: null,
  role: null,
  introSeen: false,
  voiceEnabled: true,
  doneTasks: emptyTasks(),
  xp: 0,
  level: 1,
  completedAt: null,
  createdAt: null,
  hydrated: false,
  pending: [],
  rejected: [],
  lastVerifiedAt: null,
  lastVerifiedTask: null,
  sla: null,
  unreadCount: 0,
  notifications: [],

  hydrate: (me) =>
    set({
      user: { 
        id: me.user.id, 
        email: me.user.email, 
        name: me.user.name, 
        avatar: me.user.avatar, 
        createdAt: me.user.created_at, 
        isStaff: me.user.is_staff ?? false, 
        telegramUsername: me.user.telegram_username ?? '',
        department: me.user.department,
        position: me.user.position,
        office: me.user.office,
        ad_login: me.user.ad_login,
        oidc_sub: me.user.oidc_sub,
      },
      role: me.user.role,
      introSeen: me.user.intro_seen,
      voiceEnabled: me.user.voice_enabled,
      doneTasks: { ...emptyTasks(), ...me.progress.done_tasks } as Record<StageId, string[]>,
      xp: me.progress.xp,
      level: me.progress.level ?? Math.floor(me.progress.xp / 100) + 1,
      completedAt: me.progress.completed_at ?? null,
      createdAt: me.user.created_at ?? null,
      hydrated: true,
      sla: (me as any).sla ?? null,
      unreadCount: (me as any).unread_count ?? 0,
    }),

  refreshMe: async () => {
    const me = await api.get<MeResponse>('/api/me');
    get().hydrate(me);
    await get().fetchPending();
  },

  fetchPending: async () => {
    try {
      const r = await api.get<{ pending: string[]; rejected?: { task_id: string; note: string }[] }>('/api/progress/pending');
      set({ pending: r.pending, rejected: r.rejected ?? [] });
    } catch { /* не критично */ }
  },

  login: (me) => {
    get().hydrate(me);
    void get().fetchPending();
    // Fetch full /me to get SLA + notifications (demo_login/me_out doesn't include them)
    void get().refreshMe();
  },

  logout: async () => {
    try { await api.post('/api/logout'); } catch { /* cookie уже могла истечь */ }
    if (liveSocket) { liveSocket.close(); liveSocket = null; }
    set({
      user: null, role: null, introSeen: false, voiceEnabled: true,
      doneTasks: emptyTasks(), xp: 0, level: 1, completedAt: null, hydrated: true, pending: [], rejected: [],
    });
  },
  setRole: async (r) => {
    const prev = get().role;
    set({ role: r });
    try {
      await api.post('/api/role', { role: r });
    } catch (e) {
      set({ role: prev });
      throw e;
    }
  },

  updateProfile: async (patch) => {
    const prevUser = get().user;
    if (prevUser) {
      set({
        user: {
          ...prevUser,
          name: patch.name !== undefined ? patch.name : prevUser.name,
          avatar: patch.avatar !== undefined ? patch.avatar : prevUser.avatar,
        },
      });
    }
    try {
      const u = await api.patch<UserResponse>('/api/profile', patch);
      if (get().user) {
        set({ user: { id: u.id, email: u.email, name: u.name, avatar: u.avatar } });
      }
    } catch (e) {
      if (prevUser) set({ user: prevUser });
      throw e;
    }
  },

  requestTask: async (taskId, note) => {
    // Запрос на верификацию вместо свободного toggle (Stage 1 manual_*).
    // XP не меняется — сервер вернёт текущий прогресс; обновляем pending.
    const res = await api.post<ProgressResponse>('/api/progress/request', { task_id: taskId, note: note ?? '' });
    set({
      doneTasks: { ...emptyTasks(), ...res.done_tasks } as Record<StageId, string[]>,
      xp: res.xp,
      level: res.level,
      completedAt: res.completed_at,
    });
    await get().fetchPending();
  },

  consumeVerified: () => {
    // Событие consumed один раз — повторный mount (навигация) не replay'ит тост.
    set({ lastVerifiedAt: null, lastVerifiedTask: null });
  },

  connectLive: () => {
    // Live-лента сотрудника: HR подтвердил → обновить прогресс без рефреша + уведомления.
    if (liveSocket) return () => undefined;
    try {
      const ws = new WebSocket(wsUrl('/ws/me'));
      liveSocket = ws;
      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data as string);
          if (data && (data.type === 'verified' || data.type === 'verified_batch' || data.type === 'rejected' || data.type === 'wifi_password')) {
            if (data.type === 'verified' && typeof data.task_id === 'string') {
              set({ lastVerifiedAt: Date.now(), lastVerifiedTask: data.task_id });
            } else if (data.type === 'verified_batch' && Array.isArray(data.task_ids) && data.task_ids.length) {
              set({ lastVerifiedAt: Date.now(), lastVerifiedTask: String(data.task_ids[0]) });
            }
            void get().refreshMe();
          } else if (data && data.type === 'notification' && data.notification) {
            // WS уведомление: обновить unreadCount и список
            set((s) => ({
              unreadCount: s.unreadCount + 1,
              notifications: [
                { ...data.notification, read: false } as NotificationItem,
                ...s.notifications,
              ].slice(0, 50),
            }));
          }
        } catch { /* ignore */ }
      };
      ws.onclose = () => { if (liveSocket === ws) liveSocket = null; };
      ws.onerror = () => { try { ws.close(); } catch { /* ignore */ } };
    } catch { /* WS недоступен — polling fallback */ }
    return () => undefined;
  },

  toggleTask: async (stageId, taskId) => {
    if (!get().role) throw new Error('Сначала выберите роль');
    const prevTasks = get().doneTasks;
    const prevXp = get().xp;
    const prevLevel = get().level;
    const cur = prevTasks[stageId] || [];
    const next = cur.includes(taskId) ? cur.filter((t) => t !== taskId) : [...cur, taskId];
    const optimistic = { ...prevTasks, [stageId]: next };
    const optXp = xpFromTasks(optimistic);
    set({ doneTasks: optimistic, xp: optXp, level: Math.floor(optXp / 100) + 1 });
    try {
      const res = await api.post<ProgressResponse>('/api/progress/task', { stage_id: stageId, task_id: taskId });
      set({
        doneTasks: { ...emptyTasks(), ...res.done_tasks } as Record<StageId, string[]>,
        xp: res.xp,
        level: res.level,
        completedAt: res.completed_at,
      });
    } catch (e) {
      set({ doneTasks: prevTasks, xp: prevXp, level: prevLevel });
      throw e;
    }
  },

  completeStage: async (stageId) => {
    if (!get().role) throw new Error('Сначала выберите роль');
    const stage = STAGES.find((s) => s.id === stageId);
    if (!stage) return;
    const prevTasks = get().doneTasks;
    const prevXp = get().xp;
    const prevLevel = get().level;
    const cur = prevTasks[stageId] || [];
    const allTaskIds = stage.subTasks.map((t) => t.id);
    const missing = allTaskIds.filter((id) => !cur.includes(id));
    // Этап 1 закрывается только через scroll-gate всех документов
    if (stageId === 1 && missing.length > 0) return;
    const optimistic = { ...prevTasks, [stageId]: allTaskIds };
    const optXp = xpFromTasks(optimistic);
    set({ doneTasks: optimistic, xp: optXp, level: Math.floor(optXp / 100) + 1 });
    try {
      const res = await api.post<ProgressResponse>('/api/progress/stage', { stage_id: stageId, action: 'complete' });
      set({
        doneTasks: { ...emptyTasks(), ...res.done_tasks } as Record<StageId, string[]>,
        xp: res.xp,
        level: res.level,
        completedAt: res.completed_at,
      });
    } catch (e) {
      set({ doneTasks: prevTasks, xp: prevXp, level: prevLevel });
      throw e;
    }
  },

  uncompleteStage: async (stageId) => {
    if (!get().role) throw new Error('Сначала выберите роль');
    const stage = STAGES.find((s) => s.id === stageId);
    if (!stage) return;
    const prevTasks = get().doneTasks;
    const prevXp = get().xp;
    const prevLevel = get().level;
    const optimistic = { ...prevTasks, [stageId]: [] };
    const optXp = xpFromTasks(optimistic);
    set({ doneTasks: optimistic, xp: optXp, level: Math.floor(optXp / 100) + 1 });
    try {
      const res = await api.post<ProgressResponse>('/api/progress/stage', { stage_id: stageId, action: 'uncomplete' });
      set({
        doneTasks: { ...emptyTasks(), ...res.done_tasks } as Record<StageId, string[]>,
        xp: res.xp,
        level: res.level,
        completedAt: res.completed_at,
      });
    } catch (e) {
      set({ doneTasks: prevTasks, xp: prevXp, level: prevLevel });
      throw e;
    }
  },

  markIntroSeen: async () => {
    if (get().introSeen) return;
    set({ introSeen: true });
    try { await api.post('/api/intro-seen'); } catch { /* не критично */ }
  },

  setVoiceEnabled: async (enabled) => {
    const prev = get().voiceEnabled;
    set({ voiceEnabled: enabled });
    try { await api.post('/api/voice', { enabled }); } catch { set({ voiceEnabled: prev }); }
  },

  fetchNotifications: async () => {
    try {
      const rows = await api.get<NotificationItem[]>('/api/notifications');
      set({ notifications: rows, unreadCount: rows.filter((n) => !n.read).length });
    } catch { /* не критично */ }
  },

  markNotificationRead: async (id) => {
    set((s) => ({
      notifications: s.notifications.map((n) => n.id === id ? { ...n, read: true } : n),
      unreadCount: Math.max(0, s.unreadCount - 1),
    }));
    try { await api.post(`/api/notifications/${id}/read`); } catch { /* ignore */ }
  },

  markAllNotificationsRead: async () => {
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }));
    try { await api.post('/api/notifications/read-all'); } catch { /* ignore */ }
  },
}));

// Helper selectors
export function getStageStatus(stageId: StageId, doneTasks: Record<StageId, string[]>): StageStatus {
  const stage = STAGES.find((s) => s.id === stageId);
  if (!stage) return 'locked';
  const allTaskIds = stage.subTasks.map((t) => t.id);
  const completed = doneTasks[stageId] || [];
  if (allTaskIds.every((id) => completed.includes(id))) return 'done';
  for (let i = 1 as StageId; i <= 5; i = (i + 1) as StageId) {
    const s = STAGES.find((st) => st.id === i)!;
    const ids = s.subTasks.map((t) => t.id);
    const d = doneTasks[i] || [];
    if (!ids.every((id) => d.includes(id))) return i === stageId ? 'current' : 'locked';
  }
  return 'locked';
}

export function getAllStatuses(doneTasks: Record<StageId, string[]>): Record<StageId, StageStatus> {
  return {
    1: getStageStatus(1, doneTasks),
    2: getStageStatus(2, doneTasks),
    3: getStageStatus(3, doneTasks),
    4: getStageStatus(4, doneTasks),
    5: getStageStatus(5, doneTasks),
  };
}

export function getProgress(doneTasks: Record<StageId, string[]>): { done: number; total: number; pct: number } {
  const total = STAGES.length;
  let done = 0;
  for (const stage of STAGES) {
    const ids = stage.subTasks.map((t) => t.id);
    const d = doneTasks[stage.id] || [];
    if (ids.every((id) => d.includes(id))) done++;
  }
  return { done, total, pct: Math.round((done / total) * 100) };
}
