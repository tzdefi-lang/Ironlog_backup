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

type LoadRiskLevel = 'insufficient' | 'low' | 'normal' | 'elevated' | 'high';

type LoadInsight = {
  level: LoadRiskLevel;
  acuteVolume: number;
  baselineVolume: number;
  ratio: number | null;
};

type LoadTrendPoint = {
  key: string;
  label: string;
  volume: number;
  baseline: number;
  isCurrent: boolean;
};

const PIE_COLORS = ['#14b8a6', '#ffff8c', '#ef4444', '#3b82f6', '#84cc16', '#8b5cf6', '#f97316'];
const LOAD_GUARDRAILS = {
  minBaselineVolume: 3000,
  minAbsoluteIncrease: 1200,
  elevatedRatio: 1.28,
  highRatio: 1.45,
  lowRatio: 0.72,
};

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

const getAverage = (values: number[]) => {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const StatsView: React.FC = () => {
  const { workouts, exerciseDefs } = useGymData();
  const { t } = useI18n();
  const numberFormatter = useMemo(() => new Intl.NumberFormat(), []);
  const lineTooltipCursor = {
    stroke: 'var(--stats-cursor-line)',
    strokeWidth: 1,
    strokeDasharray: '4 4',
  };
  const barTooltipCursor = { fill: 'var(--stats-cursor-fill)' };
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

  const loadTrendData = useMemo<LoadTrendPoint[]>(() => {
    return weeklyStats
      .map((point, index, points) => {
        const baselineWindow = points.slice(Math.max(0, index - 4), index).map((entry) => entry.totalVolume);
        return {
          key: point.key,
          label: point.label,
          volume: point.totalVolume,
          baseline: Math.round(getAverage(baselineWindow)),
          isCurrent: index === points.length - 1,
        };
      })
      .slice(-8);
  }, [weeklyStats]);

  const loadInsight = useMemo<LoadInsight>(() => {
    if (weeklyStats.length === 0) {
      return {
        level: 'insufficient',
        acuteVolume: 0,
        baselineVolume: 0,
        ratio: null,
      };
    }

    const acuteVolume = weeklyStats[weeklyStats.length - 1].totalVolume;
    const baselineWindow = weeklyStats.slice(-5, -1).map((entry) => entry.totalVolume);
    const baselineVolumeRaw = getAverage(baselineWindow);
    const baselineVolume = Math.round(baselineVolumeRaw);
    const ratio = baselineVolumeRaw > 0 ? acuteVolume / baselineVolumeRaw : null;
    const absoluteIncrease = acuteVolume - baselineVolumeRaw;
    const weeksWithVolume = baselineWindow.filter((value) => value > 0).length;
    const hasEnoughBaseline = weeksWithVolume >= 2 && baselineVolumeRaw > 0;

    let level: LoadRiskLevel = 'normal';
    if (!hasEnoughBaseline) {
      level = 'insufficient';
    } else if (
      baselineVolumeRaw >= LOAD_GUARDRAILS.minBaselineVolume &&
      absoluteIncrease >= LOAD_GUARDRAILS.minAbsoluteIncrease &&
      ratio !== null &&
      ratio >= LOAD_GUARDRAILS.highRatio
    ) {
      level = 'high';
    } else if (
      baselineVolumeRaw >= LOAD_GUARDRAILS.minBaselineVolume &&
      absoluteIncrease >= LOAD_GUARDRAILS.minAbsoluteIncrease &&
      ratio !== null &&
      ratio >= LOAD_GUARDRAILS.elevatedRatio
    ) {
      level = 'elevated';
    } else if (
      baselineVolumeRaw >= LOAD_GUARDRAILS.minBaselineVolume &&
      ratio !== null &&
      ratio <= LOAD_GUARDRAILS.lowRatio
    ) {
      level = 'low';
    }

    return { level, acuteVolume, baselineVolume, ratio };
  }, [weeklyStats]);

  const loadStatusLabel = useMemo(() => {
    switch (loadInsight.level) {
      case 'high':
        return t('stats.loadStatusHigh');
      case 'elevated':
        return t('stats.loadStatusElevated');
      case 'low':
        return t('stats.loadStatusLow');
      case 'normal':
        return t('stats.loadStatusNormal');
      default:
        return t('stats.loadStatusInsufficient');
    }
  }, [loadInsight.level, t]);

  const loadAdviceText = useMemo(() => {
    switch (loadInsight.level) {
      case 'high':
        return t('stats.loadAdviceHigh');
      case 'elevated':
        return t('stats.loadAdviceElevated');
      case 'low':
        return t('stats.loadAdviceLow');
      case 'normal':
        return t('stats.loadAdviceNormal');
      default:
        return t('stats.loadAdviceInsufficient');
    }
  }, [loadInsight.level, t]);

  const loadBadgeClass = useMemo(() => {
    switch (loadInsight.level) {
      case 'high':
        return 'bg-red-100 text-red-700 dark:bg-red-950/70 dark:text-red-300 border-red-200 dark:border-red-900';
      case 'elevated':
        return 'bg-brand-tint-strong text-brand border-brand';
      case 'low':
        return 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200 dark:border-sky-900';
      case 'normal':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700';
    }
  }, [loadInsight.level]);

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
      <div className="h-full bg-white dark:bg-gray-950 overflow-y-auto overflow-x-hidden scroll-area px-6 pt-8 pb-[calc(7.5rem+env(safe-area-inset-bottom))] view-enter transition-colors">
        <h1 className="text-4xl font-black text-gray-900 dark:text-gray-100 tracking-tight mb-8">{t('stats.title')}</h1>
        <div className="rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-6 py-16 text-center transition-colors">
          <p className="text-gray-500 dark:text-gray-400 font-medium">{t('stats.empty')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-white dark:bg-gray-950 overflow-y-auto overflow-x-hidden scroll-area px-6 pt-8 pb-[calc(7.5rem+env(safe-area-inset-bottom))] view-enter transition-colors">
      <h1 className="text-4xl font-black text-gray-900 dark:text-gray-100 tracking-tight mb-8">{t('stats.title')}</h1>

      <div className="space-y-4 list-stagger">
        <section className="card-lift relative overflow-hidden rounded-3xl border border-brand bg-gradient-to-br from-[rgba(255,255,140,0.26)] via-white to-sky-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-950 p-4 transition-colors">
          <div className="pointer-events-none absolute -top-12 -right-10 h-36 w-36 rounded-full bg-[rgba(255,255,140,0.36)] blur-3xl" />
          <div className="pointer-events-none absolute -bottom-12 -left-10 h-32 w-32 rounded-full bg-sky-200/40 blur-3xl dark:bg-sky-500/10" />
          <div className="relative">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100 uppercase tracking-widest">{t('stats.loadInsightTitle')}</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('stats.loadInsightSubtitle')}</p>
              </div>
              <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide ${loadBadgeClass}`}>
                {loadStatusLabel}
              </span>
            </div>

            <p className="text-sm text-gray-700 dark:text-gray-200 font-medium mb-3">{loadAdviceText}</p>

            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="rounded-2xl border border-white/70 dark:border-gray-800 bg-white/70 dark:bg-gray-900/70 px-3 py-2">
                <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">{t('stats.acuteLoad')}</p>
                <p className="text-sm font-black text-gray-900 dark:text-gray-100 mt-1">{numberFormatter.format(loadInsight.acuteVolume)}</p>
              </div>
              <div className="rounded-2xl border border-white/70 dark:border-gray-800 bg-white/70 dark:bg-gray-900/70 px-3 py-2">
                <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">{t('stats.baselineLoad')}</p>
                <p className="text-sm font-black text-gray-900 dark:text-gray-100 mt-1">{numberFormatter.format(loadInsight.baselineVolume)}</p>
              </div>
              <div className="rounded-2xl border border-white/70 dark:border-gray-800 bg-white/70 dark:bg-gray-900/70 px-3 py-2">
                <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">{t('stats.loadRatio')}</p>
                <p className="text-sm font-black text-gray-900 dark:text-gray-100 mt-1">
                  {loadInsight.ratio === null ? '—' : loadInsight.ratio.toFixed(2)}
                </p>
              </div>
            </div>

            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={loadTrendData} accessibilityLayer={false}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--stats-grid-stroke)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--stats-axis-stroke)" />
                  <YAxis tick={{ fontSize: 11 }} stroke="var(--stats-axis-stroke)" />
                  <Tooltip
                    wrapperStyle={tooltipWrapperStyle}
                    cursor={barTooltipCursor}
                    separator=" · "
                  />
                  <Bar
                    dataKey="volume"
                    radius={[8, 8, 0, 0]}
                    animationDuration={620}
                    animationEasing="ease-out"
                  >
                    {loadTrendData.map((point) => (
                      <Cell
                        key={point.key}
                        fill={point.isCurrent ? 'var(--stats-highlight)' : 'var(--stats-bar-primary)'}
                      />
                    ))}
                  </Bar>
                  <Line
                    type="monotone"
                    dataKey="baseline"
                    stroke="var(--stats-line-secondary)"
                    strokeWidth={2.5}
                    strokeDasharray="5 4"
                    dot={false}
                    animationDuration={760}
                    animationEasing="ease-out"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-3">{t('stats.loadGuardrails')}</p>
          </div>
        </section>

        <section className="card-lift bg-gray-50 dark:bg-gray-900 rounded-3xl p-4 border border-gray-100 dark:border-gray-800 transition-colors">
          <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-widest mb-3">{t('stats.weeklyFrequency')}</h2>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyStats} accessibilityLayer={false}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--stats-grid-stroke)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--stats-axis-stroke)" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="var(--stats-axis-stroke)" />
                <Tooltip
                  wrapperStyle={tooltipWrapperStyle}
                  cursor={lineTooltipCursor}
                  separator=" · "
                />
                <Line
                  type="monotone"
                  dataKey="workoutCount"
                  stroke="var(--stats-line-primary)"
                  strokeWidth={4}
                  dot={{ r: 3.2, fill: 'var(--stats-line-primary)', strokeWidth: 0 }}
                  activeDot={{ r: 4.5 }}
                  animationDuration={560}
                  animationEasing="ease-out"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card-lift bg-gray-50 dark:bg-gray-900 rounded-3xl p-4 border border-gray-100 dark:border-gray-800 transition-colors">
          <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-widest mb-3">{t('stats.weeklyVolume')}</h2>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyStats} accessibilityLayer={false}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--stats-grid-stroke)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--stats-axis-stroke)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--stats-axis-stroke)" />
                <Tooltip
                  wrapperStyle={tooltipWrapperStyle}
                  cursor={barTooltipCursor}
                  separator=" · "
                />
                <Bar
                  dataKey="totalVolume"
                  fill="var(--stats-bar-accent)"
                  radius={[6, 6, 0, 0]}
                  animationDuration={580}
                  animationEasing="ease-out"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card-lift bg-gray-50 dark:bg-gray-900 rounded-3xl p-4 border border-gray-100 dark:border-gray-800 transition-colors">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-widest shrink-0">
              {t('stats.oneRmTrend')}
            </h2>
            <div className="min-w-0 max-w-[58%]">
              <select
                value={selectedExerciseId}
                onChange={(event) => setSelectedExerciseId(event.target.value)}
                disabled={selectableExercises.length === 0}
                className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-700 dark:text-gray-200 outline-none overflow-hidden text-ellipsis whitespace-nowrap"
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
          </div>

          {oneRmTrend.length === 0 ? (
            <div className="text-sm text-gray-400 dark:text-gray-500 py-10 text-center">{t('stats.noCompletedSets')}</div>
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={oneRmTrend} accessibilityLayer={false}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--stats-grid-stroke)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--stats-axis-stroke)" />
                  <YAxis tick={{ fontSize: 11 }} stroke="var(--stats-axis-stroke)" />
                  <Tooltip
                    wrapperStyle={tooltipWrapperStyle}
                    cursor={lineTooltipCursor}
                    separator=" · "
                  />
                  <Line
                    type="monotone"
                    dataKey="oneRM"
                    stroke="var(--stats-line-danger)"
                    strokeWidth={3.6}
                    dot={{ r: 3, fill: 'var(--stats-line-danger)', strokeWidth: 0 }}
                    animationDuration={560}
                    animationEasing="ease-out"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="card-lift bg-gray-50 dark:bg-gray-900 rounded-3xl p-4 border border-gray-100 dark:border-gray-800 transition-colors">
          <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-widest mb-3">{t('stats.workoutDuration')}</h2>
          {durationData.length === 0 ? (
            <div className="text-sm text-gray-400 dark:text-gray-500 py-10 text-center">{t('stats.noElapsedTime')}</div>
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={durationData} accessibilityLayer={false}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--stats-grid-stroke)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--stats-axis-stroke)" />
                  <YAxis tick={{ fontSize: 11 }} stroke="var(--stats-axis-stroke)" />
                  <Tooltip
                    wrapperStyle={tooltipWrapperStyle}
                    cursor={barTooltipCursor}
                    separator=" · "
                  />
                  <Bar
                    dataKey="minutes"
                    fill="var(--stats-line-primary)"
                    radius={[6, 6, 0, 0]}
                    animationDuration={580}
                    animationEasing="ease-out"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="card-lift bg-gray-50 dark:bg-gray-900 rounded-3xl p-4 border border-gray-100 dark:border-gray-800 transition-colors">
          <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-widest mb-3">{t('stats.bodyPartSplit')}</h2>
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
                      animationDuration={680}
                      animationEasing="ease-out"
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
        </section>
      </div>
    </div>
  );
};

export default StatsView;
