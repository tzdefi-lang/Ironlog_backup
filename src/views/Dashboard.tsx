import React, { useMemo, useState } from 'react';
import { Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import WorkoutCard from '@/components/WorkoutCard';
import { Button, Input, Modal, useSwipe } from '@/components/ui';
import { useGym } from '@/hooks/useGym';
import { useI18n } from '@/i18n/useI18n';
import { formatDate } from '@/services/utils';

const Dashboard: React.FC = () => {
  const { workouts, copyWorkout, startWorkoutFromTemplate, templates } = useGym();
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

  const handleWorkoutClick = (id: string) => {
    navigate(`/workout/${id}`);
  };

  const handleCopyRequest = (id: string) => {
    setSelectedWorkoutId(id);
    setCopyModalOpen(true);
  };

  const confirmCopy = () => {
    if (!selectedWorkoutId) return;
    copyWorkout(selectedWorkoutId, targetDate);
    setCopyModalOpen(false);
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

  const [topCardIndex, setTopCardIndex] = useState(0);

  const stackSwipeHandlers = useSwipe({
    onSwipeUp: () => {
      if (todaysActiveWorkouts.length > 1) {
        setTopCardIndex(prev => (prev + 1) % todaysActiveWorkouts.length);
      }
    },
    onSwipeDown: () => {
      if (todaysActiveWorkouts.length > 1) {
        setTopCardIndex(prev => (prev - 1 + todaysActiveWorkouts.length) % todaysActiveWorkouts.length);
      }
    },
  });

  return (
    <div className="h-full bg-white dark:bg-gray-950 flex flex-col overflow-hidden view-enter transition-colors">
      <div className="shrink-0 px-6 pt-8">
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-black text-gray-900 dark:text-gray-100 tracking-tight">{t('dashboard.title')}</h1>
          <button className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 active:bg-gray-200 dark:active:bg-gray-700 transition-colors">
            <Menu size={20} />
          </button>
        </header>
      </div>

      <div className="flex-1 overflow-y-auto scroll-area px-6 pb-[calc(7.5rem+env(safe-area-inset-bottom))]">
        <div className="relative min-h-[240px]" {...stackSwipeHandlers}>
          {todaysActiveWorkouts.length > 0 ? (
            <div className="relative w-full h-56">
              {todaysActiveWorkouts.map((workout, index) => {
                const isTop = index === topCardIndex;
                if (!isTop) {
                  return (
                    <div
                      key={workout.id}
                      className="absolute top-0 w-full h-56 rounded-[32px] bg-teal-50 border-2 border-white shadow-lg transition-all duration-500 ease-in-out"
                      style={{
                        zIndex: 0,
                        transform: 'scale(0.9) translateY(15px)',
                        opacity: 0.6,
                      }}
                    >
                      <div className="p-6 opacity-0">Placeholder</div>
                    </div>
                  );
                }

                return (
                  <div key={workout.id} className="absolute top-0 w-full z-40 transition-all duration-500">
                    <WorkoutCard
                      workout={workout}
                      label={`${t('dashboard.todayPlan')} ${todaysActiveWorkouts.length > 1 ? `(${index + 1}/${todaysActiveWorkouts.length})` : ''}`}
                      isMain={true}
                      onClick={() => handleWorkoutClick(workout.id)}
                      onCopyRequest={() => handleCopyRequest(workout.id)}
                    />
                    {todaysActiveWorkouts.length > 1 && (
                      <div className="absolute right-6 top-6 flex flex-col gap-1 items-end z-50 pointer-events-none">
                        <div className="text-[10px] text-white/50 font-bold uppercase tracking-wider">{t('dashboard.swipeVertical')}</div>
                      </div>
                    )}
                    {todaysActiveWorkouts.length > 1 && (
                      <div className="absolute -bottom-6 left-0 w-full flex justify-center gap-2">
                        {todaysActiveWorkouts.map((_, i) => (
                          <div
                            key={i}
                            className={`w-2 h-2 rounded-full ${i === topCardIndex ? 'bg-amber-500' : 'bg-gray-300'}`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-[32px] bg-gray-50 dark:bg-gray-900 p-8 text-center border-2 border-dashed border-gray-200 dark:border-gray-700 h-56 flex flex-col items-center justify-center transition-colors">
              <h3 className="font-bold text-xl text-gray-900 dark:text-gray-100 mb-2">{t('dashboard.restDayTitle')}</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4 text-sm">{t('dashboard.restDayDesc')}</p>
              <div className="grid grid-cols-2 gap-2 w-full max-w-[260px]">
                <Button onClick={() => navigate('/workout/new')} className="rounded-full px-6">
                  {t('dashboard.startNow')}
                </Button>
                <Button
                  variant="secondary"
                  onClick={openTemplateModal}
                  className="rounded-full px-6"
                >
                  {t('dashboard.fromTemplate')}
                </Button>
              </div>
            </div>
          )}
        </div>

        {lastWorkout && (
          <div className="mt-12">
            <h2 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4 ml-2">{t('dashboard.lastCompleted')}</h2>
            <WorkoutCard
              workout={lastWorkout}
              onClick={() => handleWorkoutClick(lastWorkout.id)}
              onCopyRequest={() => handleCopyRequest(lastWorkout.id)}
            />
          </div>
        )}
      </div>

      <Modal isOpen={copyModalOpen} onClose={() => setCopyModalOpen(false)} title={t('dashboard.copyWorkoutTitle')}>
        <p className="mb-4 text-gray-600 dark:text-gray-300">{t('dashboard.copyWorkoutPrompt')}</p>
        <Input type="date" value={targetDate} min={today} onChange={(e) => setTargetDate(e.target.value)} />
        <Button className="w-full mb-3" onClick={confirmCopy}>
          {t('dashboard.schedule')}
        </Button>
        <Button variant="secondary" className="w-full" onClick={() => setCopyModalOpen(false)}>
          {t('dashboard.cancel')}
        </Button>
      </Modal>

      <Modal isOpen={templateModalOpen} onClose={() => setTemplateModalOpen(false)} title={t('dashboard.startFromTemplateTitle')}>
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
                      ? 'border-amber-300 bg-amber-50'
                      : 'border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className="font-semibold text-gray-900 dark:text-gray-100">{template.name}</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {template.exercises.length} {t('dashboard.exercises')}
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
