import type { ExerciseDef, Workout } from '@/types';

const csvEscape = (value: string | number | boolean): string => {
  const text = String(value ?? '');
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const triggerDownload = (filename: string, blob: Blob) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const getExportTimestamp = () => new Date().toISOString().replace(/[:.]/g, '-');

export const exportAsJSON = (workouts: Workout[], exerciseDefs: ExerciseDef[]) => {
  const payload = {
    exportedAt: new Date().toISOString(),
    workouts,
    exerciseDefs,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  triggerDownload(`ironlog-export-${getExportTimestamp()}.json`, blob);
};

export const exportAsCSV = (workouts: Workout[], exerciseDefs: ExerciseDef[]) => {
  const defNameById = new Map(exerciseDefs.map((def) => [def.id, def.name]));
  const rows = [
    ['date', 'workout_title', 'workout_note', 'exercise_name', 'set_index', 'weight', 'reps', 'completed'],
  ];

  for (const workout of workouts) {
    for (const exercise of workout.exercises) {
      const exerciseName = defNameById.get(exercise.defId) ?? 'Unknown Exercise';
      exercise.sets.forEach((set, index) => {
        rows.push([
          workout.date,
          workout.title,
          workout.note || '',
          exerciseName,
          String(index + 1),
          String(set.weight),
          String(set.reps),
          String(set.completed),
        ]);
      });
    }
  }

  const csv = rows
    .map((row) => row.map((cell) => csvEscape(cell)).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  triggerDownload(`ironlog-export-${getExportTimestamp()}.csv`, blob);
};
