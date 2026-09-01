import { describe, it, expect, beforeEach } from 'vitest';
import { useOnboarding, getStageStatus, getAllStatuses, getProgress } from './useOnboarding';
import type { StageId } from '../data/stages';

function empty(): Record<StageId, string[]> {
  return { 1: [], 2: [], 3: [], 4: [], 5: [] };
}

describe('getStageStatus', () => {
  it('returns current for first incomplete stage', () => {
    expect(getStageStatus(1, empty())).toBe('current');
    expect(getStageStatus(2, empty())).toBe('locked');
  });

  it('marks done when all subtasks completed', () => {
    const done = { ...empty(), 1: ['1-docs', '1-lead', '1-mplus', '1-jira', '1-confluence'] };
    expect(getStageStatus(1, done)).toBe('done');
    expect(getStageStatus(2, done)).toBe('current');
  });

  it('sequential unlocking', () => {
    const after1 = { ...empty(), 1: ['1-docs', '1-lead', '1-mplus', '1-jira', '1-confluence'] };
    const after2 = { ...after1, 2: ['2-studio', '2-profiles', '2-lead', '2-chat'] };
    expect(getAllStatuses(after2)).toEqual({ 1: 'done', 2: 'done', 3: 'current', 4: 'locked', 5: 'locked' });
  });
});

describe('getProgress', () => {
  it('computes done/total/pct', () => {
    expect(getProgress(empty())).toEqual({ done: 0, total: 5, pct: 0 });
    const twoDone = {
      ...empty(),
      1: ['1-docs', '1-lead', '1-mplus', '1-jira', '1-confluence'],
      2: ['2-studio', '2-profiles', '2-lead', '2-chat'],
    };
    expect(getProgress(twoDone)).toEqual({ done: 2, total: 5, pct: 40 });
  });
});

describe('useOnboarding hydrate', () => {
  beforeEach(() => {
    useOnboarding.setState({
      user: null,
      role: null,
      introSeen: false,
      voiceEnabled: true,
      doneTasks: empty(),
      xp: 0,
      level: 1,
      completedAt: null,
      hydrated: false,
    });
  });

  it('hydrates from MeResponse with server level/completedAt', () => {
    const me = {
      user: { email: 'a@b.c', name: 'A', role: 'frontend' as const, avatar: null, intro_seen: true, voice_enabled: false },
      progress: { done_tasks: { '1': ['1-docs'] }, xp: 40, level: 1, completed_at: null },
    };
    useOnboarding.getState().hydrate(me as any);
    const s = useOnboarding.getState();
    expect(s.xp).toBe(40);
    expect(s.level).toBe(1);
    expect(s.role).toBe('frontend');
    expect(s.hydrated).toBe(true);
  });

  it('hydrates level fallback when server omits it', () => {
    const me = {
      user: { email: 'a@b.c', name: 'A', role: null, avatar: null, intro_seen: false, voice_enabled: true },
      progress: { done_tasks: {}, xp: 250 },
    };
    useOnboarding.getState().hydrate(me as any);
    expect(useOnboarding.getState().level).toBe(3); // floor(250/100)+1
  });
});
