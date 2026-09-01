import { describe, it, expect } from 'vitest';
import { STAGES } from './stages';

describe('STAGES data', () => {
  it('has 5 stages with stable IDs', () => {
    expect(STAGES.map((s) => s.id)).toEqual([1, 2, 3, 4, 5]);
  });

  it('every stage has at least one subTask and positive xp', () => {
    for (const s of STAGES) {
      expect(s.subTasks.length).toBeGreaterThan(0);
      expect(s.xpReward).toBeGreaterThan(0);
      for (const t of s.subTasks) {
        expect(t.xp).toBeGreaterThan(0);
        expect(t.id).toMatch(/^\d-/);
      }
    }
  });

  it('max XP matches serverStages total (1540)', () => {
    let total = 0;
    for (const s of STAGES) {
      for (const t of s.subTasks) total += t.xp;
      total += s.xpReward;
    }
    expect(total).toBe(1540);
  });
});
