import { formatDate, generateId } from '@/services/utils';
import type { ExerciseInstance, Workout } from '@/types';

export type WorkoutAction =
  | { type: 'replace'; workout: Workout }
  | { type: 'setTitle'; title: string }
  | { type: 'setNote'; note: string }
  | { type: 'setExercises'; exercises: ExerciseInstance[] };

export const createDraftWorkout = (title = 'New Workout'): Workout => ({
  id: generateId(),
  date: formatDate(new Date()),
  title,
  note: '',
  exercises: [],
  completed: false,
  elapsedSeconds: 0,
  startTimestamp: null,
});

export const workoutReducer = (state: Workout, action: WorkoutAction): Workout => {
  switch (action.type) {
    case 'replace':
      return action.workout;
    case 'setTitle':
      return { ...state, title: action.title };
    case 'setNote':
      return { ...state, note: action.note };
    case 'setExercises':
      return { ...state, exercises: action.exercises };
    default:
      return state;
  }
};
