import React from 'react';
import { ArrowLeft, Check, Clock3, Pause, Play } from 'lucide-react';
import type { CSSProperties } from 'react';
import CreateExerciseModal, { type CreateExerciseInput } from '@/components/CreateExerciseModal';
import EditExerciseModal, { type EditExerciseInput } from '@/components/EditExerciseModal';
import ExerciseCard from '@/components/ExerciseCard';
import ExercisePickerModal from '@/components/ExercisePickerModal';
import RestTimer from '@/components/RestTimer';
import SessionReport from '@/components/SessionReport';
import { Button } from '@/components/ui';
import { formatDuration } from '@/services/utils';
import type { ExerciseDef, Set, Unit, Workout } from '@/types';
import type { ExercisePR, PRBreak } from '@/services/pr';

type WorkoutEditorViewProps = {
  workout: Workout;
  workouts: Workout[];
  exerciseDefs: ExerciseDef[];
  unit: Unit;
  currentUnit: string;
  currentTime: number;
  restTimerSeconds: number;
  showExModal: boolean;
  showCreateExModal: boolean;
  showEditExModal: boolean;
  showReport: boolean;
  showRestTimer: boolean;
  restTimerRestartToken: number;
  editingExercise: ExerciseDef | null;
  historicalPRs: Record<string, ExercisePR>;
  brokenPRs: PRBreak[];
  animMinutes: number;
  animCompletion: number;
  animVolume: number;
  confirmDialog: React.ReactNode;
  t: (key: string) => string;
  onBack: () => void;
  onToggleTimer: () => void;
  onStartRestTimer: () => void;
  onFinish: () => void;
  onResume: () => void;
  onTitleChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onOpenExercisePicker: () => void;
  onAddExercise: (defId: string) => void;
  onOpenEditExercise: (def: ExerciseDef) => void;
  onRemoveExerciseFromWorkout: (exerciseId: string) => void;
  onMoveExercise: (exerciseId: string, direction: 'up' | 'down') => void;
  onHandlePointerDown: (exerciseId: string, e: React.PointerEvent) => void;
  onHandlePointerMove: (exerciseId: string, e: React.PointerEvent) => void;
  onHandlePointerUp: (exerciseId: string, e: React.PointerEvent) => void;
  onUpdateSet: (exerciseId: string, setId: string, field: keyof Set, value: any) => void;
  onDeleteSet: (exerciseId: string, setId: string) => void;
  onAddSet: (exerciseId: string) => void;
  getCardStyle: (exerciseId: string, index: number) => CSSProperties | undefined;
  isDragging: (exerciseId: string) => boolean;
  setCardRef: (exerciseId: string) => (el: HTMLDivElement | null) => void;
  onCloseExercisePicker: () => void;
  onDeleteExerciseDef: (def: ExerciseDef, isUsed: boolean) => void | Promise<void>;
  onOpenCreateExerciseModal: () => void;
  onCloseCreateExerciseModal: () => void;
  onCreateExercise: (payload: CreateExerciseInput) => Promise<void>;
  onCloseEditExerciseModal: () => void;
  onEditExercise: (payload: EditExerciseInput) => Promise<void>;
  onShareReport: () => void;
  onCloseReport: () => void;
  onCloseRestTimer: () => void;
  onDurationChange: (seconds: number) => void;
};

