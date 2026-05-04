import { describe, expect, it } from 'vitest';
import { buildFastTrajectorySummary } from '../../src/lib/fast/trajectory';

describe('FAST trajectory summary', () => {
  it('orders PM1, PM2, PM3 and calculates growth between windows', () => {
    const summary = buildFastTrajectorySummary([
      {
        id: 'pm3',
        test_reason: 'PM3',
        test_year: 2026,
        date_taken: '2026-05-01',
        scale_score: 226,
        achievement_level: 2,
      },
      {
        id: 'pm1',
        test_reason: 'PM1',
        test_year: 2026,
        date_taken: '2025-09-01',
        scale_score: 219,
        achievement_level: 1,
      },
      {
        id: 'pm2',
        test_reason: 'PM2',
        test_year: 2026,
        date_taken: '2026-01-10',
        scale_score: 223,
        achievement_level: 1,
      },
    ]);

    expect(summary.points.map((point) => point.test_reason)).toEqual(['PM1', 'PM2', 'PM3']);
    expect(summary.points.map((point) => point.growth_from_previous)).toEqual([null, 4, 3]);
    expect(summary.first_score).toBe(219);
    expect(summary.latest_score).toBe(226);
    expect(summary.total_growth).toBe(7);
    expect(summary.crossed_rung).toBe(true);
    expect(summary.points[2].crossed_rung_from_previous).toBe(true);
    expect(summary.narrative).toContain('Level 1 to Level 2');
  });

  it('explains single-window PM3 reports as a baseline', () => {
    const summary = buildFastTrajectorySummary([
      {
        id: 'pm3',
        test_reason: 'PM3',
        test_year: 2026,
        date_taken: '2026-05-01',
        scale_score: 219,
        achievement_level: 1,
      },
    ]);

    expect(summary.total_growth).toBe(0);
    expect(summary.crossed_rung).toBe(false);
    expect(summary.points[0].growth_from_previous).toBeNull();
    expect(summary.narrative).toContain('Only one FAST window');
  });
});
