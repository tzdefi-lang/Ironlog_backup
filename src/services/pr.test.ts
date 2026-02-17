import { describe, expect, it } from 'vitest';
import { calculateBrokenPRs, calculatePRs } from '@/services/pr';
import type { ExerciseDef, Workout } from '@/types';

const createWorkout = (overrides: Partial<Workout>): Workout => ({
  id: 'workout-1',
  date: '2026-02-11',
  title: 'Session',
  note: '',
  completed: true,
  elapsedSeconds: 0,
  startTimestamp: null,
  exercises: [],
  ...overrides,
});

describe('pr service', () => {
  it('calculates max weight and estimated 1RM from completed sets', () => {
    const workouts: Workout[] = [
      createWorkout({
        exercises: [
          {
            id: 'ex-1',
            defId: 'bench',
            sets: [
              { id: 's1', weight: 100, reps: 5, completed: true },
              { id: 's2', weight: 110, reps: 3, completed: true },
              { id: 's3', weight: 120, reps: 1, completed: false },
            ],
          },
        ],
      }),
    ];

    const prs = calculatePRs(workouts);
    expect(prs.bench.maxWeight).toBe(110);
    expect(prs.bench.maxEstimated1RM).toBeCloseTo(121, 2);
  });

  it('calculates max volume per workout per exercise def', () => {
    const workouts: Workout[] = [
      createWorkout({
        id: 'w-1',
        exercises: [
          {
            id: 'ex-a',
            defId: 'squat',
            sets: [
              { id: 's1', weight: 100, reps: 5, completed: true },
              { id: 's2', weight: 100, reps: 5, completed: true },
            ],
          },
        ],
      }),
      createWorkout({
        id: 'w-2',
        exercises: [
          {
            id: 'ex-b',
            defId: 'squat',
            sets: [
              { id: 's3', weight: 120, reps: 3, completed: true },
            ],
          },
        ],
      }),
    ];

    const prs = calculatePRs(workouts);
    expect(prs.squat.maxVolume).toBe(1000);
  });

  it('returns PR break entries when workout exceeds historical PRs', () => {
    const historical = {
      bench: {
        maxWeight: 100,
        maxVolume: 1000,
        maxEstimated1RM: 116,
      },
    };
    const exerciseDefs: ExerciseDef[] = [
      { id: 'bench', name: 'Bench Press', description: '', category: 'Chest' },
    ];
    const workout = createWorkout({
      exercises: [
        {
          id: 'ex1',
          defId: 'bench',
          sets: [
            { id: 's1', weight: 110, reps: 5, completed: true },
            { id: 's2', weight: 110, reps: 5, completed: true },
          ],
        },
      ],
    });

    const breaks = calculateBrokenPRs(workout, historical, exerciseDefs);
    expect(breaks.map((item) => item.metric).sort()).toEqual(['estimated1RM', 'maxVolume', 'maxWeight']);
    expect(breaks.every((item) => item.exerciseName === 'Bench Press')).toBe(true);
  });

  it('uses fallback exercise name when def is missing', () => {
    const breaks = calculateBrokenPRs(
      createWorkout({
        exercises: [
          {
            id: 'ex1',
            defId: 'unknown-def',
            sets: [{ id: 's1', weight: 100, reps: 1, completed: true }],
          },
        ],
      }),
      {},
      []
    );

    expect(breaks).toHaveLength(3);
    expect(breaks[0].exerciseName).toBe('Unknown Exercise');
  });

  it('returns empty list when no metrics are broken', () => {
    const workout = createWorkout({
      exercises: [
        {
          id: 'ex1',
          defId: 'bench',
          sets: [{ id: 's1', weight: 90, reps: 5, completed: true }],
        },
      ],
    });
    const historical = {
      bench: {
        maxWeight: 100,
        maxVolume: 1200,
        maxEstimated1RM: 130,
      },
    };
    const defs: ExerciseDef[] = [{ id: 'bench', name: 'Bench Press', description: '' }];

    expect(calculateBrokenPRs(workout, historical, defs)).toEqual([]);
  });
});
