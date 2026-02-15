import React, { useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowLeft, Filter, Trash2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ActionMenu from '@/components/ActionMenu';
import { HistorySkeleton } from '@/components/Skeleton';
import { Button, Input, Modal, SwipeableItem, useLongPress } from '@/components/ui';
import { BODY_PART_OPTIONS, normalizeCategory } from '@/constants';
import { useGym } from '@/hooks/useGym';
import { useI18n } from '@/i18n/useI18n';
import { formatDate, getDayNumber, getMonthName } from '@/services/utils';
import type { Workout } from '@/types';

type StatusFilter = 'all' | 'completed' | 'in_progress';

type HistoryFilters = {
  query: string;
  year: string;
  month: string;
  category: string;
  status: StatusFilter;
};

const DEFAULT_FILTERS: HistoryFilters = {
  query: '',
  year: 'all',
  month: 'all',
  category: 'all',
  status: 'all',
};

const HistoryView: React.FC = () => {
  const { workouts, exerciseDefs, copyWorkout, deleteWorkout, isLoading } = useGym();
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const today = formatDate(new Date());
  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/profile');
  };

  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);

  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [targetDate, setTargetDate] = useState(today);

  const [filters, setFilters] = useState<HistoryFilters>(DEFAULT_FILTERS);
  const [draftFilters, setDraftFilters] = useState<HistoryFilters>(DEFAULT_FILTERS);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const listParentRef = useRef<HTMLDivElement | null>(null);

  const exerciseCategoryByDefId = useMemo(
    () => new Map(exerciseDefs.map((def) => [def.id, normalizeCategory(def.category)])),
    [exerciseDefs]
  );

  const yearOptions = useMemo(() => {
    const years = Array.from(new Set(workouts.map((workout) => workout.date.slice(0, 4))));
    return years.sort((a, b) => Number(b) - Number(a));
  }, [workouts]);

  const categoryOptions = useMemo(() => {
    const categories = new Set<string>(BODY_PART_OPTIONS);
    for (const def of exerciseDefs) {
      categories.add(normalizeCategory(def.category));
    }
    return Array.from(categories);
  }, [exerciseDefs]);

  const monthOptions = useMemo(() => {
    const localeTag = locale === 'zh' ? 'zh-CN' : 'en-US';
    return Array.from({ length: 12 }, (_, index) => {
      const monthNumber = String(index + 1).padStart(2, '0');
      const label = new Date(2000, index, 1).toLocaleString(localeTag, { month: 'long' });
      return { value: monthNumber, label };
    });
  }, [locale]);

  const hasActiveFilters = useMemo(() => {
    return (
      filters.query.trim() !== '' ||
      filters.year !== 'all' ||
      filters.month !== 'all' ||
      filters.category !== 'all' ||
      filters.status !== 'all'
    );
  }, [filters]);

  const filteredWorkouts = useMemo(() => {
    let list = [...workouts];

    const query = filters.query.trim().toLowerCase();
    if (query) {
      list = list.filter((workout) => workout.title.toLowerCase().includes(query));
    }

    if (filters.year !== 'all') {
      list = list.filter((workout) => workout.date.slice(0, 4) === filters.year);
    }

    if (filters.month !== 'all') {
      list = list.filter((workout) => workout.date.slice(5, 7) === filters.month);
    }

    if (filters.category !== 'all') {
      list = list.filter((workout) =>
        workout.exercises.some((exercise) => exerciseCategoryByDefId.get(exercise.defId) === filters.category)
      );
    }

    if (filters.status === 'completed') {
      list = list.filter((workout) => workout.completed);
    } else if (filters.status === 'in_progress') {
      list = list.filter((workout) => !workout.completed);
    }

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [workouts, filters, exerciseCategoryByDefId]);

  const rowVirtualizer = useVirtualizer({
    count: filteredWorkouts.length,
    getScrollElement: () => listParentRef.current,
    estimateSize: () => 122,
    overscan: 8,
  });

  const handleOpenActionMenu = (id: string) => {
    setSelectedActionId(id);
    setActionMenuOpen(true);
  };
  const handleCopySwipe = (id: string) => {
    setSelectedActionId(id);
    setTargetDate(today);
    setCopyModalOpen(true);
  };
  const handleDeleteSwipe = (id: string) => {
    setSelectedActionId(id);
    setDeleteModalOpen(true);
  };
  const confirmCopy = () => {
    if (selectedActionId) {
      copyWorkout(selectedActionId, targetDate);
      setCopyModalOpen(false);
      setSelectedActionId(null);
    }
  };
  const confirmDelete = () => {
    if (selectedActionId) {
      void deleteWorkout(selectedActionId);
      setDeleteModalOpen(false);
      setSelectedActionId(null);
    }
  };
  const applyFilters = () => {
    setFilters(draftFilters);
    setIsFilterModalOpen(false);
  };

  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setDraftFilters(DEFAULT_FILTERS);
    setIsFilterModalOpen(false);
  };

  const WorkoutRow: React.FC<{ workout: Workout }> = ({ workout }) => {
    const longPress = useLongPress(
      () => handleOpenActionMenu(workout.id),
      () => navigate(`/workout/${workout.id}`)
    );

    return (
      <div
        {...longPress}
        className="card-lift bg-white dark:bg-gray-900 p-5 rounded-3xl shadow-lg shadow-gray-100 dark:shadow-black/20 border border-gray-50 dark:border-gray-800 flex justify-between items-center active:scale-[0.99] transition-transform cursor-pointer select-none"
      >
        <div className="flex items-center gap-4">
          <div className="bg-brand-tint text-brand border border-brand w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg">
            {getDayNumber(workout.date)}
          </div>
          <div>
            <h3 className="font-bold text-gray-900 dark:text-gray-100 text-lg">{workout.title}</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wide">
              {getMonthName(workout.date)} • {workout.exercises.length} {t('history.exercises')}
              {workout.completed && <span className="ml-2 text-green-500">✓ {t('history.done')}</span>}
            </p>
          </div>
        </div>
        <div className={`w-2 h-2 rounded-full ${workout.completed ? 'bg-green-400' : 'bg-orange-300'}`} />
      </div>
    );
  };

  if (isLoading) {
    return <HistorySkeleton />;
  }

  return (
    <div className="h-full bg-white dark:bg-gray-950 flex flex-col overflow-hidden view-enter transition-colors">
      <div className="shrink-0 px-6 pt-8">
        <header className="flex justify-between items-center mb-8 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={handleBack}
              aria-label={t('profile.back')}
              className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors shrink-0"
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-3xl font-black text-gray-900 dark:text-gray-100 tracking-tight truncate">{t('history.title')}</h1>
          </div>
          <button
            onClick={() => {
              setDraftFilters(filters);
              setIsFilterModalOpen(true);
            }}
            data-testid="history-filter-button"
            aria-label={t('history.filterButtonAria')}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
              hasActiveFilters ? 'bg-brand text-gray-900' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
            }`}
          >
            <Filter size={20} />
          </button>
        </header>
      </div>

      <div className="flex-1 px-6 pb-[calc(7.5rem+env(safe-area-inset-bottom))] overflow-hidden flex flex-col">
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2 mb-4 shrink-0">
            {filters.query.trim() !== '' && (
              <button
                onClick={() => setFilters((prev) => ({ ...prev, query: '' }))}
                className="inline-flex items-center gap-1 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-full text-xs font-semibold text-gray-600 dark:text-gray-300"
              >
                {t('history.nameChip')}: {filters.query}
                <X size={12} />
              </button>
            )}
            {filters.year !== 'all' && (
              <button
                onClick={() => setFilters((prev) => ({ ...prev, year: 'all' }))}
                className="inline-flex items-center gap-1 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-full text-xs font-semibold text-gray-600 dark:text-gray-300"
              >
                {t('history.yearChip')}: {filters.year}
                <X size={12} />
              </button>
            )}
            {filters.month !== 'all' && (
              <button
                onClick={() => setFilters((prev) => ({ ...prev, month: 'all' }))}
                className="inline-flex items-center gap-1 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-full text-xs font-semibold text-gray-600 dark:text-gray-300"
              >
                {t('history.monthChip')}: {monthOptions.find((m) => m.value === filters.month)?.label || filters.month}
                <X size={12} />
              </button>
            )}
            {filters.category !== 'all' && (
              <button
                onClick={() => setFilters((prev) => ({ ...prev, category: 'all' }))}
                className="inline-flex items-center gap-1 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-full text-xs font-semibold text-gray-600 dark:text-gray-300"
              >
                {t('history.categoryChip')}: {filters.category}
                <X size={12} />
              </button>
            )}
            {filters.status !== 'all' && (
              <button
                onClick={() => setFilters((prev) => ({ ...prev, status: 'all' }))}
                className="inline-flex items-center gap-1 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-full text-xs font-semibold text-gray-600 dark:text-gray-300"
              >
                {t('history.statusChip')}: {filters.status === 'completed' ? t('history.statusCompleted') : t('history.statusInProgress')}
                <X size={12} />
              </button>
            )}
          </div>
        )}

        <div ref={listParentRef} className="flex-1 overflow-y-auto scroll-area">
          {filteredWorkouts.length === 0 ? (
            <div className="text-center py-20 text-gray-400 dark:text-gray-500">
              <p>{t('history.empty')}</p>
            </div>
          ) : (
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const workout = filteredWorkouts[virtualRow.index];
                if (!workout) return null;

                return (
                  <div
                    key={workout.id}
                    ref={rowVirtualizer.measureElement}
                    data-index={virtualRow.index}
                    className="absolute top-0 left-0 w-full pb-4"
                    style={{
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <SwipeableItem
                      onSwipeRight={() => handleCopySwipe(workout.id)}
                      onSwipeLeft={() => handleDeleteSwipe(workout.id)}
                      containerClassName="mb-0"
                    >
                      <WorkoutRow workout={workout} />
                    </SwipeableItem>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <ActionMenu
          isOpen={actionMenuOpen}
          onClose={() => setActionMenuOpen(false)}
          onCopy={() => {
            setTargetDate(today);
            setCopyModalOpen(true);
          }}
          onDelete={() => setDeleteModalOpen(true)}
        />

        <Modal isOpen={copyModalOpen} onClose={() => setCopyModalOpen(false)} title={t('history.copyWorkoutTitle')}>
          <p className="mb-4 text-gray-600 dark:text-gray-300">{t('history.copyPrompt')}</p>
          <Input type="date" value={targetDate} min={today} onChange={(e) => setTargetDate(e.target.value)} />
          <Button className="w-full mb-3" onClick={confirmCopy}>
            {t('history.schedule')}
          </Button>
          <Button variant="secondary" className="w-full" onClick={() => setCopyModalOpen(false)}>
            {t('history.cancel')}
          </Button>
        </Modal>

        <Modal isOpen={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title={t('history.deleteWorkoutTitle')}>
          <div className="text-center">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 size={32} />
            </div>
            <p className="mb-6 text-gray-600 dark:text-gray-300">{t('history.deletePrompt')}</p>
            <Button variant="danger" className="w-full mb-3" onClick={confirmDelete}>
              {t('history.deleteConfirm')}
            </Button>
            <Button variant="secondary" className="w-full" onClick={() => setDeleteModalOpen(false)}>
              {t('history.cancel')}
            </Button>
          </div>
        </Modal>

        <Modal isOpen={isFilterModalOpen} onClose={() => setIsFilterModalOpen(false)} title={t('history.filterTitle')}>
          <div className="flex flex-col gap-4">
            <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{t('history.workoutNameLabel')}</label>
              <Input
                placeholder={t('history.workoutNamePlaceholder')}
                value={draftFilters.query}
                onChange={(e) => setDraftFilters((prev) => ({ ...prev, query: e.target.value }))}
                className="mb-0"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{t('history.yearLabel')}</label>
                <select
                  value={draftFilters.year}
                  onChange={(e) => setDraftFilters((prev) => ({ ...prev, year: e.target.value }))}
                  className="w-full bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-4 py-3 rounded-2xl outline-none border border-transparent focus-border-brand"
                >
                  <option value="all">{t('history.allYears')}</option>
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{t('history.monthLabel')}</label>
                <select
                  value={draftFilters.month}
                  onChange={(e) => setDraftFilters((prev) => ({ ...prev, month: e.target.value }))}
                  className="w-full bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-4 py-3 rounded-2xl outline-none border border-transparent focus-border-brand"
                >
                  <option value="all">{t('history.allMonths')}</option>
                  {monthOptions.map((month) => (
                    <option key={month.value} value={month.value}>
                      {month.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{t('history.bodyPartLabel')}</label>
              <select
                value={draftFilters.category}
                onChange={(e) => setDraftFilters((prev) => ({ ...prev, category: e.target.value }))}
                className="w-full bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-4 py-3 rounded-2xl outline-none border border-transparent focus-border-brand"
              >
                <option value="all">{t('history.allCategories')}</option>
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{t('history.completionLabel')}</label>
              <select
                value={draftFilters.status}
                onChange={(e) =>
                  setDraftFilters((prev) => ({ ...prev, status: e.target.value as StatusFilter }))
                }
                className="w-full bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-4 py-3 rounded-2xl outline-none border border-transparent focus-border-brand"
              >
                <option value="all">{t('history.all')}</option>
                <option value="completed">{t('history.statusCompleted')}</option>
                <option value="in_progress">{t('history.statusInProgress')}</option>
              </select>
            </div>

            <Button className="w-full" onClick={applyFilters}>
              {t('history.applyFilters')}
            </Button>
            <Button variant="secondary" className="w-full" onClick={clearFilters}>
              {t('history.clearFilters')}
            </Button>
          </div>
        </Modal>
      </div>
    </div>
  );
};

export default HistoryView;
