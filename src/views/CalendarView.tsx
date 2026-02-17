import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, MoreHorizontal, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ActionMenu from '@/components/ActionMenu';
import { ScreenShell, SectionTitle, SurfaceCard } from '@/components/botanical-ui';
import { Button, Input, Modal, useLongPress, useSwipe } from '@/components/ui';
import { useGym } from '@/hooks/useGym';
import { useI18n } from '@/i18n/useI18n';
import { formatDate, getDayNumber, getDisplayDate, parseLocalDate } from '@/services/utils';
import type { Workout } from '@/types';

const CalendarView: React.FC = () => {
  const { workouts, deleteWorkout, copyWorkout } = useGym();
  const { t } = useI18n();
  const navigate = useNavigate();
  const today = formatDate(new Date());

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDayWorkouts, setSelectedDayWorkouts] = useState<Workout[]>([]);
  const [monthAnimation, setMonthAnimation] = useState<{ direction: 'next' | 'prev'; tick: number }>({
    direction: 'next',
    tick: 0,
  });

  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [targetDate, setTargetDate] = useState(today);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const changeMonth = (direction: 'next' | 'prev') => {
    const delta = direction === 'next' ? 1 : -1;
    setMonthAnimation((prev) => ({ direction, tick: prev.tick + 1 }));
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  const handlePrevMonth = () => changeMonth('prev');
  const handleNextMonth = () => changeMonth('next');
  const monthSwipeHandlers = useSwipe({
    onSwipeLeft: handleNextMonth,
    onSwipeRight: handlePrevMonth,
  });

  const monthAnimationClass =
    monthAnimation.tick === 0
      ? ''
      : monthAnimation.direction === 'next'
        ? 'calendar-month-frame--next'
        : 'calendar-month-frame--prev';

  const getWorkoutsForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return workouts.filter((workout) => workout.date === dateStr);
  };

  const handleDayClick = (day: number) => {
    setSelectedDayWorkouts(getWorkoutsForDay(day));
  };

  useEffect(() => {
    const now = new Date();
    if (now.getMonth() === month && now.getFullYear() === year) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const todayWorkouts = workouts.filter((workout) => workout.date === dateStr);
      setSelectedDayWorkouts(todayWorkouts);
    } else {
      setSelectedDayWorkouts([]);
    }
  }, [month, year, workouts]);

  const handleOpenActionMenu = (id: string) => {
    setSelectedActionId(id);
    setActionMenuOpen(true);
  };

  const confirmDelete = () => {
    if (!selectedActionId) return;
    void deleteWorkout(selectedActionId);
    setDeleteModalOpen(false);
    setSelectedActionId(null);
  };

  const confirmCopy = () => {
    if (!selectedActionId) return;
    copyWorkout(selectedActionId, targetDate);
    setCopyModalOpen(false);
    setSelectedActionId(null);
  };

  const CalendarWorkoutRow: React.FC<{ workout: Workout }> = ({ workout }) => {
    const longPress = useLongPress(
      () => handleOpenActionMenu(workout.id),
      () => navigate(`/workout/${workout.id}`)
    );

    return (
      <SurfaceCard {...longPress} interactive className="card-lift p-5 flex justify-between items-center select-none">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 display-serif">{workout.title}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {workout.exercises.length} {t('calendar.exercises')} {workout.completed && '✓'}
          </p>
        </div>
        <MoreHorizontal className="text-gray-400 dark:text-gray-500" size={20} />
      </SurfaceCard>
    );
  };

  return (
    <ScreenShell
      title={t('calendar.title')}
      headerClassName="pb-1"
      contentClassName="pb-[calc(8.9rem+env(safe-area-inset-bottom))]"
    >
      <div>
        <div {...monthSwipeHandlers}>
          <div
            key={`${year}-${month}-${monthAnimation.tick}`}
            className={`calendar-month-frame ${monthAnimationClass} p-5 rounded-[32px] border border-[var(--surface-border)] bg-[var(--surface-card)] shadow-[var(--surface-shadow)] mb-6`}
          >
            <div className="flex justify-between items-center mb-1">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 display-serif">
                {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="w-10 h-10 rounded-full bg-[var(--surface-muted)] border border-[var(--surface-border)] flex items-center justify-center text-gray-600 dark:text-gray-300 transition-all duration-500 ease-out active:scale-[0.98]"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="w-10 h-10 rounded-full bg-[var(--surface-muted)] border border-[var(--surface-border)] flex items-center justify-center text-gray-600 dark:text-gray-300 transition-all duration-500 ease-out active:scale-[0.98]"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 font-semibold mb-5">{t('calendar.swipeHint')}</p>

            <div className="grid grid-cols-7 gap-2 mb-8 text-center select-none">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((dayMark) => (
                <div key={dayMark} className="text-xs font-bold text-gray-500 dark:text-gray-400 py-2">
                  {dayMark}
                </div>
              ))}
              {Array.from({ length: firstDay }).map((_, index) => (
                <div key={`empty-${index}`} className="aspect-square" />
              ))}
              {Array.from({ length: daysInMonth }).map((_, index) => {
                const day = index + 1;
                const dayWorkouts = getWorkoutsForDay(day);
                const isSelected =
                  selectedDayWorkouts.length > 0 &&
                  getDayNumber(selectedDayWorkouts[0].date) === day &&
                  parseLocalDate(selectedDayWorkouts[0].date).getMonth() === month;
                const isToday =
                  day === new Date().getDate() &&
                  month === new Date().getMonth() &&
                  year === new Date().getFullYear();
                return (
                  <div
                    key={day}
                    onClick={() => handleDayClick(day)}
                    className={`aspect-square rounded-2xl flex flex-col items-center justify-center relative cursor-pointer transition-all active:scale-[0.98] ${
                      isSelected
                        ? 'bg-amber-400 text-white shadow-[var(--surface-shadow)]'
                        : isToday
                          ? 'bg-[var(--surface-muted)] text-gray-900 dark:text-gray-100 font-bold'
                          : 'bg-transparent text-gray-700 dark:text-gray-300 hover:bg-[var(--surface-muted)]/70'
                    }`}
                  >
                    <span className="text-sm">{day}</span>
                    {dayWorkouts.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {dayWorkouts.slice(0, 3).map((_, dotIndex) => (
                          <div
                            key={dotIndex}
                            className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-amber-400'}`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <SectionTitle
          title={
            selectedDayWorkouts.length > 0
              ? getDisplayDate(selectedDayWorkouts[0].date)
              : t('calendar.selectDay')
          }
        />
        <div className="space-y-4 list-stagger">
          {selectedDayWorkouts.length === 0 && (
            <SurfaceCard tone="muted" className="text-center py-8 border-2 border-dashed border-[var(--surface-border)]">
              {t('calendar.noWorkouts')}
            </SurfaceCard>
          )}
          {selectedDayWorkouts.map((workout) => (
            <CalendarWorkoutRow key={workout.id} workout={workout} />
          ))}
        </div>
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

      <Modal isOpen={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title={t('calendar.deleteWorkoutTitle')}>
        <div className="text-center">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Trash2 size={32} />
          </div>
          <p className="mb-6 text-gray-600 dark:text-gray-300">{t('calendar.deletePrompt')}</p>
          <Button variant="danger" className="w-full mb-3" onClick={confirmDelete}>
            {t('calendar.deleteConfirm')}
          </Button>
          <Button variant="secondary" className="w-full" onClick={() => setDeleteModalOpen(false)}>
            {t('calendar.cancel')}
          </Button>
        </div>
      </Modal>

      <Modal isOpen={copyModalOpen} onClose={() => setCopyModalOpen(false)} title={t('calendar.copyWorkoutTitle')}>
        <p className="mb-4 text-gray-600 dark:text-gray-300">{t('calendar.copyPrompt')}</p>
        <Input type="date" value={targetDate} min={today} onChange={(e) => setTargetDate(e.target.value)} />
        <Button className="w-full mb-3" onClick={confirmCopy}>
          {t('calendar.schedule')}
        </Button>
        <Button variant="secondary" className="w-full" onClick={() => setCopyModalOpen(false)}>
          {t('calendar.cancel')}
        </Button>
      </Modal>
    </ScreenShell>
  );
};

export default CalendarView;
