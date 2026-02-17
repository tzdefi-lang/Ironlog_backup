import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { exportAsCSV, exportAsJSON } from '@/services/export';
import type { ExerciseDef, Workout } from '@/types';

const workouts: Workout[] = [
  {
    id: 'w1',
    date: '2026-02-11',
    title: 'Push Day',
    note: 'Nice session',
    completed: true,
    elapsedSeconds: 1200,
    startTimestamp: null,
    exercises: [
      {
        id: 'ex1',
        defId: 'bench',
        sets: [
          { id: 's1', weight: 100, reps: 5, completed: true },
        ],
      },
    ],
  },
];

const exerciseDefs: ExerciseDef[] = [
  { id: 'bench', name: 'Bench Press', description: 'Chest' },
];

describe('export service', () => {
  let capturedBlob: Blob | MediaSource | null = null;
  let clickSpy: ReturnType<typeof vi.spyOn>;

  const readCapturedText = () => new Promise<string>((resolve, reject) => {
    if (!capturedBlob) {
      resolve('');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(capturedBlob as Blob);
  });

  beforeEach(() => {
    capturedBlob = null;
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob: Blob | MediaSource) => {
      capturedBlob = blob as Blob;
      return 'blob:mock-url';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exports JSON with workouts and exercise definitions', async () => {
    exportAsJSON(workouts, exerciseDefs);

    expect(capturedBlob).not.toBeNull();
    const parsed = JSON.parse(await readCapturedText());
    expect(parsed.workouts).toHaveLength(1);
    expect(parsed.exerciseDefs).toHaveLength(1);
    expect(parsed.exportedAt).toBeTypeOf('string');
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('exports CSV with expected header and values', async () => {
    exportAsCSV(workouts, exerciseDefs);

    const csv = await readCapturedText();
    const lines = csv.split('\n');
    expect(lines[0]).toBe('date,workout_title,workout_note,exercise_name,set_index,weight,reps,completed');
    expect(lines[1]).toContain('2026-02-11');
    expect(lines[1]).toContain('Push Day');
    expect(lines[1]).toContain('Bench Press');
  });

  it('escapes CSV values that contain commas and quotes', async () => {
    const trickyWorkouts: Workout[] = [
      {
        ...workouts[0],
        title: 'Push, "Elite"',
        note: 'Line1\nLine2',
      },
    ];

    exportAsCSV(trickyWorkouts, exerciseDefs);
    const csv = await readCapturedText();

    expect(csv).toContain('"Push, ""Elite"""');
    expect(csv).toContain('"Line1\nLine2"');
  });

  it('uses fallback name when exercise definition is missing', async () => {
    exportAsCSV(workouts, []);
    const csv = await readCapturedText();
    expect(csv).toContain('Unknown Exercise');
  });
});
