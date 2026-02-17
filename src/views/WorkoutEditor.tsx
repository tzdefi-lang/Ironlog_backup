import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { CreateExerciseInput } from '@/components/CreateExerciseModal';
import type { EditExerciseInput } from '@/components/EditExerciseModal';
import WorkoutEditorView from '@/components/WorkoutEditorView';
import { pushToast } from '@/components/ui';
import { useGym } from '@/hooks/useGym';
import { useConfirm } from '@/hooks/useConfirm';
import { useExerciseReorder } from '@/hooks/useExerciseReorder';
import { useWorkoutReport } from '@/hooks/useWorkoutReport';
import { useWorkoutTimer } from '@/hooks/useWorkoutTimer';
import { useI18n } from '@/i18n/useI18n';
import { uploadMediaToSupabase } from '@/services/supabase';
import { generateId, getMediaFromDB, processAndSaveMedia } from '@/services/utils';
import type { ExerciseDef, ExerciseInstance, Set, Workout } from '@/types';
import { createDraftWorkout, workoutReducer } from '@/views/workoutEditorState';

const WorkoutEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useI18n();
  const {
    workouts,
    addWorkout,
    updateWorkout,
    deleteWorkout,
    exerciseDefs,
    addExerciseDef,
    updateExerciseDef,
    deleteExerciseDef,
    addTemplateFromWorkout,
    user,
    setRestTimerSeconds,
  } = useGym();
  const { confirm, confirmDialog } = useConfirm();

  const [workout, dispatchWorkout] = useReducer(
    workoutReducer,
    undefined,
    () => createDraftWorkout(t('workoutEditor.newWorkoutTitle'))
  );

  const [showExModal, setShowExModal] = useState(false);
  const [showCreateExModal, setShowCreateExModal] = useState(false);
  const [showEditExModal, setShowEditExModal] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showRestTimer, setShowRestTimer] = useState(false);
  const [restTimerRestartToken, setRestTimerRestartToken] = useState(0);
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);

  const unit = user?.preferences.defaultUnit ?? 'lbs';
  const restTimerSeconds = user?.preferences.restTimerSeconds ?? 90;
  const currentUnit = unit.toUpperCase();

  const { currentTime, durationMinutes, setCurrentTime } = useWorkoutTimer(workout);

  const loadedIdRef = useRef<string | null>(null);
  const isHydratingRef = useRef(false);
  const isDirtyRef = useRef(false);
  const editSeqRef = useRef(0);
  const autosaveTimerRef = useRef<number | null>(null);
  const addExerciseTimerRef = useRef<number | null>(null);

  const markDirty = () => {
    isDirtyRef.current = true;
    editSeqRef.current += 1;
  };

  useEffect(() => {
    if (!id) return;

    if (id === 'new') {
      if (loadedIdRef.current === 'new') return;
      isHydratingRef.current = true;
      isDirtyRef.current = false;
      dispatchWorkout({ type: 'replace', workout: createDraftWorkout(t('workoutEditor.newWorkoutTitle')) });
      setCurrentTime(0);
      loadedIdRef.current = 'new';
      setTimeout(() => { isHydratingRef.current = false; }, 0);
      return;
    }

    if (loadedIdRef.current === id) return;
    if (isDirtyRef.current) return;

    const existing = workouts.find(w => w.id === id);
    if (!existing) return;

    isHydratingRef.current = true;
    dispatchWorkout({ type: 'replace', workout: existing });
    const elapsed = existing.elapsedSeconds || 0;
    const additional = existing.startTimestamp ? (Date.now() - existing.startTimestamp) / 1000 : 0;
    setCurrentTime(elapsed + additional);
    loadedIdRef.current = id;
    isDirtyRef.current = false;
    setTimeout(() => { isHydratingRef.current = false; }, 0);
  }, [id, workouts, t, setCurrentTime]);

  const saveWorkoutToContext = useCallback((nextWorkout: Workout) => {
    const exists = workouts.some(existing => existing.id === nextWorkout.id);
    if (exists) void updateWorkout(nextWorkout);
    else void addWorkout(nextWorkout);
  }, [addWorkout, updateWorkout, workouts]);

  const clearAutosaveTimer = useCallback(() => {
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
  }, []);

  const persistImmediately = useCallback((nextWorkout: Workout) => {
    clearAutosaveTimer();
    saveWorkoutToContext(nextWorkout);
    isDirtyRef.current = false;
  }, [clearAutosaveTimer, saveWorkoutToContext]);

  const scheduleAutosave = useCallback((nextWorkout: Workout) => {
    if (isHydratingRef.current) return;
    if (!isDirtyRef.current) return;
    if (nextWorkout.exercises.length === 0) return;

    const seq = editSeqRef.current;
    clearAutosaveTimer();

    autosaveTimerRef.current = window.setTimeout(() => {
      saveWorkoutToContext(nextWorkout);
      if (seq === editSeqRef.current) {
        isDirtyRef.current = false;
      }
    }, 650);
  }, [clearAutosaveTimer, saveWorkoutToContext]);

  useEffect(() => () => clearAutosaveTimer(), [clearAutosaveTimer]);

  useEffect(() => () => {
    if (addExerciseTimerRef.current) {
      window.clearTimeout(addExerciseTimerRef.current);
      addExerciseTimerRef.current = null;
    }
  }, []);

  const startRestTimer = useCallback(() => {
    setShowRestTimer(true);
    setRestTimerRestartToken(prev => prev + 1);
  }, []);

  const toggleTimer = useCallback(() => {
    if (workout.completed) return;
    const now = Date.now();
    let updated: Workout;
    if (workout.startTimestamp) {
      const sessionDuration = (now - workout.startTimestamp) / 1000;
      const newElapsed = (workout.elapsedSeconds || 0) + sessionDuration;
      updated = { ...workout, startTimestamp: null, elapsedSeconds: newElapsed };
    } else {
      updated = { ...workout, startTimestamp: now };
    }
    markDirty();
    dispatchWorkout({ type: 'replace', workout: updated });
    if (updated.exercises.length > 0) persistImmediately(updated);
  }, [persistImmediately, workout]);

  const handleFinish = async () => {
    if (workout.exercises.length === 0) {
      if (workouts.some(w => w.id === workout.id)) await deleteWorkout(workout.id);
      navigate('/');
      return;
    }
    const now = Date.now();
    let finalElapsed = workout.elapsedSeconds || 0;
    if (workout.startTimestamp) finalElapsed += (now - workout.startTimestamp) / 1000;
    const updated = { ...workout, completed: true, startTimestamp: null, elapsedSeconds: finalElapsed };
    dispatchWorkout({ type: 'replace', workout: updated });
    persistImmediately(updated);

    const shouldSaveTemplate = await confirm({
      title: t('workoutEditor.saveTemplateTitle'),
      message: t('workoutEditor.saveTemplatePrompt'),
      confirmText: t('workoutEditor.saveTemplateConfirm'),
      cancelText: t('workoutEditor.saveTemplateSkip'),
    });

    if (shouldSaveTemplate) {
      await addTemplateFromWorkout(
        `${updated.title || t('workoutEditor.defaultWorkoutName')} ${t('workoutEditor.templateSuffix')}`,
        updated
      );
    }

    setShowReport(true);
  };

  const handleResume = () => {
    const updated = { ...workout, completed: false };
    dispatchWorkout({ type: 'replace', workout: updated });
    persistImmediately(updated);
  };

  const handleExitReport = () => {
    setShowReport(false);
    navigate('/');
  };

  const handleSaveBack = async () => {
    clearAutosaveTimer();
    if (workout.exercises.length === 0) {
      if (workouts.some(w => w.id === workout.id)) await deleteWorkout(workout.id);
      navigate('/');
      return;
    }

    persistImmediately(workout);
    navigate('/');
  };

  const addExercise = useCallback((defId: string) => {
    setShowExModal(false);
    if (addExerciseTimerRef.current) {
      window.clearTimeout(addExerciseTimerRef.current);
    }
    addExerciseTimerRef.current = window.setTimeout(() => {
      let baseWorkout = workout;
      if (workout.completed) baseWorkout = { ...workout, completed: false };
      const newInstance: ExerciseInstance = {
        id: generateId(),
        defId,
        sets: [{ id: generateId(), weight: 0, reps: 0, completed: false }],
      };
      const updated = { ...baseWorkout, exercises: [...baseWorkout.exercises, newInstance] };
      markDirty();
      dispatchWorkout({ type: 'replace', workout: updated });
      persistImmediately(updated);
      addExerciseTimerRef.current = null;
    }, 170);
  }, [persistImmediately, workout]);

  const handleReorderExercises = useCallback((nextExercises: ExerciseInstance[]) => {
    markDirty();
    dispatchWorkout({ type: 'setExercises', exercises: nextExercises });
    scheduleAutosave({ ...workout, exercises: nextExercises });
  }, [scheduleAutosave, workout]);

  const {
    setCardRef,
    startExerciseReorder,
    moveExerciseReorderPointer,
    endExerciseReorderPointer,
    moveExercise,
    getCardStyle,
    isDragging,
  } = useExerciseReorder({
    exercises: workout.exercises,
    onReorder: handleReorderExercises,
  });

  const openEditExercise = (def: ExerciseDef) => {
    setEditingExerciseId(def.id);
    setShowExModal(false);
    setShowCreateExModal(false);
    setShowEditExModal(true);
  };

  const handleUpdateExercise = async (payload: EditExerciseInput) => {
    const original = exerciseDefs.find((d) => d.id === payload.id);
    if (!original) return;

    const trimmedName = payload.name.trim() || original.name;
    const updated: ExerciseDef = {
      ...original,
      name: trimmedName,
      description: payload.description,
      category: payload.category || 'Other',
      usesBarbell: payload.usesBarbell,
      barbellWeight: payload.barbellWeight,
    };
    await updateExerciseDef(updated);
    setEditingExerciseId(null);
  };

  const handleCreateExercise = async (payload: CreateExerciseInput) => {
    const def: ExerciseDef = {
      id: generateId(),
      name: payload.name,
      description: payload.description,
      category: payload.category || 'Other',
      usesBarbell: payload.usesBarbell,
      barbellWeight: payload.barbellWeight,
    };

    try {
      if (payload.mediaFile) {
        const { id: localId, type } = await processAndSaveMedia(payload.mediaFile);
        const blob = await getMediaFromDB(localId);
        if (blob) {
          const ext = type === 'video' ? 'mp4' : 'jpg';
          const path = `${user?.id || 'anonymous'}/${Date.now()}_${def.id}.${ext}`;
          const publicUrl = await uploadMediaToSupabase(blob, path);
          def.mediaUrl = publicUrl;
          def.mediaType = type;
        }
      }

      await addExerciseDef(def);
      addExercise(def.id);
    } catch (e: any) {
      pushToast({
        kind: 'error',
        message: `${t('workoutEditor.errorPrefix')}: ${e?.message || t('workoutEditor.unknownError')}`,
      });
      throw e;
    }
  };

  const handleDeleteExerciseFromPicker = async (def: ExerciseDef, isUsed: boolean) => {
    if (isUsed) {
      pushToast({ kind: 'info', message: t('workoutEditor.exerciseInUse') });
      return;
    }

    const accepted = await confirm({
      title: t('workoutEditor.deleteExercise'),
      message: `${t('workoutEditor.deleteExercisePromptPrefix')} "${def.name}"?`,
      confirmText: t('workoutEditor.delete'),
      cancelText: t('workoutEditor.cancel'),
      danger: true,
    });
    if (accepted) await deleteExerciseDef(def.id);
  };

  const updateSet = (exId: string, setId: string, field: keyof Set, value: any) => {
    const previousSet = workout.exercises
      .find(ex => ex.id === exId)
      ?.sets.find(set => set.id === setId);
    const shouldStartRest =
      field === 'completed' &&
      value === true &&
      previousSet?.completed === false;

    const updated = {
      ...workout,
      exercises: workout.exercises.map(ex => (
        ex.id === exId
          ? { ...ex, sets: ex.sets.map(s => (s.id === setId ? { ...s, [field]: value } : s)) }
          : ex
      )),
    };
    markDirty();
    dispatchWorkout({ type: 'replace', workout: updated });
    scheduleAutosave(updated);
    if (shouldStartRest) startRestTimer();
  };

  const addSet = (exId: string) => {
    const updated = {
      ...workout,
      exercises: workout.exercises.map(ex => {
        if (ex.id !== exId) return ex;
        const last = ex.sets[ex.sets.length - 1];
        return {
          ...ex,
          sets: [...ex.sets, {
            id: generateId(),
            weight: last?.weight || 0,
            reps: last?.reps || 0,
            completed: false,
          }],
        };
      }),
    };
    markDirty();
    dispatchWorkout({ type: 'replace', workout: updated });
    scheduleAutosave(updated);
  };

  const deleteSet = (exId: string, setId: string) => {
    const updated = {
      ...workout,
      exercises: workout.exercises.map(ex => {
        if (ex.id !== exId) return ex;
        const next = ex.sets.filter(s => s.id !== setId);
        return {
          ...ex,
          sets: next.length > 0 ? next : [{ id: generateId(), weight: 0, reps: 0, completed: false }],
        };
      }),
    };
    markDirty();
    dispatchWorkout({ type: 'replace', workout: updated });
    scheduleAutosave(updated);
  };

  const removeExerciseFromWorkout = (exerciseId: string) => {
    const exercises = workout.exercises.filter((exercise) => exercise.id !== exerciseId);
    markDirty();
    dispatchWorkout({ type: 'setExercises', exercises });
    scheduleAutosave({ ...workout, exercises });
  };

  const handleTitleChange = (title: string) => {
    markDirty();
    dispatchWorkout({ type: 'setTitle', title });
    scheduleAutosave({ ...workout, title });
  };

  const handleNoteChange = (note: string) => {
    markDirty();
    dispatchWorkout({ type: 'setNote', note });
    scheduleAutosave({ ...workout, note });
  };

  const {
    historicalPRs,
    brokenPRs,
    animMinutes,
    animCompletion,
    animVolume,
    handleShareReport,
  } = useWorkoutReport({
    workout,
    workouts,
    exerciseDefs,
    unit,
    currentUnit,
    durationMinutes,
    showReport,
    t,
  });

  const editingExercise = useMemo(
    () => exerciseDefs.find((def) => def.id === editingExerciseId) || null,
    [exerciseDefs, editingExerciseId]
  );

  return (
    <WorkoutEditorView
      workout={workout}
      workouts={workouts}
      exerciseDefs={exerciseDefs}
      unit={unit}
      currentUnit={currentUnit}
      currentTime={currentTime}
      restTimerSeconds={restTimerSeconds}
      showExModal={showExModal}
      showCreateExModal={showCreateExModal}
      showEditExModal={showEditExModal}
      showReport={showReport}
      showRestTimer={showRestTimer}
      restTimerRestartToken={restTimerRestartToken}
      editingExercise={editingExercise}
      historicalPRs={historicalPRs}
      brokenPRs={brokenPRs}
      animMinutes={animMinutes}
      animCompletion={animCompletion}
      animVolume={animVolume}
      confirmDialog={confirmDialog}
      t={t}
      onBack={() => { void handleSaveBack(); }}
      onToggleTimer={toggleTimer}
      onStartRestTimer={startRestTimer}
      onFinish={() => { void handleFinish(); }}
      onResume={handleResume}
      onTitleChange={handleTitleChange}
      onNoteChange={handleNoteChange}
      onOpenExercisePicker={() => setShowExModal(true)}
      onAddExercise={addExercise}
      onOpenEditExercise={openEditExercise}
      onRemoveExerciseFromWorkout={removeExerciseFromWorkout}
      onMoveExercise={moveExercise}
      onHandlePointerDown={startExerciseReorder}
      onHandlePointerMove={moveExerciseReorderPointer}
      onHandlePointerUp={endExerciseReorderPointer}
      onUpdateSet={updateSet}
      onDeleteSet={deleteSet}
      onAddSet={addSet}
      getCardStyle={getCardStyle}
      isDragging={isDragging}
      setCardRef={setCardRef}
      onCloseExercisePicker={() => setShowExModal(false)}
      onDeleteExerciseDef={handleDeleteExerciseFromPicker}
      onOpenCreateExerciseModal={() => setShowCreateExModal(true)}
      onCloseCreateExerciseModal={() => setShowCreateExModal(false)}
      onCreateExercise={handleCreateExercise}
      onCloseEditExerciseModal={() => {
        setShowEditExModal(false);
        setEditingExerciseId(null);
      }}
      onEditExercise={handleUpdateExercise}
      onShareReport={() => { void handleShareReport(); }}
      onCloseReport={handleExitReport}
      onCloseRestTimer={() => setShowRestTimer(false)}
      onDurationChange={setRestTimerSeconds}
    />
  );
};

export default WorkoutEditor;
