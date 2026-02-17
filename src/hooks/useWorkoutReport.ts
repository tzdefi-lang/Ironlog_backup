import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { shareWorkoutReportCanvas } from '@/components/WorkoutReportCanvas';
import { pushToast } from '@/components/ui';
import { getDefaultBarbellWeight } from '@/constants';
import { calculateBrokenPRs, calculatePRs } from '@/services/pr';
import type { ExerciseDef, Unit, Workout } from '@/types';

type UseWorkoutReportParams = {
  workout: Workout;
  workouts: Workout[];
  exerciseDefs: ExerciseDef[];
  unit: Unit;
  currentUnit: string;
  durationMinutes: number;
  showReport: boolean;
  t: (key: string) => string;
};

type UseWorkoutReportResult = {
  historicalPRs: ReturnType<typeof calculatePRs>;
  brokenPRs: ReturnType<typeof calculateBrokenPRs>;
  animMinutes: number;
  animCompletion: number;
  animVolume: number;
  handleShareReport: () => Promise<void>;
};

export const useWorkoutReport = ({
  workout,
  workouts,
  exerciseDefs,
  unit,
  currentUnit,
  durationMinutes,
  showReport,
  t,
}: UseWorkoutReportParams): UseWorkoutReportResult => {
  const totalVolume = useMemo(() => workout.exercises.reduce((acc, ex) => {
    const def = exerciseDefs.find(d => d.id === ex.defId);
    const usesBarbell = !!def?.usesBarbell;
    const barbellWeight = usesBarbell ? (def?.barbellWeight ?? getDefaultBarbellWeight(unit)) : 0;
    const exerciseTotal = ex.sets.reduce((sAcc, s) => {
      if (!s.completed) return sAcc;
      const perRep = usesBarbell ? (s.weight * 2 + barbellWeight) : s.weight;
      return sAcc + (perRep * s.reps);
    }, 0);
    return acc + exerciseTotal;
  }, 0), [exerciseDefs, unit, workout.exercises]);

  const totalSets = useMemo(
    () => workout.exercises.reduce((acc, ex) => acc + ex.sets.length, 0),
    [workout.exercises]
  );
  const completedSets = useMemo(
    () => workout.exercises.reduce((acc, ex) => acc + ex.sets.filter(s => s.completed).length, 0),
    [workout.exercises]
  );
  const percentage = useMemo(
    () => (totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0),
    [completedSets, totalSets]
  );

  const historicalPRs = useMemo(
    () => calculatePRs(workouts.filter((w) => w.id !== workout.id)),
    [workouts, workout.id]
  );
  const brokenPRs = useMemo(
    () => calculateBrokenPRs(workout, historicalPRs, exerciseDefs),
    [workout, historicalPRs, exerciseDefs]
  );

  const [animMinutes, setAnimMinutes] = useState(0);
  const [animCompletion, setAnimCompletion] = useState(0);
  const [animVolume, setAnimVolume] = useState(0);
  const reportShownOnceRef = useRef(false);

  const animateNumber = useCallback((to: number, setter: (v: number) => void, durationMs: number) => {
    const from = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const tProgress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - tProgress, 3);
      const value = Math.round(from + (to - from) * eased);
      setter(value);
      if (tProgress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    if (!showReport) {
      reportShownOnceRef.current = false;
      return;
    }
    if (reportShownOnceRef.current) return;
    reportShownOnceRef.current = true;

    setAnimMinutes(0);
    setAnimCompletion(0);
    setAnimVolume(0);

    animateNumber(durationMinutes, setAnimMinutes, 700);
    animateNumber(percentage, setAnimCompletion, 900);
    animateNumber(Math.round(totalVolume), setAnimVolume, 1100);
  }, [animateNumber, durationMinutes, percentage, showReport, totalVolume]);

  const handleShareReport = useCallback(async () => {
    try {
      await shareWorkoutReportCanvas({
        workout,
        exerciseDefs,
        durationMinutes,
        percentage,
        totalVolume,
        currentUnit,
        text: {
          workoutFallbackTitle: t('workoutReport.workoutFallbackTitle'),
          durationLabel: t('workoutReport.durationLabel'),
          completionLabel: t('workoutReport.completionLabel'),
          totalVolumeLabel: t('workoutReport.totalVolumeLabel'),
          exercisesLabel: t('workoutReport.exercisesLabel'),
          exerciseFallbackName: t('workoutReport.exerciseFallbackName'),
          minutesShort: t('workoutReport.minutesShort'),
          shareTitlePrefix: t('workoutReport.shareTitlePrefix'),
        },
      });
    } catch (e: any) {
      pushToast({ kind: 'error', message: e?.message || t('workoutEditor.shareFailed') });
    }
  }, [currentUnit, durationMinutes, exerciseDefs, percentage, t, totalVolume, workout]);

  return {
    historicalPRs,
    brokenPRs,
    animMinutes,
    animCompletion,
    animVolume,
    handleShareReport,
  };
};
