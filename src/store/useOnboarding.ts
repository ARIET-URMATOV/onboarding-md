import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { STAGES } from '../data/stages';
import type { StageId, Role } from '../data/stages';

export type StageStatus = 'locked' | 'current' | 'done';

interface User {
  email: string;
  name: string;
}

interface OnboardingState {
  user: User | null;
  role: Role | null;
  doneTasks: Record<StageId, string[]>;
  xp: number;
  // actions
  login: (u: User) => void;
  logout: () => void;
  setRole: (r: Role) => void;
  toggleTask: (stageId: StageId, taskId: string) => void;
  completeStage: (stageId: StageId) => void;
  uncompleteStage: (stageId: StageId) => void;
}

const emptyTasks = (): Record<StageId, string[]> => ({
  1: [], 2: [], 3: [], 4: [], 5: [],
});

const xpFromTasks = (stageId: StageId, taskIds: string[]): number => {
  const stage = STAGES.find((s) => s.id === stageId);
  if (!stage) return 0;
  return stage.subTasks.filter((t) => taskIds.includes(t.id)).reduce((sum, t) => sum + t.xp, 0);
};

export const useOnboarding = create<OnboardingState>()(
  persist(
    (set, get) => ({
      user: null,
      role: null,
      doneTasks: emptyTasks(),
      xp: 0,

      login: (u) => set({ user: u }),
      logout: () => set({ user: null, role: null, doneTasks: emptyTasks(), xp: 0 }),
      setRole: (r) => set({ role: r }),

      toggleTask: (stageId, taskId) => {
        const cur = get().doneTasks[stageId] || [];
        const next = cur.includes(taskId) ? cur.filter((t) => t !== taskId) : [...cur, taskId];
        const allTasks = STAGES.find((s) => s.id === stageId)!.subTasks.map((t) => t.id);
        const allDone = allTasks.every((id) => next.includes(id));
        set({
          doneTasks: { ...get().doneTasks, [stageId]: next },
          xp: get().xp + (next.includes(taskId) ? xpFromTasks(stageId, [taskId]) : -xpFromTasks(stageId, [taskId])),
        });
        if (allDone) {
          get().completeStage(stageId);
        }
      },

      completeStage: (stageId) => {
        const stage = STAGES.find((s) => s.id === stageId);
        if (!stage) return;
        const allTaskIds = stage.subTasks.map((t) => t.id);
        const cur = get().doneTasks[stageId] || [];
        const missing = allTaskIds.filter((id) => !cur.includes(id));
        // Stage 1 requires scroll-gate: не даём закрыть этап кнопкой пока не прочитаны документы
        if (stageId === 1 && missing.length > 0) return;
        let newDone = cur;
        if (missing.length > 0) {
          newDone = allTaskIds;
          const missingXp = xpFromTasks(stageId, missing);
          set({
            doneTasks: { ...get().doneTasks, [stageId]: newDone },
            xp: get().xp + missingXp,
          });
        }
        // bonus XP for completing the stage
        set({ xp: get().xp + stage.xpReward });
      },

      uncompleteStage: (stageId) => {
        const stage = STAGES.find((s) => s.id === stageId);
        if (!stage) return;
        set({
          doneTasks: { ...get().doneTasks, [stageId]: [] },
          xp: Math.max(0, get().xp - stage.xpReward),
        });
      },
    }),
    { name: 'onb:v1' },
  ),
);

// Helper selectors
export function getStageStatus(stageId: StageId, doneTasks: Record<StageId, string[]>): StageStatus {
  const stage = STAGES.find((s) => s.id === stageId);
  if (!stage) return 'locked';
  const allTaskIds = stage.subTasks.map((t) => t.id);
  const completed = doneTasks[stageId] || [];
  if (allTaskIds.every((id) => completed.includes(id))) return 'done';
  // First not-done stage is current; everything before is done; everything after is locked
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
