import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Menu, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ActionMenu from '@/components/ActionMenu';
import WorkoutCard from '@/components/WorkoutCard';
import { Button, Input, Modal } from '@/components/ui';
import { useGym } from '@/hooks/useGym';
import { useI18n } from '@/i18n/useI18n';
import { formatDate } from '@/services/utils';

const Dashboard: React.FC = () => {
  const { workouts, copyWorkout, deleteWorkout, startWorkoutFromTemplate, templates } = useGym();
  const { t } = useI18n();
  const navigate = useNavigate();
  const today = formatDate(new Date());

  const todaysActiveWorkouts = workouts.filter(w => w.date === today && !w.completed);

  const lastWorkout = useMemo(() => {
    return workouts
      .filter(w => w.date < today && w.completed)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  }, [workouts, today]);

  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(null);
  const [targetDate, setTargetDate] = useState(today);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [templateDate, setTemplateDate] = useState(today);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const handleWorkoutClick = (id: string) => {
    navigate(`/workout/${id}`);
  };

  const handleCopyRequest = (id: string) => {
    setSelectedWorkoutId(id);
    setActionMenuOpen(true);
  };

  const confirmCopy = () => {
    if (!selectedWorkoutId) return;
    copyWorkout(selectedWorkoutId, targetDate);
    setCopyModalOpen(false);
  };

  const confirmDelete = () => {
    if (!selectedWorkoutId) return;
    void deleteWorkout(selectedWorkoutId);
    setDeleteModalOpen(false);
    setSelectedWorkoutId(null);
  };

  const openTemplateModal = () => {
    setSelectedTemplateId(templates[0]?.id ?? null);
    setTemplateDate(today);
    setTemplateModalOpen(true);
  };

  const confirmTemplateStart = async () => {
    if (!selectedTemplateId) return;
    const created = await startWorkoutFromTemplate(selectedTemplateId, templateDate);
    if (!created) return;
    setTemplateModalOpen(false);
    navigate(`/workout/${created.id}`);
  };

  const carouselRef = useRef<HTMLDivElement | null>(null);
  const scrollRafRef = useRef<number | null>(null);
  const [activeCardIndex, setActiveCardIndex] = useState(0);

  useEffect(() => {
    setActiveCardIndex(0);
    if (carouselRef.current) carouselRef.current.scrollLeft = 0;
  }, [todaysActiveWorkouts.length, lastWorkout?.id]);

  useEffect(() => {
    return () => {
      if (scrollRafRef.current) window.cancelAnimationFrame(scrollRafRef.current);
    };
  }, []);

  const handleCarouselScroll = () => {
    if (scrollRafRef.current) return;
    scrollRafRef.current = window.requestAnimationFrame(() => {
      scrollRafRef.current = null;
      const el = carouselRef.current;
      if (!el) return;
      const width = el.clientWidth || 1;
      const slideCount = (todaysActiveWorkouts.length > 0 ? todaysActiveWorkouts.length : 1) + (lastWorkout ? 1 : 0);
      const next = Math.max(0, Math.min(slideCount - 1, Math.round(el.scrollLeft / width)));
      setActiveCardIndex(next);
    });
  };

  return (
    <div className="h-full bg-[var(--app-bg)] dark:bg-[var(--app-bg)] flex flex-col overflow-hidden view-enter transition-colors">
      <div className="shrink-0 px-6 pt-8">
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-semibold text-gray-900 dark:text-gray-100 tracking-tight display-serif">{t('dashboard.title')}</h1>
          <button className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 active:bg-gray-200 dark:active:bg-gray-700 transition-colors">
            <Menu size={20} />
          </button>
        </header>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden px-6 pb-[calc(7.5rem+env(safe-area-inset-bottom))]">
        <div className="relative">
          <div
            ref={carouselRef}
            onScroll={handleCarouselScroll}
            className="flex w-full overflow-x-auto overflow-y-hidden snap-x snap-mandatory hide-scrollbar"
            style={{ WebkitOverflowScrolling: 'touch', overscrollBehaviorX: 'contain' }}
          >
            {todaysActiveWorkouts.length > 0 ? (
              todaysActiveWorkouts.map((workout, index) => (
                <div key={workout.id} className="min-w-full snap-start snap-stop-always">
                  <WorkoutCard
                    workout={workout}
                    label={`${t('dashboard.todayPlan')}${todaysActiveWorkouts.length > 1 ? ` (${index + 1}/${todaysActiveWorkouts.length})` : ''}`}
                    isMain={true}
                    onClick={() => handleWorkoutClick(workout.id)}
                    onCopyRequest={() => handleCopyRequest(workout.id)}
                  />
                </div>
              ))
            ) : (
              <div className="min-w-full snap-start snap-stop-always">
                <div className="rounded-[32px] bg-[var(--surface-card)] dark:bg-[var(--surface-card)] p-8 text-center border-2 border-dashed border-[var(--surface-border)] h-56 flex flex-col items-center justify-center transition-colors">
                  <h3 className="font-bold text-xl text-gray-900 dark:text-gray-100 mb-2">
                    {t('dashboard.restDayTitle')}
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-4 text-sm">
                    {t('dashboard.restDayDesc')}
                  </p>
                  <div className="grid grid-cols-2 gap-2 w-full max-w-[260px]">
                    <Button onClick={() => navigate('/workout/new')} className="rounded-full px-6">
                      {t('dashboard.startNow')}
                    </Button>
                    <Button variant="secondary" onClick={openTemplateModal} className="rounded-full px-6">
                      {t('dashboard.fromTemplate')}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {lastWorkout && (
              <div key={lastWorkout.id} className="min-w-full snap-start snap-stop-always">
                <WorkoutCard
                  workout={lastWorkout}
                  label={t('dashboard.lastCompleted')}
                  isMain={false}
                  onClick={() => handleWorkoutClick(lastWorkout.id)}
                  onCopyRequest={() => handleCopyRequest(lastWorkout.id)}
                />
              </div>
            )}
          </div>

          {((todaysActiveWorkouts.length > 0 ? todaysActiveWorkouts.length : 1) + (lastWorkout ? 1 : 0)) > 1 && (
            <div className="pointer-events-none absolute right-4 bottom-4 rounded-full bg-black/55 backdrop-blur-sm text-white/90 text-xs font-black tabular-nums px-2 py-1">
              {activeCardIndex + 1}/{(todaysActiveWorkouts.length > 0 ? todaysActiveWorkouts.length : 1) + (lastWorkout ? 1 : 0)}
            </div>
          )}
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

      <Modal isOpen={copyModalOpen} onClose={() => setCopyModalOpen(false)} title={t('dashboard.copyWorkoutTitle')} position="bottom">
        <p className="mb-4 text-gray-600 dark:text-gray-300">{t('dashboard.copyWorkoutPrompt')}</p>
        <Input type="date" value={targetDate} min={today} onChange={(e) => setTargetDate(e.target.value)} />
        <Button className="w-full mb-3" onClick={confirmCopy}>
          {t('dashboard.schedule')}
        </Button>
        <Button variant="secondary" className="w-full" onClick={() => setCopyModalOpen(false)}>
          {t('dashboard.cancel')}
        </Button>
      </Modal>

      <Modal isOpen={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title={t('history.deleteWorkoutTitle')} position="bottom">
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

      <Modal isOpen={templateModalOpen} onClose={() => setTemplateModalOpen(false)} title={t('dashboard.startFromTemplateTitle')} position="bottom">
        {templates.length === 0 ? (
          <div className="text-center py-6 text-gray-400 dark:text-gray-500 text-sm">{t('dashboard.noTemplatesYet')}</div>
        ) : (
          <>
            <div className="space-y-2 max-h-52 overflow-y-auto mb-4">
              {templates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => setSelectedTemplateId(template.id)}
                  className={`w-full text-left rounded-2xl px-4 py-3 border transition-colors ${
                    selectedTemplateId === template.id
                      ? 'border-brand bg-brand-tint'
                      : 'border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className="font-semibold text-gray-900 dark:text-gray-100">{template.name}</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {template.exercises.length} {t('dashboard.exercises')}
                    {template.source === 'official' ? ` • ${t('common.official')}` : ''}
                  </div>
                </button>
              ))}
            </div>

            <p className="mb-2 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{t('dashboard.date')}</p>
            <Input type="date" value={templateDate} min={today} onChange={(e) => setTemplateDate(e.target.value)} />
            <Button className="w-full mb-3" onClick={confirmTemplateStart} disabled={!selectedTemplateId}>
              {t('dashboard.startWorkout')}
            </Button>
            <Button variant="secondary" className="w-full" onClick={() => setTemplateModalOpen(false)}>
              {t('dashboard.cancel')}
            </Button>
          </>
        )}
      </Modal>
    </div>
  );
};

export default Dashboard;
