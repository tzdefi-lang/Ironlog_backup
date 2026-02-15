import type { ExerciseDef, Workout } from '@/types';

export type PRMetric = 'maxWeight' | 'maxVolume' | 'estimated1RM';

export interface ExercisePR {
  maxWeight: number;
  maxVolume: number;
  maxEstimated1RM: number;
}

export interface PRBreak {
  exerciseDefId: string;
  exerciseName: string;
  metric: PRMetric;
  previous: number;
  current: number;
}

const emptyPR = (): ExercisePR => ({
  maxWeight: 0,
  maxVolume: 0,
  maxEstimated1RM: 0,
});

export const calculatePRs = (workouts: Workout[]): Record<string, ExercisePR> => {
  const prs: Record<string, ExercisePR> = {};

  for (const workout of workouts) {
    const workoutVolumeByDef: Record<string, number> = {};

    for (const exercise of workout.exercises) {
      const defId = exercise.defId;
      if (!prs[defId]) prs[defId] = emptyPR();

      let exerciseVolume = 0;
      for (const set of exercise.sets) {
        if (!set.completed) continue;
        const oneRm = set.weight * (1 + set.reps / 30);
        prs[defId].maxWeight = Math.max(prs[defId].maxWeight, set.weight);
        prs[defId].maxEstimated1RM = Math.max(prs[defId].maxEstimated1RM, oneRm);
        exerciseVolume += set.weight * set.reps;
      }

      workoutVolumeByDef[defId] = (workoutVolumeByDef[defId] ?? 0) + exerciseVolume;
    }

    for (const [defId, volume] of Object.entries(workoutVolumeByDef)) {
      if (!prs[defId]) prs[defId] = emptyPR();
      prs[defId].maxVolume = Math.max(prs[defId].maxVolume, volume);
    }
  }

  return prs;
};

type CurrentExerciseStats = {
  maxWeight: number;
  maxEstimated1RM: number;
  volume: number;
};

const collectWorkoutExerciseStats = (workout: Workout): Record<string, CurrentExerciseStats> => {
  const statsByDef: Record<string, CurrentExerciseStats> = {};

  for (const exercise of workout.exercises) {
    const defId = exercise.defId;
    if (!statsByDef[defId]) {
      statsByDef[defId] = {
        maxWeight: 0,
        maxEstimated1RM: 0,
        volume: 0,
      };
    }

    for (const set of exercise.sets) {
      if (!set.completed) continue;
      const oneRm = set.weight * (1 + set.reps / 30);
      statsByDef[defId].maxWeight = Math.max(statsByDef[defId].maxWeight, set.weight);
      statsByDef[defId].maxEstimated1RM = Math.max(statsByDef[defId].maxEstimated1RM, oneRm);
      statsByDef[defId].volume += set.weight * set.reps;
    }
  }

  return statsByDef;
};

export const calculateBrokenPRs = (
  workout: Workout,
  historicalPRs: Record<string, ExercisePR>,
  exerciseDefs: ExerciseDef[]
): PRBreak[] => {
  const defNameById = new Map(exerciseDefs.map((def) => [def.id, def.name]));
  const currentStats = collectWorkoutExerciseStats(workout);
  const breaks: PRBreak[] = [];

  for (const [defId, stats] of Object.entries(currentStats)) {
    const base = historicalPRs[defId] ?? emptyPR();
    const exerciseName = defNameById.get(defId) ?? 'Unknown Exercise';

    if (stats.maxWeight > base.maxWeight) {
      breaks.push({
        exerciseDefId: defId,
        exerciseName,
        metric: 'maxWeight',
        previous: base.maxWeight,
        current: stats.maxWeight,
      });
    }

    if (stats.volume > base.maxVolume) {
      breaks.push({
        exerciseDefId: defId,
        exerciseName,
        metric: 'maxVolume',
        previous: base.maxVolume,
        current: stats.volume,
      });
    }

    if (stats.maxEstimated1RM > base.maxEstimated1RM) {
      breaks.push({
        exerciseDefId: defId,
        exerciseName,
        metric: 'estimated1RM',
        previous: base.maxEstimated1RM,
        current: stats.maxEstimated1RM,
      });
    }
  }

  return breaks;
};