const WorkoutEditorView: React.FC<WorkoutEditorViewProps> = ({
  workout,
  workouts,
  exerciseDefs,
  unit,
  currentUnit,
  currentTime,
  restTimerSeconds,
  showExModal,
  showCreateExModal,
  showEditExModal,
  showReport,
  showRestTimer,
  restTimerRestartToken,
  editingExercise,
  historicalPRs,
  brokenPRs,
  animMinutes,
  animCompletion,
  animVolume,
  confirmDialog,
  t,
  onBack,
  onToggleTimer,
  onStartRestTimer,
  onFinish,
  onResume,
  onTitleChange,
  onNoteChange,
  onOpenExercisePicker,
  onAddExercise,
  onOpenEditExercise,
  onRemoveExerciseFromWorkout,
  onMoveExercise,
  onHandlePointerDown,
  onHandlePointerMove,
  onHandlePointerUp,
  onUpdateSet,
  onDeleteSet,
  onAddSet,
  getCardStyle,
  isDragging,
  setCardRef,
  onCloseExercisePicker,
  onDeleteExerciseDef,
  onOpenCreateExerciseModal,
  onCloseCreateExerciseModal,
  onCreateExercise,
  onCloseEditExerciseModal,
  onEditExercise,
  onShareReport,
  onCloseReport,
  onCloseRestTimer,
  onDurationChange,
}) => {
  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-950 view-enter transition-colors">
      <div className="bg-white/80 dark:bg-gray-950/85 backdrop-blur-md px-4 py-3 flex items-center justify-between sticky top-0 z-20 border-b border-gray-100 dark:border-gray-800 shadow-sm transition-colors">
        <button
          onClick={onBack}
          aria-label={t('workoutEditor.back')}
          title={t('workoutEditor.back')}
          className="w-10 h-10 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 active:scale-95 transition-transform"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex flex-col items-center" onClick={onToggleTimer}>
          <span className={`text-xl font-black font-mono tracking-widest ${workout.startTimestamp ? 'text-green-500' : 'text-gray-400 dark:text-gray-500'}`}>{formatDuration(currentTime)}</span>
          <span className="text-[10px] uppercase font-bold text-gray-300">
            {workout.startTimestamp ? t('workoutEditor.running') : t('workoutEditor.paused')}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onStartRestTimer}
            className="w-10 h-10 rounded-full flex items-center justify-center text-white bg-sky-500 shadow-lg shadow-sky-300/45 dark:shadow-sky-900/45 active:scale-95 transition-all"
            aria-label={`${t('workoutEditor.restTimer')} (${restTimerSeconds}s)`}
            title={`${t('workoutEditor.restTimer')} (${restTimerSeconds}s)`}
          >
            <Clock3 size={18} />
          </button>
          {!workout.completed && (
            <button
              onClick={onToggleTimer}
              aria-label={workout.startTimestamp ? t('workoutEditor.pauseTimer') : t('workoutEditor.startTimer')}
              title={workout.startTimestamp ? t('workoutEditor.pauseTimer') : t('workoutEditor.startTimer')}
              className={`w-10 h-10 rounded-full flex items-center justify-center text-white active:scale-95 transition-all ${workout.startTimestamp ? 'bg-amber-400 shadow-amber-300/55 dark:shadow-amber-900/45' : 'bg-green-400 shadow-green-300/55 dark:shadow-green-900/45'} shadow-lg`}
            >
              {workout.startTimestamp ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
            </button>
          )}
          <button
            onClick={onFinish}
            data-testid="finish-workout-button"
            aria-label={t('workoutEditor.finishWorkout')}
            title={t('workoutEditor.finishWorkout')}
            className={`w-10 h-10 rounded-full flex items-center justify-center text-white shadow-lg active:scale-95 transition-all ${workout.completed ? 'bg-gray-300 dark:bg-gray-700' : 'bg-amber-400 shadow-amber-300/55 dark:shadow-amber-900/45'}`}
          >
            <Check size={20} strokeWidth={3} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scroll-area p-6 pb-[calc(8rem+env(safe-area-inset-bottom))]">
        <input
          data-testid="workout-title-input"
          value={workout.title}
          onChange={e => onTitleChange(e.target.value)}
          className="text-3xl font-black bg-transparent w-full mb-2 outline-none text-gray-900 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600"
          placeholder={t('workoutEditor.workoutTitlePlaceholder')}
        />
        <input
          value={workout.note}
          onChange={e => onNoteChange(e.target.value)}
          className="text-base text-gray-500 dark:text-gray-400 bg-transparent w-full mb-8 outline-none placeholder-gray-300 dark:placeholder-gray-600"
          placeholder={t('workoutEditor.workoutNotePlaceholder')}
        />
        <div className="space-y-6">
          {workout.exercises.map((ex, index) => {
            const def = exerciseDefs.find(d => d.id === ex.defId);
            if (!def) return null;

            return (
              <ExerciseCard
                key={ex.id}
                ex={ex}
                def={def}
                index={index}
                total={workout.exercises.length}
                currentUnit={currentUnit}
                unit={unit}
                historicalPR={historicalPRs[def.id]}
                isDragging={isDragging(ex.id)}
                style={getCardStyle(ex.id, index)}
                outerRef={setCardRef(ex.id)}
                onOpenEdit={() => onOpenEditExercise(def)}
                onRemove={() => onRemoveExerciseFromWorkout(ex.id)}
                onMoveUp={() => onMoveExercise(ex.id, 'up')}
                onMoveDown={() => onMoveExercise(ex.id, 'down')}
                onHandlePointerDown={(e) => onHandlePointerDown(ex.id, e)}
                onHandlePointerMove={(e) => onHandlePointerMove(ex.id, e)}
                onHandlePointerUp={(e) => onHandlePointerUp(ex.id, e)}
                onHandlePointerCancel={(e) => onHandlePointerUp(ex.id, e)}
                onUpdateSet={(setId, field, value) => onUpdateSet(ex.id, setId, field, value)}
                onDeleteSet={(setId) => onDeleteSet(ex.id, setId)}
                onAddSet={() => onAddSet(ex.id)}
              />
            );
          })}
          <Button
            data-testid="add-exercise-button"
            onClick={onOpenExercisePicker}
            variant="secondary"
            className="w-full py-4 bg-gray-200 text-gray-600"
          >
            {t('workoutEditor.addExercise')}
          </Button>
          {workout.completed && (
            <Button onClick={onResume} variant="primary" className="w-full py-4 bg-amber-400 shadow-amber-300/55 dark:shadow-amber-900/45 mt-4">
              {t('workoutEditor.resumeWorkout')}
            </Button>
          )}
        </div>
      </div>

      <ExercisePickerModal
        isOpen={showExModal}
        onClose={onCloseExercisePicker}
        onAdd={onAddExercise}
        onEdit={onOpenEditExercise}
        onDelete={onDeleteExerciseDef}
        onCreateNew={onOpenCreateExerciseModal}
        exerciseDefs={exerciseDefs}
        workouts={workouts}
        title={t('workoutEditor.exercisesTitle')}
        hint={t('workoutEditor.exercisesHint')}
        noExercisesInLabel={t('workoutEditor.noExercisesIn')}
        createNewLabel={t('workoutEditor.createNew')}
      />

      <CreateExerciseModal
        isOpen={showCreateExModal}
        onClose={onCloseCreateExerciseModal}
        onCreate={onCreateExercise}
        unit={unit}
        currentUnit={currentUnit}
        labels={{
          title: t('workoutEditor.newExerciseTitle'),
          name: t('workoutEditor.name'),
          description: t('workoutEditor.description'),
          barbell: t('workoutEditor.barbell'),
          usesBarbell: t('workoutEditor.usesBarbell'),
          addMedia: t('workoutEditor.addMedia'),
          processing: t('workoutEditor.processing'),
          save: t('workoutEditor.save'),
        }}
      />

      <EditExerciseModal
        isOpen={showEditExModal}
        onClose={onCloseEditExerciseModal}
        exerciseDef={editingExercise}
        onSave={onEditExercise}
        unit={unit}
        currentUnit={currentUnit}
        labels={{
          title: t('workoutEditor.editExerciseTitle'),
          name: t('workoutEditor.name'),
          description: t('workoutEditor.description'),
          barbell: t('workoutEditor.barbell'),
          usesBarbell: t('workoutEditor.usesBarbell'),
          saveChanges: t('workoutEditor.saveChanges'),
        }}
      />

      <SessionReport
        isOpen={showReport}
        currentUnit={currentUnit}
        animMinutes={animMinutes}
        animCompletion={animCompletion}
        animVolume={animVolume}
        prBreaks={brokenPRs}
        onShare={onShareReport}
        onClose={onCloseReport}
      />
      <RestTimer
        isOpen={showRestTimer}
        durationSeconds={restTimerSeconds}
        restartToken={restTimerRestartToken}
        onClose={onCloseRestTimer}
        onDurationChange={onDurationChange}
      />
      {confirmDialog}
    </div>
  );
};

export default WorkoutEditorView;
