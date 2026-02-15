import { calculatePRs } from '@/services/pr';
import { parseLocalDate } from '@/services/utils';
import type { ExerciseInstance, Workout } from '@/types';

export type ExerciseSessionStats = {
  volume: number;
  maxWeight: number;
  maxEstimated1RM: number;
};

export const computeExerciseInstanceStats = (exercise?: ExerciseInstance | null): ExerciseSessionStats => {
  if (!exercise) return { volume: 0, maxWeight: 0, maxEstimated1RM: 0 };

  let volume = 0;
  let maxWeight = 0;
  let maxEstimated1RM = 0;

  for (const set of exercise.sets) {
    if (!set.completed) continue;
    volume += set.weight * set.reps;
    maxWeight = Math.max(maxWeight, set.weight);
    maxEstimated1RM = Math.max(maxEstimated1RM, set.weight * (1 + set.reps / 30));
  }

  return {
    volume: Math.round(volume),
    maxWeight,
    maxEstimated1RM: Math.round(maxEstimated1RM * 10) / 10,
  };
};

export const computeWorkoutExerciseStats = (workout: Workout, defId: string): ExerciseSessionStats | null => {
  let volume = 0;
  let maxWeight = 0;
  let maxEstimated1RM = 0;
  let hasCompleted = false;

  for (const exercise of workout.exercises) {
    if (exercise.defId !== defId) continue;
    for (const set of exercise.sets) {
      if (!set.completed) continue;
      hasCompleted = true;
      volume += set.weight * set.reps;
      maxWeight = Math.max(maxWeight, set.weight);
      maxEstimated1RM = Math.max(maxEstimated1RM, set.weight * (1 + set.reps / 30));
    }
  }

  if (!hasCompleted) return null;

  return {
    volume: Math.round(volume),
    maxWeight,
    maxEstimated1RM: Math.round(maxEstimated1RM * 10) / 10,
  };
};

export const findLastCompletedExerciseStats = (
  workouts: Workout[],
  defId: string,
  excludeWorkoutId?: string | null
): ExerciseSessionStats | null => {
  const completed = workouts
    .filter((workout) => workout.completed)
    .filter((workout) => (excludeWorkoutId ? workout.id !== excludeWorkoutId : true))
    .slice()
    .sort((a, b) => parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime());

  for (const workout of completed) {
    const stats = computeWorkoutExerciseStats(workout, defId);
    if (stats) return stats;
  }

  return null;
};

export const calculateExercisePRStats = (workouts: Workout[], defId: string, excludeWorkoutId?: string | null) => {
  const completed = workouts
    .filter((workout) => workout.completed)
    .filter((workout) => (excludeWorkoutId ? workout.id !== excludeWorkoutId : true));

  const prs = calculatePRs(completed);
  return prs[defId] ?? { maxWeight: 0, maxVolume: 0, maxEstimated1RM: 0 };
};

