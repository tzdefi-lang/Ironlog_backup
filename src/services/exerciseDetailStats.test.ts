import { describe, expect, it } from 'vitest';
import {
  calculateExercisePRStats,
  computeExerciseInstanceStats,
  findLastCompletedExerciseStats,
} from '@/services/exerciseDetailStats';
import type { ExerciseInstance, Workout } from '@/types';

describe('exerciseDetailStats', () => {
  it('computes completed-only stats for current exercise', () => {
    const instance: ExerciseInstance = {
      id: 'ex-1',
      defId: 'def-1',
      sets: [
        { id: 's1', weight: 100, reps: 5, completed: true },
        { id: 's2', weight: 120, reps: 3, completed: false },
      ],
    };

    expect(computeExerciseInstanceStats(instance)).toEqual({
      volume: 500,
      maxWeight: 100,
      maxEstimated1RM: 116.7,
    });
  });

  it('selects last completed workout stats excluding current workout id', () => {
    const workouts: Workout[] = [
      {
        id: 'w-current',
        date: '2026-02-12',
        title: '',
        note: '',
        completed: true,
        elapsedSeconds: 0,
        startTimestamp: null,
        exercises: [
          {
            id: 'e1',
            defId: 'def-1',
            sets: [{ id: 's1', weight: 200, reps: 1, completed: true }],
          },
        ],
      },
      {
        id: 'w-last',
        date: '2026-02-10',
        title: '',
        note: '',
        completed: true,
        elapsedSeconds: 0,
        startTimestamp: null,
        exercises: [
          {
            id: 'e2',
            defId: 'def-1',
            sets: [{ id: 's2', weight: 150, reps: 2, completed: true }],
          },
        ],
      },
    ];

    const stats = findLastCompletedExerciseStats(workouts, 'def-1', 'w-current');
    expect(stats).toMatchObject({ volume: 300, maxWeight: 150 });
  });

  it('calculates PRs from completed workouts excluding current workout id', () => {
    const workouts: Workout[] = [
      {
        id: 'w1',
        date: '2026-02-01',
        title: '',
        note: '',
        completed: true,
        elapsedSeconds: 0,
        startTimestamp: null,
        exercises: [
          {
            id: 'e1',
            defId: 'def-1',
            sets: [{ id: 's1', weight: 100, reps: 5, completed: true }],
          },
        ],
      },
      {
        id: 'w2',
        date: '2026-02-08',
        title: '',
        note: '',
        completed: true,
        elapsedSeconds: 0,
        startTimestamp: null,
        exercises: [
          {
            id: 'e2',
            defId: 'def-1',
            sets: [{ id: 's2', weight: 120, reps: 3, completed: true }],
          },
        ],
      },
      {
        id: 'w-current',
        date: '2026-02-12',
        title: '',
        note: '',
        completed: true,
        elapsedSeconds: 0,
        startTimestamp: null,
        exercises: [
          {
            id: 'e3',
            defId: 'def-1',
            sets: [{ id: 's3', weight: 999, reps: 1, completed: true }],
          },
        ],
      },
    ];

    const prs = calculateExercisePRStats(workouts, 'def-1', 'w-current');
    expect(prs.maxWeight).toBe(120);
    expect(prs.maxVolume).toBe(500); // 100*5 beats 120*3
    expect(prs.maxEstimated1RM).toBeGreaterThan(0);
    expect(prs.maxEstimated1RM).toBeLessThan(200);
  });
});

