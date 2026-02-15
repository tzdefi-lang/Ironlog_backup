import type { ExerciseDef, Workout } from '@/types';

interface ShareWorkoutReportParams {
  workout: Workout;
  exerciseDefs: ExerciseDef[];
  durationMinutes: number;
  percentage: number;
  totalVolume: number;
  currentUnit: string;
  text?: Partial<WorkoutReportCanvasText>;
}

interface WorkoutReportCanvasText {
  workoutFallbackTitle: string;
  durationLabel: string;
  completionLabel: string;
  totalVolumeLabel: string;
  exercisesLabel: string;
  exerciseFallbackName: string;
  minutesShort: string;
  shareTitlePrefix: string;
}

const DEFAULT_TEXT: WorkoutReportCanvasText = {
  workoutFallbackTitle: 'Workout',
  durationLabel: 'Duration',
  completionLabel: 'Completion',
  totalVolumeLabel: 'TOTAL VOLUME',
  exercisesLabel: 'Exercises',
  exerciseFallbackName: 'Exercise',
  minutesShort: 'min',
  shareTitlePrefix: 'Workout',
};

export const shareWorkoutReportCanvas = async ({
  workout,
  exerciseDefs,
  durationMinutes,
  percentage,
  totalVolume,
  currentUnit,
  text,
}: ShareWorkoutReportParams) => {
  const resolvedText: WorkoutReportCanvasText = { ...DEFAULT_TEXT, ...text };
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  const roundRect = (
    c: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) => {
    const radius = Math.max(0, Math.min(r, w / 2, h / 2));
    c.beginPath();
    c.moveTo(x + radius, y);
    c.arcTo(x + w, y, x + w, y + h, radius);
    c.arcTo(x + w, y + h, x, y + h, radius);
    c.arcTo(x, y + h, x, y, radius);
    c.arcTo(x, y, x + w, y, radius);
    c.closePath();
  };

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#FFFBEB';
  ctx.fillRect(0, 0, W, 240);
  ctx.fillStyle = '#111827';
  ctx.font = '900 64px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial';
  ctx.fillText('IronLog', 72, 110);
  ctx.font = '800 42px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial';
  const title = (workout.title || resolvedText.workoutFallbackTitle).slice(0, 28);
  ctx.fillText(title, 72, 180);
  ctx.font = '600 28px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial';
  ctx.fillStyle = '#6B7280';
  ctx.fillText(workout.date, 72, 220);

  const cardY = 280;
  const cardH = 150;
  const gap = 24;
  const cardW = (W - 72 * 2 - gap) / 2;

  const drawCard = (x: number, y: number, label: string, value: string) => {
    ctx.fillStyle = '#F9FAFB';
    roundRect(ctx, x, y, cardW, cardH, 28);
    ctx.fill();
    ctx.fillStyle = '#9CA3AF';
    ctx.font = '800 22px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial';
    ctx.fillText(label.toUpperCase(), x + 26, y + 42);
    ctx.fillStyle = '#111827';
    ctx.font = '900 48px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial';
    ctx.fillText(value, x + 26, y + 106);
  };

  drawCard(72, cardY, resolvedText.durationLabel, `${durationMinutes} ${resolvedText.minutesShort}`);
  drawCard(72 + cardW + gap, cardY, resolvedText.completionLabel, `${percentage}%`);

  ctx.fillStyle = '#F9FAFB';
  roundRect(ctx, 72, cardY + cardH + gap, W - 144, cardH, 28);
  ctx.fill();
  ctx.fillStyle = '#9CA3AF';
  ctx.font = '800 22px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial';
  ctx.fillText(resolvedText.totalVolumeLabel, 98, cardY + cardH + gap + 42);
  ctx.fillStyle = '#111827';
  ctx.font = '900 56px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial';
  ctx.fillText(`${Math.round(totalVolume)} ${currentUnit}`, 98, cardY + cardH + gap + 112);

  let y = 690;
  ctx.fillStyle = '#111827';
  ctx.font = '900 28px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial';
  ctx.fillText(resolvedText.exercisesLabel, 72, y);
  y += 24;
  ctx.strokeStyle = '#E5E7EB';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(72, y);
  ctx.lineTo(W - 72, y);
  ctx.stroke();
  y += 26;

  ctx.font = '700 26px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial';
  ctx.fillStyle = '#111827';

  for (const ex of workout.exercises) {
    const def = exerciseDefs.find(d => d.id === ex.defId);
    const name = (def?.name || resolvedText.exerciseFallbackName).slice(0, 34);
    ctx.fillText(name, 72, y);
    y += 34;

    ctx.fillStyle = '#6B7280';
    ctx.font = '600 22px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial';
    const line = ex.sets
      .map((s, idx) => `${idx + 1}) ${s.weight}×${s.reps}${s.completed ? ' ✓' : ''}`)
      .join('   ');

    const maxWidth = W - 144;
    const words = line.split(' ');
    let current = '';
    for (const w of words) {
      const next = current ? `${current} ${w}` : w;
      if (ctx.measureText(next).width > maxWidth) {
        ctx.fillText(current, 72, y);
        y += 28;
        current = w;
      } else {
        current = next;
      }
    }
    if (current) {
      ctx.fillText(current, 72, y);
      y += 32;
    }

    ctx.fillStyle = '#E5E7EB';
    ctx.beginPath();
    ctx.moveTo(72, y);
    ctx.lineTo(W - 72, y);
    ctx.stroke();
    y += 30;

    if (y > H - 80) break;

    ctx.fillStyle = '#111827';
    ctx.font = '700 26px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial';
  }

  const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Failed to generate image');

  const file = new File([blob], `ironlog-${workout.date}.png`, { type: 'image/png' });
  const canShareFiles = typeof navigator !== 'undefined' && (navigator as any).canShare?.({ files: [file] });
  if (canShareFiles && (navigator as any).share) {
    await (navigator as any).share({
      title: `${resolvedText.shareTitlePrefix} • ${workout.date}`,
      text: `${workout.title || resolvedText.workoutFallbackTitle} — ${durationMinutes} ${resolvedText.minutesShort} • ${Math.round(totalVolume)} ${currentUnit}`,
      files: [file],
    });
    return;
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ironlog-${workout.date}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};
