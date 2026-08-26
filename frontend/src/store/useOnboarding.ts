import { create } from 'zustand';
import { api, type MeResponse, type ProgressResponse, type UserResponse } from '../api/client';
import { STAGES } from '../data/stages';
import type { StageId, Role } from '../data/stages';

export type StageStatus = 'locked' | 'current' | 'done';

interface User {
  email: string;
  name: string;
  avatar: string | null;
}

interface OnboardingState {
  user: User | null;
  role: Role | null;
  introSeen: boolean;
  voiceEnabled: boolean;
  doneTasks: Record<StageId, string[]>;
  xp: number;
  hydrated: boolean;
  // actions
  hydrate: (me: MeResponse) => void;
  refreshMe: () => Promise<void>;
  login: (me: MeResponse) => void;
  logout: () => Promise<void>;
  setRole: (r: Role) => Promise<void>;
  updateProfile: (patch: { name?: string; avatar?: string | null }) => Promise<void>;
  toggleTask: (stageId: StageId, taskId: string) => Promise<void>;
  completeStage: (stageId: StageId) => Promise<void>;
  uncompleteStage: (stageId: StageId) => Promise<void>;
  markIntroSeen: () => Promise<void>;
  setVoiceEnabled: (enabled: boolean) => Promise<void>;
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
  hydrated: false,

  hydrate: (me) =>
    set({
      user: { email: me.user.email, name: me.user.name, avatar: me.user.avatar },
      role: me.user.role,
      introSeen: me.user.intro_seen,
      voiceEnabled: me.user.voice_enabled,
      doneTasks: { ...emptyTasks(), ...me.progress.done_tasks } as Record<StageId, string[]>,
      xp: me.progress.xp,
      hydrated: true,
    }),

  refreshMe: async () => {
    const me = await api.get<MeResponse>('/api/me');
    get().hydrate(me);
  },

  login: (me) => {
    get().hydrate(me);
  },

  logout: async () => {
    try { await api.post('/api/logout'); } catch { /* cookie уже могла истечь */ }
    set({
      user: null, role: null, introSeen: false, voiceEnabled: true,
      doneTasks: emptyTasks(), xp: 0, hydrated: true,
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
        set({ user: { email: u.email, name: u.name, avatar: u.avatar } });
      }
    } catch (e) {
      if (prevUser) set({ user: prevUser });
      throw e;
    }
  },

  toggleTask: async (stageId, taskId) => {
    const prevTasks = get().doneTasks;
    const cur = prevTasks[stageId] || [];
    const next = cur.includes(taskId) ? cur.filter((t) => t !== taskId) : [...cur, taskId];
    const optimistic = { ...prevTasks, [stageId]: next };
    set({ doneTasks: optimistic, xp: xpFromTasks(optimistic) });
    try {
      const res = await api.post<ProgressResponse>('/api/progress/task', { stage_id: stageId, task_id: taskId });
      set({
        doneTasks: { ...emptyTasks(), ...res.done_tasks } as Record<StageId, string[]>,
        xp: res.xp,
      });
    } catch (e) {
      set({ doneTasks: prevTasks, xp: xpFromTasks(prevTasks) });
      throw e;
    }
  },

  completeStage: async (stageId) => {
    const stage = STAGES.find((s) => s.id === stageId);
    if (!stage) return;
    const prevTasks = get().doneTasks;
    const cur = prevTasks[stageId] || [];
    const allTaskIds = stage.subTasks.map((t) => t.id);
    const missing = allTaskIds.filter((id) => !cur.includes(id));
    // Этап 1 закрывается только через scroll-gate всех документов
    if (stageId === 1 && missing.length > 0) return;
    const optimistic = { ...prevTasks, [stageId]: allTaskIds };
    set({ doneTasks: optimistic, xp: xpFromTasks(optimistic) });
    try {
      const res = await api.post<ProgressResponse>('/api/progress/stage', { stage_id: stageId, action: 'complete' });
      set({
        doneTasks: { ...emptyTasks(), ...res.done_tasks } as Record<StageId, string[]>,
        xp: res.xp,
      });
    } catch (e) {
      set({ doneTasks: prevTasks, xp: xpFromTasks(prevTasks) });
      throw e;
    }
  },

  uncompleteStage: async (stageId) => {
    const stage = STAGES.find((s) => s.id === stageId);
    if (!stage) return;
    const prevTasks = get().doneTasks;
    const optimistic = { ...prevTasks, [stageId]: [] };
    set({ doneTasks: optimistic, xp: xpFromTasks(optimistic) });
    try {
      const res = await api.post<ProgressResponse>('/api/progress/stage', { stage_id: stageId, action: 'uncomplete' });
      set({
        doneTasks: { ...emptyTasks(), ...res.done_tasks } as Record<StageId, string[]>,
        xp: res.xp,
      });
    } catch (e) {
      set({ doneTasks: prevTasks, xp: xpFromTasks(prevTasks) });
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
