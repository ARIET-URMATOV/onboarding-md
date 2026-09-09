import { describe, it, expect } from 'vitest';
import { STAGES } from '../../../src/data/stages';

describe('STAGES data', () => {
  it('has 5 stages with stable IDs', () => {
    expect(STAGES.map((s) => s.id)).toEqual([1, 2, 3, 4, 5]);
  });

  it('every stage has at least one subTask and non-negative xp', () => {
    for (const s of STAGES) {
      expect(s.subTasks.length).toBeGreaterThan(0);
      expect(s.xpReward).toBeGreaterThan(0);
      for (const t of s.subTasks) {
        // Step 2 доступы — 0 баллов по TZ (staff-верификация без XP)
        expect(t.xp).toBeGreaterThanOrEqual(0);
        expect(t.id).toMatch(/^\d-/);
      }
    }
  });

  it('stage 1 sums to TZ 20 (5+0+5+10)', () => {
    const s1 = STAGES.find((s) => s.id === 1)!;
    expect(s1.subTasks.reduce((a, t) => a + t.xp, 0)).toBe(20);
  });

  it('max XP matches serverStages total (1370)', () => {
    let total = 0;
    for (const s of STAGES) {
      for (const t of s.subTasks) total += t.xp;
      total += s.xpReward;
    }
    expect(total).toBe(1370);
  });
});
