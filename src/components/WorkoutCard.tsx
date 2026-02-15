import React from 'react';
import { Clock, Dumbbell } from 'lucide-react';
import { useLongPress } from '@/components/ui';
import { useI18n } from '@/i18n/useI18n';
import { getDayNumber, getMonthName } from '@/services/utils';
import type { Workout } from '@/types';

interface WorkoutCardProps {
  workout: Workout;
  onClick: () => void;
  onCopyRequest: () => void;
  label?: string;
  isMain?: boolean;
  style?: React.CSSProperties;
}

const WorkoutCard: React.FC<WorkoutCardProps> = ({
  workout,
  onClick,
  onCopyRequest,
  label,
  isMain,
  style,
}) => {
  const { t } = useI18n();
  const longPress = useLongPress(onCopyRequest, onClick);

  const bgClass = isMain
    ? 'bg-gradient-to-br from-lime-300 to-teal-500 text-white shadow-emerald-200/50 dark:shadow-emerald-950/60'
    : 'bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 shadow-gray-100 dark:shadow-black/20';

  const textClass = isMain ? 'text-white' : 'text-gray-900 dark:text-gray-100';
  const subTextClass = isMain ? 'text-teal-50' : 'text-gray-400 dark:text-gray-500';

  return (
    <div
      {...longPress}
      style={style}
      className={`card-lift relative rounded-[32px] p-6 shadow-xl w-full h-56 flex flex-col justify-between cursor-pointer active:scale-[0.98] transition-all overflow-hidden ${bgClass}`}
    >
      <div className="z-10 relative h-full flex flex-col">
        <div className="flex items-center gap-2 mb-2">
          <Dumbbell className={isMain ? 'opacity-70' : 'text-indigo-500 dark:text-indigo-300'} size={18} />
          {label && <span className="text-xs font-bold tracking-widest uppercase opacity-70">{label}</span>}
        </div>

        <h3 className={`text-3xl font-bold uppercase leading-9 tracking-tight max-w-[70%] ${textClass}`}>
          {workout.title}
        </h3>

        <div className="mt-auto">
          <p className={`text-sm font-medium leading-snug max-w-[60%] ${subTextClass}`}>
            {workout.note || t('workoutCard.noNotes')}
          </p>
          {workout.startTimestamp && (
            <div className="mt-2 flex items-center gap-1 text-xs font-bold bg-black/20 w-fit px-2 py-1 rounded-lg animate-pulse">
              <Clock size={12} /> {t('workoutCard.inProgress')}
            </div>
          )}
        </div>
      </div>

      <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none">
        <span className={`text-8xl font-light tracking-tighter ${textClass}`}>{getDayNumber(workout.date)}</span>
        <span className={`text-xl font-medium -mt-2 ${subTextClass}`}>{getMonthName(workout.date)}</span>
      </div>
    </div>
  );
};

export default React.memo(WorkoutCard);
