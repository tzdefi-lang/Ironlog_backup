import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import type { Workout } from '@/types';

type UseWorkoutTimerResult = {
  currentTime: number;
  durationMinutes: number;
  setCurrentTime: Dispatch<SetStateAction<number>>;
};

export const useWorkoutTimer = (workout: Workout): UseWorkoutTimerResult => {
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    let interval: number | undefined;
    if (workout.startTimestamp && !workout.completed) {
      interval = window.setInterval(() => {
        const elapsed = workout.elapsedSeconds || 0;
        const additional = (Date.now() - (workout.startTimestamp || Date.now())) / 1000;
        setCurrentTime(elapsed + additional);
      }, 1000);
    } else {
      setCurrentTime(workout.elapsedSeconds || 0);
    }
    return () => {
      if (interval) window.clearInterval(interval);
    };
  }, [workout.startTimestamp, workout.elapsedSeconds, workout.completed]);

  const durationMinutes = useMemo(() => Math.max(0, Math.round(currentTime / 60)), [currentTime]);

  return { currentTime, durationMinutes, setCurrentTime };
};
