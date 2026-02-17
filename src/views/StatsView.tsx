import React, { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ScreenShell, SectionTitle, SurfaceCard } from '@/components/botanical-ui';
import { normalizeCategory } from '@/constants';
import { useGymData } from '@/hooks/useGymData';
import { useI18n } from '@/i18n/useI18n';
import { parseLocalDate } from '@/services/utils';
import type { Workout } from '@/types';

type WeeklyStatsPoint = {
  key: string;
  label: string;
  workoutCount: number;
  totalVolume: number;
};

const PIE_COLORS = ['#8c9a84', '#c27b66', '#7f9b97', '#6f8d73', '#a8b79f', '#6f7f70', '#d4a08e'];

const toDateKey = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getWeekStart = (date: Date) => {
  const local = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = local.getDay();
  const mondayDiff = day === 0 ? -6 : 1 - day;
  local.setDate(local.getDate() + mondayDiff);
  local.setHours(0, 0, 0, 0);
  return local;
};

const getWorkoutVolume = (workout: Workout) => {
  let volume = 0;
  for (const exercise of workout.exercises) {
    for (const set of exercise.sets) {
      if (!set.completed) continue;
      volume += set.weight * set.reps;
    }
  }
  return Math.round(volume);
};

const StatsView: React.FC = () => {
  const { workouts, exerciseDefs } = useGymData();
  const { t } = useI18n();
  const lineTooltipCursor = {
    stroke: 'rgba(141, 130, 119, 0.55)',
    strokeWidth: 1,
    strokeDasharray: '4 4',
  };
  const barTooltipCursor = { fill: 'rgba(220, 207, 194, 0.34)' };
  const tooltipWrapperStyle = { outline: 'none', boxShadow: 'none' };

  const completedWorkouts = useMemo(() => {
    return workouts
      .filter((workout) => workout.completed)
      .sort((a, b) => parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime());
  }, [workouts]);

  const weeklyStats = useMemo<WeeklyStatsPoint[]>(() => {
    const currentWeekStart = getWeekStart(new Date());
    const buckets: WeeklyStatsPoint[] = [];
    for (let offset = 11; offset >= 0; offset--) {
      const weekStart = new Date(currentWeekStart);
      weekStart.setDate(currentWeekStart.getDate() - offset * 7);
      buckets.push({
        key: toDateKey(weekStart),
        label: `${weekStart.getMonth() + 1}/${weekStart.getDate()}`,
        workoutCount: 0,
        totalVolume: 0,
      });
    }

    const bucketByKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));
    for (const workout of completedWorkouts) {
      const weekStart = getWeekStart(parseLocalDate(workout.date));
      const bucket = bucketByKey.get(toDateKey(weekStart));
      if (!bucket) continue;
      bucket.workoutCount += 1;
      bucket.totalVolume += getWorkoutVolume(workout);
    }

    return buckets;
  }, [completedWorkouts]);

  const categoryByDefId = useMemo(
    () => new Map(exerciseDefs.map((def) => [def.id, normalizeCategory(def.category)])),
    [exerciseDefs]
  );

  const selectableExercises = useMemo(() => {
    const defIdsWithCompletedSets = new Set<string>();
    for (const workout of completedWorkouts) {
      for (const exercise of workout.exercises) {
        if (exercise.sets.some((set) => set.completed)) {
          defIdsWithCompletedSets.add(exercise.defId);
        }
      }
    }
    return exerciseDefs.filter((def) => defIdsWithCompletedSets.has(def.id));
  }, [completedWorkouts, exerciseDefs]);

  const [selectedExerciseId, setSelectedExerciseId] = useState('');

  useEffect(() => {
    if (selectableExercises.length === 0) {
      if (selectedExerciseId !== '') setSelectedExerciseId('');
      return;
    }

    const stillExists = selectableExercises.some((exerciseDef) => exerciseDef.id === selectedExerciseId);
    if (!stillExists) {
      setSelectedExerciseId(selectableExercises[0].id);
    }
  }, [selectableExercises, selectedExerciseId]);

  const oneRmTrend = useMemo(() => {
    if (!selectedExerciseId) return [];

    return completedWorkouts
      .map((workout) => {
        let bestOneRM = 0;
        for (const exercise of workout.exercises) {
          if (exercise.defId !== selectedExerciseId) continue;
          for (const set of exercise.sets) {
            if (!set.completed) continue;
            const oneRM = set.weight * (1 + set.reps / 30);
            bestOneRM = Math.max(bestOneRM, oneRM);
          }
        }
        if (bestOneRM <= 0) return null;
        return {
          date: workout.date.slice(5),
          oneRM: Math.round(bestOneRM * 10) / 10,
        };
      })
      .filter((point): point is { date: string; oneRM: number } => point !== null);
  }, [completedWorkouts, selectedExerciseId]);

  const durationData = useMemo(() => {
    const points = completedWorkouts
      .map((workout) => ({
        date: workout.date.slice(5),
        minutes: Math.max(0, Math.round(workout.elapsedSeconds / 60)),
      }))
      .filter((point) => point.minutes > 0)
      .slice(-16);

    return points.map((point, index) => ({
      label: String(index + 1),
      ...point,
    }));
  }, [completedWorkouts]);

  const bodyPartData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const workout of completedWorkouts) {
      for (const exercise of workout.exercises) {
        const category = categoryByDefId.get(exercise.defId) ?? 'Other';
        counts.set(category, (counts.get(category) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [categoryByDefId, completedWorkouts]);

  if (completedWorkouts.length === 0) {
    return (
      <ScreenShell title={t('stats.title')}>
        <SurfaceCard tone="muted" className="border-2 border-dashed border-[var(--surface-border)] px-6 py-16 text-center">
          <p className="text-gray-500 dark:text-gray-400 font-medium">{t('stats.empty')}</p>
        </SurfaceCard>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title={t('stats.title')} contentClassName="pb-[calc(8.9rem+env(safe-area-inset-bottom))]">
      <div className="space-y-4 list-stagger">
        <SurfaceCard tone="muted" className="card-lift p-4">
          <SectionTitle title={t('stats.weeklyFrequency')} />
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyStats} accessibilityLayer={false}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#9ca3af" />
                <Tooltip
                  wrapperStyle={tooltipWrapperStyle}
                  cursor={lineTooltipCursor}
                  separator=" · "
                />
                <Line type="monotone" dataKey="workoutCount" stroke="var(--chart-primary)" strokeWidth={2.5} strokeLinecap="round" dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </SurfaceCard>

        <SurfaceCard tone="muted" className="card-lift p-4">
          <SectionTitle title={t('stats.weeklyVolume')} />
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyStats} accessibilityLayer={false}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
                <Tooltip
                  wrapperStyle={tooltipWrapperStyle}
                  cursor={barTooltipCursor}
                  separator=" · "
                />
                <Bar dataKey="totalVolume" fill="var(--chart-primary)" radius={[12, 12, 8, 8]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SurfaceCard>

        <SurfaceCard tone="muted" className="card-lift p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-widest">{t('stats.oneRmTrend')}</h2>
            <select
              value={selectedExerciseId}
              onChange={(event) => setSelectedExerciseId(event.target.value)}
              disabled={selectableExercises.length === 0}
              className="bg-[var(--surface-card)] dark:bg-[var(--surface-card)] border border-[var(--surface-border)] rounded-xl px-3 py-2 text-sm text-gray-700 dark:text-gray-200 outline-none"
            >
              {selectableExercises.length === 0 ? (
                <option value="">{t('stats.noExerciseData')}</option>
              ) : (
                selectableExercises.map((exerciseDef) => (
                  <option key={exerciseDef.id} value={exerciseDef.id}>
                    {exerciseDef.name}
                  </option>
                ))
              )}
            </select>
          </div>

          {oneRmTrend.length === 0 ? (
            <div className="text-sm text-gray-400 dark:text-gray-500 py-10 text-center">{t('stats.noCompletedSets')}</div>
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={oneRmTrend} accessibilityLayer={false}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
                  <Tooltip
                    wrapperStyle={tooltipWrapperStyle}
                    cursor={lineTooltipCursor}
                    separator=" · "
                  />
                  <Line type="monotone" dataKey="oneRM" stroke="var(--chart-warning)" strokeWidth={2.5} strokeLinecap="round" dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </SurfaceCard>

        <SurfaceCard tone="muted" className="card-lift p-4">
          <SectionTitle title={t('stats.workoutDuration')} />
          {durationData.length === 0 ? (
            <div className="text-sm text-gray-400 dark:text-gray-500 py-10 text-center">{t('stats.noElapsedTime')}</div>
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={durationData} accessibilityLayer={false}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
                  <Tooltip
                    wrapperStyle={tooltipWrapperStyle}
                    cursor={barTooltipCursor}
                    separator=" · "
                  />
                  <Bar dataKey="minutes" fill="var(--chart-secondary)" radius={[12, 12, 8, 8]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </SurfaceCard>

        <SurfaceCard tone="muted" className="card-lift p-4">
          <SectionTitle title={t('stats.bodyPartSplit')} />
          {bodyPartData.length === 0 ? (
            <div className="text-sm text-gray-400 dark:text-gray-500 py-10 text-center">{t('stats.noCategoryData')}</div>
          ) : (
            <div className="grid grid-cols-2 gap-3 items-center">
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart accessibilityLayer={false}>
                    <Pie
                      data={bodyPartData}
                      dataKey="value"
                      nameKey="name"
                      rootTabIndex={-1}
                      innerRadius={38}
                      outerRadius={66}
                      paddingAngle={2}
                    >
                      {bodyPartData.map((entry, index) => (
                        <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      wrapperStyle={tooltipWrapperStyle}
                      cursor={false}
                      separator=" · "
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2">
                {bodyPartData.slice(0, 5).map((entry, index) => (
                  <div key={entry.name} className="flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-300 font-semibold">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                      />
                      {entry.name}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400">{entry.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SurfaceCard>
      </div>
    </ScreenShell>
  );
};

export default StatsView;
