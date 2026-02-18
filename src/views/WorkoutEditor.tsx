import React, { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ArrowLeft, Camera, Check, Clock3, Pause, Play, Plus, Trash2, Youtube } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import CategoryPicker from '@/components/CategoryPicker';
import BottomSheet from '@/components/BottomSheet';
import ExerciseDetailModal from '@/components/ExerciseDetailModal';
import ExerciseCard from '@/components/ExerciseCard';
import ExercisePickerRow from '@/components/ExercisePickerRow';
import RestTimer from '@/components/RestTimer';
import SessionReport from '@/components/SessionReport';
import SetNumberInput from '@/components/SetNumberInput';
import { shareWorkoutReportCanvas } from '@/components/WorkoutReportCanvas';
import { Button, Input, pushToast } from '@/components/ui';
import { BODY_PART_OPTIONS, getDefaultBarbellWeight, normalizeCategory } from '@/constants';
import { useConfirm } from '@/hooks/useConfirm';
import { useGym } from '@/hooks/useGym';
import { useI18n } from '@/i18n/useI18n';
import { mergeMarkdownWithUrls } from '@/services/markdown';
import { calculateBrokenPRs, calculatePRs } from '@/services/pr';
import { normalizeYouTubeUrl } from '@/services/officialContent';
import { uploadMediaToSupabase } from '@/services/supabase';
import { formatDate, formatDuration, generateId, getMediaFromDB, processAndSaveMedia } from '@/services/utils';
import type { ExerciseDef, ExerciseInstance, ExerciseMediaItem, Set, Workout } from '@/types';

type WorkoutAction =
  | { type: 'replace'; workout: Workout }
  | { type: 'setTitle'; title: string }
  | { type: 'setNote'; note: string }
  | { type: 'setExercises'; exercises: ExerciseInstance[] };

type DraftMediaItem = {
  id: string;
  kind: 'upload';
  contentType: 'image' | 'video';
  url: string;
  title: string;
  file?: File;
};

const createDraftWorkout = (title = 'New Workout'): Workout => ({
  id: generateId(),
  date: formatDate(new Date()),
  title,
  note: '',
  exercises: [],
  completed: false,
  elapsedSeconds: 0,
  startTimestamp: null,
});

const workoutReducer = (state: Workout, action: WorkoutAction): Workout => {
  switch (action.type) {
    case 'replace':
      return action.workout;
    case 'setTitle':
      return { ...state, title: action.title };
    case 'setNote':
      return { ...state, note: action.note };
    case 'setExercises':
      return { ...state, exercises: action.exercises };
    default:
      return state;
  }
};

const uploadExerciseFile = async (ownerId: string, file: File) => {
  const { id, type } = await processAndSaveMedia(file);
  const processed = await getMediaFromDB(id);
  const uploadBlob = processed ?? file;
  const mime = uploadBlob.type.toLowerCase();
  let ext = 'jpg';
  if (type === 'video') {
    ext = 'mp4';
    if (mime.includes('quicktime')) ext = 'mov';
    else if (mime.includes('webm')) ext = 'webm';
    else if (mime.includes('mp4')) ext = 'mp4';
    else {
      const fromName = file.name.split('.').pop()?.toLowerCase();
      if (fromName && ['mp4', 'mov', 'webm', 'm4v'].includes(fromName)) {
        ext = fromName === 'm4v' ? 'mp4' : fromName;
      }
    }
  }
  const path = `${ownerId}/${Date.now()}_${generateId()}.${ext}`;
  const url = await uploadMediaToSupabase(uploadBlob, path);
  return { url, type };
};

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
  const [newExName, setNewExName] = useState('');
  const [newExDesc, setNewExDesc] = useState('');
  const [newExCategory, setNewExCategory] = useState('Other');
  const [newExUsesBarbell, setNewExUsesBarbell] = useState(false);
  const [newExBarbellWeight, setNewExBarbellWeight] = useState(0);
  const [newExThumbnailUrl, setNewExThumbnailUrl] = useState('');
  const [newExThumbnailFile, setNewExThumbnailFile] = useState<File | null>(null);
  const [newExMarkdown, setNewExMarkdown] = useState('');
  const [newExMediaItems, setNewExMediaItems] = useState<DraftMediaItem[]>([]);
  const [newExYoutubeInput, setNewExYoutubeInput] = useState('');
  const newExMarkdownRef = useRef<HTMLTextAreaElement | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const unit = user?.preferences.defaultUnit ?? 'lbs';
  const restTimerSeconds = user?.preferences.restTimerSeconds ?? 90;
  const currentUnit = unit.toUpperCase();
  const [showRestTimer, setShowRestTimer] = useState(false);
  const [restTimerRestartToken, setRestTimerRestartToken] = useState(0);

  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);
  const [editExName, setEditExName] = useState('');
  const [editExDesc, setEditExDesc] = useState('');
  const [editExCategory, setEditExCategory] = useState('Other');
  const [editExUsesBarbell, setEditExUsesBarbell] = useState(false);
  const [editExBarbellWeight, setEditExBarbellWeight] = useState(0);
  const [editExThumbnailUrl, setEditExThumbnailUrl] = useState('');
  const [editExThumbnailFile, setEditExThumbnailFile] = useState<File | null>(null);
  const [editExMarkdown, setEditExMarkdown] = useState('');
  const [editExMediaItems, setEditExMediaItems] = useState<DraftMediaItem[]>([]);
  const [editExYoutubeInput, setEditExYoutubeInput] = useState('');
  const editExMarkdownRef = useRef<HTMLTextAreaElement | null>(null);
  const [detailExerciseDef, setDetailExerciseDef] = useState<ExerciseDef | null>(null);
  const [detailExerciseInstance, setDetailExerciseInstance] = useState<ExerciseInstance | null>(null);

  const [exPickerCategory, setExPickerCategory] = useState<string>('Other');

  type ExerciseReorderState = {
    id: string;
    startIndex: number;
    overIndex: number;
    startPointerY: number;
    startMidY: number;
    offsetY: number;
    itemHeight: number;
    gap: number;
    itemMids: Array<{ id: string; mid: number }>;
  };

  const [exerciseReorder, setExerciseReorder] = useState<ExerciseReorderState | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const reorderPendingRef = useRef<{
    id: string;
    pointerId: number;
    startX: number;
    startY: number;
    handleEl: HTMLElement;
  } | null>(null);
  const reorderTimerRef = useRef<number | null>(null);
  const reorderActiveRef = useRef<{ pointerId: number; handleEl: HTMLElement } | null>(null);
  const reorderRafRef = useRef<number | null>(null);
  const reorderLatestYRef = useRef<number>(0);
  const reorderAnimFromRef = useRef<Record<string, number> | null>(null);
  const addExerciseTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!showCreateExModal) return;
    setNewExCategory('Other');
    setNewExUsesBarbell(false);
    setNewExBarbellWeight(getDefaultBarbellWeight(unit));
    setNewExThumbnailUrl('');
    setNewExThumbnailFile(null);
    setNewExMarkdown('');
    setNewExMediaItems([]);
    setNewExYoutubeInput('');
  }, [showCreateExModal, unit]);

  const exDefsByCategory = useMemo<Record<string, ExerciseDef[]>>(() => {
    const map: Record<string, ExerciseDef[]> = {};
    for (const cat of BODY_PART_OPTIONS) map[cat] = [];
    for (const def of exerciseDefs) {
      const cat = normalizeCategory(def.category);
      map[cat] = map[cat] || [];
      map[cat].push(def);
    }
    for (const cat of Object.keys(map)) {
      map[cat].sort((a, b) => a.name.localeCompare(b.name));
    }
    return map;
  }, [exerciseDefs]);

  const filteredExerciseDefs = useMemo(() => {
    return (exDefsByCategory[exPickerCategory] || []).slice();
  }, [exDefsByCategory, exPickerCategory]);

  useEffect(() => {
    if (!showExModal) return;
    const currentCount = (exDefsByCategory[exPickerCategory] || []).length;
    if (currentCount > 0) return;
    const first =
      BODY_PART_OPTIONS.find(cat => (exDefsByCategory[cat] || []).length > 0) || 'Other';
    if (first !== exPickerCategory) setExPickerCategory(first);
  }, [showExModal, exDefsByCategory, exPickerCategory]);

  const loadedIdRef = useRef<string | null>(null);
  const isHydratingRef = useRef(false);
  const isDirtyRef = useRef(false);
  const editSeqRef = useRef(0);
  const autosaveTimerRef = useRef<number | null>(null);

  const markDirty = () => {
    isDirtyRef.current = true;
    editSeqRef.current += 1;
  };

  useEffect(() => {
    if (!id) return;

    // New workout route: initialize a fresh draft.
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

    // Existing workout: load once when available, but never clobber local edits.
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
  }, [id, workouts, t]);

  useEffect(() => {
      let interval: number;
      if (workout.startTimestamp && !workout.completed) {
          interval = window.setInterval(() => {
             const elapsed = workout.elapsedSeconds || 0;
             const additional = (Date.now() - (workout.startTimestamp || Date.now())) / 1000;
             setCurrentTime(elapsed + additional);
          }, 1000);
      } else {
          setCurrentTime(workout.elapsedSeconds || 0);
      }
      return () => clearInterval(interval);
  }, [workout.startTimestamp, workout.elapsedSeconds, workout.completed]);

  const saveWorkoutToContext = useCallback((w: Workout) => {
    const exists = workouts.some(existing => existing.id === w.id);
    if (exists) updateWorkout(w);
    else addWorkout(w);
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
    // Debounced autosave: keeps context/DB in sync without saving every keystroke immediately.
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

  const toggleTimer = () => {
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
  };

  const handleFinish = async () => {
      if (workout.exercises.length === 0) {
          if (workouts.some(w => w.id === workout.id)) deleteWorkout(workout.id);
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

  const handleExitReport = () => { setShowReport(false); navigate('/'); };
  const handleSaveBack = () => {
      clearAutosaveTimer();
      if (workout.exercises.length === 0) {
          if (workouts.some(w => w.id === workout.id)) deleteWorkout(workout.id);
          navigate('/');
      } else {
          persistImmediately(workout);
          navigate('/');
      }
  };

  const addExercise = (defId: string) => {
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
  };

  const setCardRef = (exerciseId: string) => (el: HTMLDivElement | null) => {
    cardRefs.current[exerciseId] = el;
  };

  const captureReorderFromTops = () => {
    const tops: Record<string, number> = {};
    for (const ex of workout.exercises) {
      const el = cardRefs.current[ex.id];
      if (el) tops[ex.id] = el.getBoundingClientRect().top;
    }
    reorderAnimFromRef.current = tops;
  };

  // FLIP animation for "move up/down" and drag-drop reorder.
  useLayoutEffect(() => {
    const from = reorderAnimFromRef.current;
    if (!from) return;
    reorderAnimFromRef.current = null;

    const ids = workout.exercises.map(ex => ex.id);
    for (const id of ids) {
      const el = cardRefs.current[id];
      if (!el) continue;
      const prevTop = from[id];
      if (prevTop == null) continue;
      const nextTop = el.getBoundingClientRect().top;
      const delta = prevTop - nextTop;
      if (Math.abs(delta) < 1) continue;

      el.style.transform = `translate3d(0, ${delta}px, 0)`;
      el.style.transition = 'transform 0s';

      requestAnimationFrame(() => {
        el.style.transition = 'transform 240ms cubic-bezier(0.2, 0.8, 0.2, 1)';
        el.style.transform = '';
      });

      window.setTimeout(() => {
        el.style.transition = '';
      }, 280);
    }
  }, [workout.exercises]);

  const cancelPendingReorder = () => {
    if (reorderTimerRef.current) window.clearTimeout(reorderTimerRef.current);
    reorderTimerRef.current = null;
    reorderPendingRef.current = null;
  };

  const startExerciseReorder = (exerciseId: string, e: React.PointerEvent) => {
    if (exerciseReorder) return;
    // Don't start a second gesture if we already have one pending.
    cancelPendingReorder();

    const handleEl = e.currentTarget as HTMLElement;
    reorderPendingRef.current = {
      id: exerciseId,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      handleEl
    };

    // Long-press to activate drag.
    reorderTimerRef.current = window.setTimeout(() => {
      const pending = reorderPendingRef.current;
      if (!pending || pending.id !== exerciseId) return;

      const rects: Array<{ id: string; top: number; height: number; mid: number }> = [];
      for (const ex of workout.exercises) {
        const el = cardRefs.current[ex.id];
        if (!el) {
          cancelPendingReorder();
          return;
        }
        const r = el.getBoundingClientRect();
        rects.push({ id: ex.id, top: r.top, height: r.height, mid: r.top + r.height / 2 });
      }

      const startIndex = rects.findIndex(r => r.id === pending.id);
      if (startIndex === -1) {
        cancelPendingReorder();
        return;
      }

      let gap = 24;
      for (let i = 0; i < rects.length - 1; i++) {
        const g = rects[i + 1].top - (rects[i].top + rects[i].height);
        if (Number.isFinite(g) && g > 0) {
          gap = g;
          break;
        }
      }

      try {
        pending.handleEl.setPointerCapture(pending.pointerId);
      } catch {
        // ignore
      }

      reorderActiveRef.current = { pointerId: pending.pointerId, handleEl: pending.handleEl };

      try {
        document.body.style.userSelect = 'none';
        document.body.style.webkitUserSelect = 'none';
      } catch {
        // ignore
      }

      cancelPendingReorder();

      setExerciseReorder({
        id: pending.id,
        startIndex,
        overIndex: startIndex,
        startPointerY: pending.startY,
        startMidY: rects[startIndex].mid,
        offsetY: 0,
        itemHeight: rects[startIndex].height,
        gap,
        itemMids: rects.map(r => ({ id: r.id, mid: r.mid }))
      });
    }, 500);
  };

  const updateExerciseReorder = (clientY: number) => {
    reorderLatestYRef.current = clientY;
    if (reorderRafRef.current) return;
    reorderRafRef.current = requestAnimationFrame(() => {
      reorderRafRef.current = null;
      setExerciseReorder((prev) => {
        if (!prev) return prev;
        const offsetY = reorderLatestYRef.current - prev.startPointerY;
        const centerY = prev.startMidY + offsetY;

        let overIndex = 0;
        for (const item of prev.itemMids) {
          if (item.id === prev.id) continue;
          if (item.mid < centerY) overIndex += 1;
        }
        const maxIndex = prev.itemMids.length - 1;
        overIndex = Math.max(0, Math.min(maxIndex, overIndex));

        return { ...prev, offsetY, overIndex };
      });
    });
  };

  const moveExerciseReorderPointer = (exerciseId: string, e: React.PointerEvent) => {
    // If we are already dragging, update.
    if (exerciseReorder) {
      if (exerciseReorder.id !== exerciseId) return;
      e.preventDefault?.();
      e.stopPropagation?.();
      updateExerciseReorder(e.clientY);
      return;
    }

    // Otherwise, cancel pending long-press if the pointer moved too much.
    const pending = reorderPendingRef.current;
    if (!pending || pending.id !== exerciseId || pending.pointerId !== e.pointerId) return;

    const dx = Math.abs(e.clientX - pending.startX);
    const dy = Math.abs(e.clientY - pending.startY);
    if (dx > 12 || dy > 12) cancelPendingReorder();
  };

  const finishExerciseReorder = () => {
    const drag = exerciseReorder;
    setExerciseReorder(null);

    if (reorderRafRef.current) cancelAnimationFrame(reorderRafRef.current);
    reorderRafRef.current = null;
    cancelPendingReorder();

    const active = reorderActiveRef.current;
    reorderActiveRef.current = null;
    if (active) {
      try {
        active.handleEl.releasePointerCapture(active.pointerId);
      } catch {
        // ignore
      }
    }

    try {
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';
    } catch {
      // ignore
    }

    if (!drag) return;
    if (drag.startIndex === drag.overIndex) return;

    captureReorderFromTops();
    const next = [...workout.exercises];
    const [moved] = next.splice(drag.startIndex, 1);
    next.splice(drag.overIndex, 0, moved);
    markDirty();
    dispatchWorkout({ type: 'setExercises', exercises: next });
    scheduleAutosave({ ...workout, exercises: next });
  };

  const endExerciseReorderPointer = (exerciseId: string, e: React.PointerEvent) => {
    if (exerciseReorder) {
      if (exerciseReorder.id !== exerciseId) return;
      e.preventDefault?.();
      e.stopPropagation?.();
      finishExerciseReorder();
      return;
    }

    const pending = reorderPendingRef.current;
    if (pending && pending.id === exerciseId && pending.pointerId === e.pointerId) {
      cancelPendingReorder();
    }
  };

  const moveExercise = (exId: string, direction: 'up' | 'down') => {
    const index = workout.exercises.findIndex(ex => ex.id === exId);
    if (index === -1) return;
    const nextIndex = direction === 'up' ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= workout.exercises.length) return;
    captureReorderFromTops();
    const next = [...workout.exercises];
    const [moved] = next.splice(index, 1);
    next.splice(nextIndex, 0, moved);
    markDirty();
    dispatchWorkout({ type: 'setExercises', exercises: next });
    scheduleAutosave({ ...workout, exercises: next });
  };

  const addDraftUploadItems = (
    files: FileList | null,
    setter: React.Dispatch<React.SetStateAction<DraftMediaItem[]>>
  ) => {
    if (!files || files.length === 0) return;
    const entries: DraftMediaItem[] = [];
    for (const file of Array.from(files)) {
      entries.push({
        id: generateId(),
        kind: 'upload',
        contentType: file.type.startsWith('video/') ? 'video' : 'image',
        url: URL.createObjectURL(file),
        title: '',
        file,
      });
    }
    setter((prev) => [...prev, ...entries]);
  };

  const insertYoutubeIntoMarkdown = (
    rawUrl: string,
    markdown: string,
    setter: React.Dispatch<React.SetStateAction<string>>,
    textareaRef: React.RefObject<HTMLTextAreaElement | null>
  ) => {
    const normalized = normalizeYouTubeUrl(rawUrl);
    if (!normalized) return false;

    const el = textareaRef.current;
    if (!el) {
      setter(mergeMarkdownWithUrls(markdown, [normalized]));
      return true;
    }

    const start = el.selectionStart ?? markdown.length;
    const end = el.selectionEnd ?? markdown.length;
    const before = markdown.slice(0, start);
    const after = markdown.slice(end);
    const prefix = before.length > 0 && !before.endsWith('\n') ? '\n' : '';
    const insert = `${prefix}${normalized}\n`;
    const next = `${before}${insert}${after}`;
    setter(next);

    requestAnimationFrame(() => {
      el.focus();
      const pos = before.length + insert.length;
      el.setSelectionRange(pos, pos);
    });

    return true;
  };

  const materializeMediaItems = async (drafts: DraftMediaItem[]): Promise<ExerciseMediaItem[]> => {
    if (!user?.id) throw new Error('User not ready');
    const finalized: ExerciseMediaItem[] = [];

    for (const item of drafts) {
      if (item.file) {
        const uploaded = await uploadExerciseFile(user.id, item.file);
        finalized.push({
          id: item.id,
          kind: 'upload',
          contentType: uploaded.type,
          url: uploaded.url,
          title: item.title.trim() || undefined,
        });
        continue;
      }

      if (!item.url.trim()) continue;
      finalized.push({
        id: item.id,
        kind: 'upload',
        contentType: item.contentType,
        url: item.url.trim(),
        title: item.title.trim() || undefined,
      });
    }

    return finalized;
  };

  const openEditExercise = (def: ExerciseDef) => {
    if (def.readOnly || def.source === 'official') {
      pushToast({ kind: 'info', message: t('workoutEditor.officialReadOnly') });
      return;
    }
    setEditingExerciseId(def.id);
    setEditExName(def.name);
    setEditExDesc(def.description || '');
    setEditExCategory(normalizeCategory(def.category));
    setEditExUsesBarbell(!!def.usesBarbell);
    setEditExBarbellWeight(def.barbellWeight ?? getDefaultBarbellWeight(unit));
    setEditExThumbnailUrl(def.thumbnailUrl ?? '');
    setEditExThumbnailFile(null);
    const legacyYoutubeUrls = (def.mediaItems ?? [])
      .filter((item) => item.kind === 'youtube')
      .map((item) => item.url);
    setEditExMarkdown(mergeMarkdownWithUrls(def.markdown ?? '', legacyYoutubeUrls));
    setEditExYoutubeInput('');

    const normalizedMedia: DraftMediaItem[] = (def.mediaItems ?? [])
      .filter((item) => item.kind === 'upload')
      .map((item) => ({
        id: item.id,
        kind: 'upload',
        contentType: item.contentType,
        url: item.url,
        title: item.title ?? '',
      }));

    if (normalizedMedia.length === 0 && def.mediaUrl && (def.mediaType === 'image' || def.mediaType === 'video')) {
      normalizedMedia.push({
        id: generateId(),
        kind: 'upload',
        contentType: def.mediaType,
        url: def.mediaUrl,
        title: '',
      });
    }

    setEditExMediaItems(normalizedMedia);
    setShowExModal(false);
    setShowCreateExModal(false);
    setShowEditExModal(true);
  };

  const handleUpdateExercise = async () => {
    if (!editingExerciseId) return;
    const original = exerciseDefs.find(d => d.id === editingExerciseId);
    if (!original) return;
    if (original.readOnly || original.source === 'official') {
      pushToast({ kind: 'error', message: t('workoutEditor.officialReadOnly') });
      return;
    }
    const trimmedName = editExName.trim() || original.name;
    setIsProcessing(true);
    try {
      const mediaItems = await materializeMediaItems(editExMediaItems);
      let nextThumbnailUrl = editExThumbnailUrl.trim();
      if (editExThumbnailFile && user?.id) {
        const uploaded = await uploadExerciseFile(user.id, editExThumbnailFile);
        nextThumbnailUrl = uploaded.url;
      }

      const firstUpload = mediaItems.find((item) => item.kind === 'upload');
      const updated: ExerciseDef = {
        ...original,
        name: trimmedName,
        description: editExDesc,
        category: editExCategory || 'Other',
        usesBarbell: editExUsesBarbell,
        barbellWeight: editExUsesBarbell ? editExBarbellWeight : 0,
        thumbnailUrl: nextThumbnailUrl || undefined,
        markdown: editExMarkdown,
        mediaItems,
        mediaUrl: firstUpload?.url,
        mediaType: firstUpload?.contentType,
      };
      await updateExerciseDef(updated);
      setShowEditExModal(false);
      setEditingExerciseId(null);
    } catch (error) {
      pushToast({
        kind: 'error',
        message: error instanceof Error ? error.message : t('workoutEditor.unknownError'),
      });
    } finally {
      setIsProcessing(false);
    }
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
      exercises: workout.exercises.map(ex => ex.id === exId ? { ...ex, sets: ex.sets.map(s => s.id === setId ? { ...s, [field]: value } : s) } : ex)
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
        return { ...ex, sets: [...ex.sets, { id: generateId(), weight: last?.weight || 0, reps: last?.reps || 0, completed: false }] };
      })
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
        // Keep at least one empty set so the exercise doesn't become unusable.
        return { ...ex, sets: next.length > 0 ? next : [{ id: generateId(), weight: 0, reps: 0, completed: false }] };
      })
    };
    markDirty();
    dispatchWorkout({ type: 'replace', workout: updated });
    scheduleAutosave(updated);
  };

  const handleCreateExercise = async () => {
      const trimmedName = newExName.trim();
      if (!trimmedName) return;
      setIsProcessing(true);
      try {
        let thumbnailUrl = newExThumbnailUrl.trim();
        if (newExThumbnailFile && user?.id) {
          const uploaded = await uploadExerciseFile(user.id, newExThumbnailFile);
          thumbnailUrl = uploaded.url;
        }

        const mediaItems = await materializeMediaItems(newExMediaItems);
        const firstUpload = mediaItems.find((item) => item.kind === 'upload');

        const def: ExerciseDef = {
          id: generateId(),
          name: trimmedName,
          description: newExDesc,
          source: 'personal',
          readOnly: false,
          category: newExCategory || 'Other',
          usesBarbell: newExUsesBarbell,
          barbellWeight: newExUsesBarbell ? newExBarbellWeight : 0,
          thumbnailUrl: thumbnailUrl || undefined,
          markdown: newExMarkdown,
          mediaItems,
          mediaUrl: firstUpload?.url,
          mediaType: firstUpload?.contentType,
        };

        await addExerciseDef(def); // Upserts to Supabase
        setShowCreateExModal(false);
        addExercise(def.id);
        setNewExName(''); 
        setNewExDesc(''); 
        setNewExCategory('Other');
        setNewExUsesBarbell(false);
        setNewExBarbellWeight(getDefaultBarbellWeight(unit));
        setNewExThumbnailUrl('');
        setNewExThumbnailFile(null);
        setNewExMarkdown('');
        setNewExMediaItems([]);
        setNewExYoutubeInput('');
      } catch (e: any) {
        console.error('Failed to create exercise:', e);
        pushToast({
          kind: 'error',
          message: `${t('workoutEditor.errorPrefix')}: ${e?.message || t('workoutEditor.unknownError')}`,
        });
      } finally {
        setIsProcessing(false);
      }
  };

  // Total volume: only count sets that the user checked (completed).
  const totalVolume = workout.exercises.reduce((acc, ex) => {
    const def = exerciseDefs.find(d => d.id === ex.defId);
    const usesBarbell = !!def?.usesBarbell;
    const barbellWeight = usesBarbell ? (def?.barbellWeight ?? getDefaultBarbellWeight(unit)) : 0;
    const exerciseTotal = ex.sets.reduce((sAcc, s) => {
      if (!s.completed) return sAcc;
      const perRep = usesBarbell ? (s.weight * 2 + barbellWeight) : s.weight;
      return sAcc + (perRep * s.reps);
    }, 0);
    return acc + exerciseTotal;
  }, 0);
  const totalSets = workout.exercises.reduce((acc, ex) => acc + ex.sets.length, 0);
  const completedSets = workout.exercises.reduce((acc, ex) => acc + ex.sets.filter(s => s.completed).length, 0);
  const percentage = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0;
  const historicalPRs = useMemo(
    () => calculatePRs(workouts.filter((w) => w.id !== workout.id)),
    [workouts, workout.id]
  );
  const brokenPRs = useMemo(
    () => calculateBrokenPRs(workout, historicalPRs, exerciseDefs),
    [workout, historicalPRs, exerciseDefs]
  );

  const durationMinutes = Math.max(0, Math.round(currentTime / 60));

  const [animMinutes, setAnimMinutes] = useState(0);
  const [animCompletion, setAnimCompletion] = useState(0);
  const [animVolume, setAnimVolume] = useState(0);
  const reportShownOnceRef = useRef(false);

  const animateNumber = (to: number, setter: (v: number) => void, durationMs: number) => {
    const from = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      const value = Math.round(from + (to - from) * eased);
      setter(value);
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  useEffect(() => {
    if (!showReport) {
      reportShownOnceRef.current = false;
      return;
    }
    if (reportShownOnceRef.current) return;
    reportShownOnceRef.current = true;

    setAnimMinutes(0);
    setAnimCompletion(0);
    setAnimVolume(0);

    animateNumber(durationMinutes, setAnimMinutes, 700);
    animateNumber(percentage, setAnimCompletion, 900);
    animateNumber(Math.round(totalVolume), setAnimVolume, 1100);
  }, [showReport, durationMinutes, percentage, totalVolume]);

  const handleShareReport = async () => {
    try {
      await shareWorkoutReportCanvas({
        workout,
        exerciseDefs,
        durationMinutes,
        percentage,
        totalVolume,
        currentUnit,
        text: {
          workoutFallbackTitle: t('workoutReport.workoutFallbackTitle'),
          durationLabel: t('workoutReport.durationLabel'),
          completionLabel: t('workoutReport.completionLabel'),
          totalVolumeLabel: t('workoutReport.totalVolumeLabel'),
          exercisesLabel: t('workoutReport.exercisesLabel'),
          exerciseFallbackName: t('workoutReport.exerciseFallbackName'),
          minutesShort: t('workoutReport.minutesShort'),
          shareTitlePrefix: t('workoutReport.shareTitlePrefix'),
        },
      });
    } catch (e: any) {
      console.error(e);
      pushToast({ kind: 'error', message: e?.message || t('workoutEditor.shareFailed') });
    }
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

  const removeExerciseFromWorkout = (exerciseId: string) => {
    const exercises = workout.exercises.filter((exercise) => exercise.id !== exerciseId);
    markDirty();
    dispatchWorkout({ type: 'setExercises', exercises });
    scheduleAutosave({ ...workout, exercises });
  };

  const topActionButtonBaseClass =
    'w-10 h-10 rounded-full flex items-center justify-center border shadow-[var(--surface-shadow)] active:scale-95 transition-all duration-300';

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-950 view-enter transition-colors">
      <div className="bg-white/80 dark:bg-gray-950/85 backdrop-blur-md px-4 py-3 flex items-center justify-between sticky top-0 z-20 border-b border-gray-100 dark:border-gray-800 shadow-sm transition-colors">
        <button
          onClick={handleSaveBack}
          aria-label={t('workoutEditor.back')}
          title={t('workoutEditor.back')}
          className="w-10 h-10 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 active:scale-95 transition-transform"
        >
          <ArrowLeft size={20}/>
        </button>
        <div className="flex flex-col items-center" onClick={toggleTimer}>
           <span className={`text-xl font-black font-mono tracking-widest ${workout.startTimestamp ? 'text-green-500' : 'text-gray-400 dark:text-gray-500'}`}>{formatDuration(currentTime)}</span>
           <span className="text-[10px] uppercase font-bold text-gray-300">
             {workout.startTimestamp ? t('workoutEditor.running') : t('workoutEditor.paused')}
           </span>
        </div>
        <div className="flex gap-2">
            <button
              onClick={startRestTimer}
              className={`${topActionButtonBaseClass} border-[var(--surface-border)] bg-[var(--surface-card)] text-[var(--botanical-text-soft)]`}
              aria-label={`${t('workoutEditor.restTimer')} (${restTimerSeconds}s)`}
              title={`${t('workoutEditor.restTimer')} (${restTimerSeconds}s)`}
            >
              <Clock3 size={18} />
            </button>
            {!workout.completed && (
              <button
                onClick={toggleTimer}
                aria-label={workout.startTimestamp ? t('workoutEditor.pauseTimer') : t('workoutEditor.startTimer')}
                title={workout.startTimestamp ? t('workoutEditor.pauseTimer') : t('workoutEditor.startTimer')}
                className={`${topActionButtonBaseClass} ${
                  workout.startTimestamp
                    ? 'border-brand bg-brand-tint-strong text-[var(--botanical-text)]'
                    : 'border-[var(--surface-border)] bg-[var(--surface-card)] text-[var(--botanical-text-soft)]'
                }`}
              >
                {workout.startTimestamp ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5"/>}
              </button>
            )}
            <button
              onClick={handleFinish}
              data-testid="finish-workout-button"
              aria-label={t('workoutEditor.finishWorkout')}
              title={t('workoutEditor.finishWorkout')}
              className={`${topActionButtonBaseClass} ${
                workout.completed
                  ? 'border-[var(--surface-border)] bg-[var(--surface-muted)] text-[var(--botanical-text-soft)]'
                  : 'border-brand bg-brand-tint-strong text-[var(--botanical-text)]'
              }`}
            >
              <Check size={20} strokeWidth={3} />
            </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scroll-area p-6 pb-[calc(8rem+env(safe-area-inset-bottom))]">
        <input
          data-testid="workout-title-input"
          value={workout.title}
          onChange={e => handleTitleChange(e.target.value)}
          className="text-3xl font-semibold bg-transparent w-full mb-2 outline-none text-gray-900 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600 display-serif"
          placeholder={t('workoutEditor.workoutTitlePlaceholder')}
        />
        <input
          value={workout.note}
          onChange={e => handleNoteChange(e.target.value)}
          className="text-base text-gray-500 dark:text-gray-400 bg-transparent w-full mb-8 outline-none placeholder-gray-300 dark:placeholder-gray-600"
          placeholder={t('workoutEditor.workoutNotePlaceholder')}
        />
        <div className="space-y-6">
          {workout.exercises.map((ex, index) => {
            const def = exerciseDefs.find(d => d.id === ex.defId);
            if (!def) return null;

            const isDragging = exerciseReorder?.id === ex.id;
            let style: React.CSSProperties | undefined;
            if (exerciseReorder) {
              const delta = exerciseReorder.itemHeight + exerciseReorder.gap;
              if (isDragging) {
                style = {
                  transform: `translate3d(0, ${exerciseReorder.offsetY}px, 0) scale(1.02)`,
                  zIndex: 50,
                  position: 'relative'
                };
              } else {
                let translateY = 0;
                if (exerciseReorder.overIndex > exerciseReorder.startIndex) {
                  if (index > exerciseReorder.startIndex && index <= exerciseReorder.overIndex) translateY = -delta;
                } else if (exerciseReorder.overIndex < exerciseReorder.startIndex) {
                  if (index >= exerciseReorder.overIndex && index < exerciseReorder.startIndex) translateY = delta;
                }
                if (translateY !== 0) style = { transform: `translate3d(0, ${translateY}px, 0)` };
              }
            }

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
                isDragging={isDragging}
                style={style}
                outerRef={setCardRef(ex.id)}
                onOpenEdit={() => openEditExercise(def)}
                onOpenDetail={() => {
                  setDetailExerciseDef(def);
                  setDetailExerciseInstance(ex);
                }}
                onRemove={() => removeExerciseFromWorkout(ex.id)}
                onMoveUp={() => moveExercise(ex.id, 'up')}
                onMoveDown={() => moveExercise(ex.id, 'down')}
                onHandlePointerDown={(e) => startExerciseReorder(ex.id, e)}
                onHandlePointerMove={(e) => moveExerciseReorderPointer(ex.id, e)}
                onHandlePointerUp={(e) => endExerciseReorderPointer(ex.id, e)}
                onHandlePointerCancel={(e) => endExerciseReorderPointer(ex.id, e)}
                onUpdateSet={(setId, field, value) => updateSet(ex.id, setId, field, value)}
                onDeleteSet={(setId) => deleteSet(ex.id, setId)}
                onAddSet={() => addSet(ex.id)}
              />
            );
          })}
          <Button
            data-testid="add-exercise-button"
            onClick={() => setShowExModal(true)}
            variant="secondary"
            className="w-full py-4 bg-gray-200 text-gray-600"
          >
            {t('workoutEditor.addExercise')}
          </Button>
          {workout.completed && (
            <Button onClick={handleResume} variant="primary" className="w-full py-4 mt-4">
              {t('workoutEditor.resumeWorkout')}
            </Button>
          )}
        </div>
      </div>

      <BottomSheet
        isOpen={showExModal}
        onClose={() => setShowExModal(false)}
        title={t('workoutEditor.exercisesTitle')}
      >
        <p className="text-xs text-gray-400 mb-3">{t('workoutEditor.exercisesHint')}</p>

        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2 mb-4 -mx-1 px-1">
          {BODY_PART_OPTIONS.map((cat) => {
            const count = (exDefsByCategory[cat] || []).length;
            const active = cat === exPickerCategory;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setExPickerCategory(cat)}
                className={`shrink-0 px-3 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center gap-2 ${
                  active
                    ? 'bg-brand text-gray-900'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                <span>{cat}</span>
                {count > 0 && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${
                      active ? 'bg-black/15' : 'bg-black/10'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="space-y-2">
          {filteredExerciseDefs.length === 0 ? (
            <div className="text-center py-10 text-gray-300 dark:text-gray-500 border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-3xl">
              {exerciseDefs.length === 0 ? (
                <>
                  <p className="font-semibold text-gray-500 dark:text-gray-300">
                    {t('workoutEditor.catalogEmptyTitle')}
                  </p>
                  <p className="text-xs mt-2 text-gray-400 dark:text-gray-500">
                    {navigator.onLine ? t('workoutEditor.catalogEmptyOnline') : t('workoutEditor.catalogEmptyOffline')}
                  </p>
                </>
              ) : (
                <>
                  {t('workoutEditor.noExercisesIn')} {exPickerCategory}.
                </>
              )}
            </div>
          ) : (
            filteredExerciseDefs.map((def) => {
              const isUsed = workouts.some((w) => w.exercises.some((ex) => ex.defId === def.id));
              const isReadOnly = def.source === 'official' || def.readOnly;
              return (
                <ExercisePickerRow
                  key={def.id}
                  def={def}
                  isUsed={isUsed}
                  onAdd={() => addExercise(def.id)}
                  onEdit={() => openEditExercise(def)}
                  onDelete={async () => {
                    if (isReadOnly) {
                      pushToast({ kind: 'info', message: t('workoutEditor.officialReadOnly') });
                      return;
                    }
                    if (isUsed) {
                      pushToast({
                        kind: 'info',
                        message: t('workoutEditor.exerciseInUse'),
                      });
                      return;
                    }
                    const accepted = await confirm({
                      title: t('workoutEditor.deleteExercise'),
                      message: `${t('workoutEditor.deleteExercisePromptPrefix')} "${def.name}"?`,
                      confirmText: t('workoutEditor.delete'),
                      cancelText: t('workoutEditor.cancel'),
                      danger: true,
                    });
                    if (accepted) {
                      await deleteExerciseDef(def.id);
                    }
                  }}
                />
              );
            })
          )}
          <Button className="w-full mt-4" onClick={() => setShowCreateExModal(true)}>
            {t('workoutEditor.createNew')}
          </Button>
        </div>
      </BottomSheet>

      <BottomSheet
        isOpen={showCreateExModal}
        onClose={() => setShowCreateExModal(false)}
        title={t('workoutEditor.newExerciseTitle')}
        topGapPx={20}
      >
         <Input placeholder={t('workoutEditor.name')} value={newExName} onChange={e => setNewExName(e.target.value)} />
         <Input placeholder={t('workoutEditor.description')} value={newExDesc} onChange={e => setNewExDesc(e.target.value)} />
         <CategoryPicker value={newExCategory} onChange={setNewExCategory} />
         <div className="mb-4">
           <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{t('workoutEditor.barbell')}</div>
           <button
             type="button"
             onClick={() => {
               setNewExUsesBarbell(prev => {
                 const next = !prev;
                 if (next && (!newExBarbellWeight || newExBarbellWeight <= 0)) {
                   setNewExBarbellWeight(getDefaultBarbellWeight(unit));
                 }
                 return next;
               });
             }}
             className="w-full flex items-center gap-3 bg-gray-50 dark:bg-gray-800 rounded-2xl px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
           >
             <span className={`w-5 h-5 rounded-md flex items-center justify-center border ${newExUsesBarbell ? 'bg-brand border-brand text-gray-900' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-transparent'}`}>
               <Check size={14} />
             </span>
             <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('workoutEditor.usesBarbell')}</span>
           </button>
           {newExUsesBarbell && (
             <div className="mt-3 bg-gray-50 dark:bg-gray-800 rounded-2xl px-4 py-3 flex items-center gap-2">
               <SetNumberInput
                 value={newExBarbellWeight}
                 inputMode="decimal"
                 onValueChange={(v) => setNewExBarbellWeight(v)}
                 className="flex-1 min-w-0 bg-transparent outline-none font-bold text-gray-900 dark:text-gray-100 text-center tabular-nums"
               />
               <span className="text-xs text-gray-400 dark:text-gray-500 font-medium shrink-0">{currentUnit}</span>
             </div>
           )}
         </div>
         <div className="mb-4 space-y-2">
           <Input
             placeholder={t('workoutEditor.thumbnailUrl')}
             value={newExThumbnailUrl}
             onChange={(event) => setNewExThumbnailUrl(event.target.value)}
           />
           <label className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl p-4 flex items-center justify-center gap-2 text-gray-400 dark:text-gray-500 cursor-pointer bg-gray-50 dark:bg-gray-800">
             <Camera size={18} />
             <span className="text-xs">{newExThumbnailFile ? newExThumbnailFile.name : t('workoutEditor.addThumbnail')}</span>
           <input
              type="file"
              className="hidden"
              accept="image/*,video/*"
              onChange={(event) => setNewExThumbnailFile(event.target.files?.[0] || null)}
            />
           </label>
         </div>

         <div className="mb-4 border border-gray-200 dark:border-gray-700 rounded-2xl p-3 space-y-2">
           <div className="flex items-center justify-between">
             <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{t('workoutEditor.mediaItems')}</span>
             <label className="text-xs text-brand font-semibold cursor-pointer inline-flex items-center gap-1">
               <Plus size={12} />
               {t('workoutEditor.addUpload')}
               <input
                 type="file"
                 className="hidden"
                 accept="image/*,video/*"
                 multiple
                 onChange={(event) => {
                   addDraftUploadItems(event.target.files, setNewExMediaItems);
                   event.currentTarget.value = '';
                 }}
               />
             </label>
           </div>

           <div className="space-y-2 max-h-36 overflow-y-auto scroll-area">
             {newExMediaItems.length === 0 ? (
               <p className="text-xs text-gray-400 dark:text-gray-500">{t('workoutEditor.noMediaItems')}</p>
             ) : (
               newExMediaItems.map((item) => (
                 <div key={item.id} className="rounded-xl bg-gray-50 dark:bg-gray-800 px-3 py-2 text-xs">
                   <div className="flex items-center justify-between gap-2">
                     <span className="truncate text-gray-700 dark:text-gray-200">
                       {item.file?.name || item.url}
                     </span>
                     <button
                       type="button"
                       onClick={() => setNewExMediaItems((prev) => prev.filter((entry) => entry.id !== item.id))}
                       className="text-red-500"
                       aria-label={t('workoutEditor.removeMedia')}
                     >
                       <Trash2 size={14} />
                     </button>
                   </div>
                   <Input
                     placeholder={t('workoutEditor.mediaTitle')}
                     value={item.title}
                     onChange={(event) =>
                       setNewExMediaItems((prev) =>
                         prev.map((entry) =>
                           entry.id === item.id
                             ? {
                                 ...entry,
                                 title: event.target.value,
                               }
                             : entry
                         )
                       )
                     }
                   />
                 </div>
               ))
             )}
           </div>
         </div>

         <div className="mb-4">
           <textarea
             ref={newExMarkdownRef}
             value={newExMarkdown}
             onChange={(event) => setNewExMarkdown(event.target.value)}
             rows={5}
             placeholder={t('workoutEditor.markdownPlaceholder')}
             className="w-full rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-sm text-gray-900 dark:text-gray-100 outline-none"
           />
           <div className="mt-2">
             <div className="flex gap-2 items-start">
               <Input
                 placeholder={t('workoutEditor.youtubeUrl')}
                 value={newExYoutubeInput}
                 onChange={(event) => setNewExYoutubeInput(event.target.value)}
                 className="mb-0"
               />
               <button
                 type="button"
                 onClick={() => {
                   const added = insertYoutubeIntoMarkdown(newExYoutubeInput, newExMarkdown, setNewExMarkdown, newExMarkdownRef);
                 if (!added) {
                     pushToast({ kind: 'error', message: t('workoutEditor.invalidYoutube') });
                     return;
                   }
                   setNewExYoutubeInput('');
                 }}
                 className="w-10 h-10 mt-1 rounded-xl bg-brand text-gray-900 flex items-center justify-center hover:brightness-95"
                 aria-label={t('workoutEditor.addYoutube')}
                 title={t('workoutEditor.addYoutube')}
               >
                 <Youtube size={16} />
               </button>
             </div>
             <p className="text-[11px] text-gray-400 dark:text-gray-500 -mt-2">
               {t('workoutEditor.youtubeEmbedHint')}
             </p>
           </div>
         </div>
         <Button onClick={handleCreateExercise} disabled={isProcessing} className="w-full">
           {isProcessing ? t('workoutEditor.processing') : t('workoutEditor.save')}
         </Button>
      </BottomSheet>

      <BottomSheet
        isOpen={showEditExModal}
        onClose={() => {
          setShowEditExModal(false);
          setEditingExerciseId(null);
          setEditExThumbnailFile(null);
          setEditExYoutubeInput('');
        }}
        title={t('workoutEditor.editExerciseTitle')}
        topGapPx={20}
      >
         <Input placeholder={t('workoutEditor.name')} value={editExName} onChange={e => setEditExName(e.target.value)} />
         <Input placeholder={t('workoutEditor.description')} value={editExDesc} onChange={e => setEditExDesc(e.target.value)} />
         <CategoryPicker value={editExCategory} onChange={setEditExCategory} />
         <div className="mb-4">
           <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{t('workoutEditor.barbell')}</div>
           <button
             type="button"
             onClick={() => {
               setEditExUsesBarbell(prev => {
                 const next = !prev;
                 if (next && (!editExBarbellWeight || editExBarbellWeight <= 0)) {
                   setEditExBarbellWeight(getDefaultBarbellWeight(unit));
                 }
                 return next;
               });
             }}
             className="w-full flex items-center gap-3 bg-gray-50 dark:bg-gray-800 rounded-2xl px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
           >
             <span className={`w-5 h-5 rounded-md flex items-center justify-center border ${editExUsesBarbell ? 'bg-brand border-brand text-gray-900' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-transparent'}`}>
               <Check size={14} />
             </span>
             <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('workoutEditor.usesBarbell')}</span>
           </button>
           {editExUsesBarbell && (
             <div className="mt-3 bg-gray-50 dark:bg-gray-800 rounded-2xl px-4 py-3 flex items-center gap-2">
               <SetNumberInput
                 value={editExBarbellWeight}
                 inputMode="decimal"
                 onValueChange={(v) => setEditExBarbellWeight(v)}
                 className="flex-1 min-w-0 bg-transparent outline-none font-bold text-gray-900 dark:text-gray-100 text-center tabular-nums"
               />
               <span className="text-xs text-gray-400 dark:text-gray-500 font-medium shrink-0">{currentUnit}</span>
             </div>
           )}
         </div>
         <div className="mb-4 space-y-2">
           <Input
             placeholder={t('workoutEditor.thumbnailUrl')}
             value={editExThumbnailUrl}
             onChange={(event) => setEditExThumbnailUrl(event.target.value)}
           />
           <label className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl p-4 flex items-center justify-center gap-2 text-gray-400 dark:text-gray-500 cursor-pointer bg-gray-50 dark:bg-gray-800">
             <Camera size={18} />
             <span className="text-xs">{editExThumbnailFile ? editExThumbnailFile.name : t('workoutEditor.replaceThumbnail')}</span>
           <input
              type="file"
              className="hidden"
              accept="image/*,video/*"
              onChange={(event) => setEditExThumbnailFile(event.target.files?.[0] || null)}
            />
           </label>
         </div>

         <div className="mb-4 border border-gray-200 dark:border-gray-700 rounded-2xl p-3 space-y-2">
           <div className="flex items-center justify-between">
             <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{t('workoutEditor.mediaItems')}</span>
             <label className="text-xs text-brand font-semibold cursor-pointer inline-flex items-center gap-1">
               <Plus size={12} />
               {t('workoutEditor.addUpload')}
               <input
                 type="file"
                 className="hidden"
                 accept="image/*,video/*"
                 multiple
                 onChange={(event) => {
                   addDraftUploadItems(event.target.files, setEditExMediaItems);
                   event.currentTarget.value = '';
                 }}
               />
             </label>
           </div>

           <div className="space-y-2 max-h-36 overflow-y-auto scroll-area">
             {editExMediaItems.length === 0 ? (
               <p className="text-xs text-gray-400 dark:text-gray-500">{t('workoutEditor.noMediaItems')}</p>
             ) : (
               editExMediaItems.map((item) => (
                 <div key={item.id} className="rounded-xl bg-gray-50 dark:bg-gray-800 px-3 py-2 text-xs">
                   <div className="flex items-center justify-between gap-2">
                     <span className="truncate text-gray-700 dark:text-gray-200">
                       {item.file?.name || item.url}
                     </span>
                     <button
                       type="button"
                       onClick={() => setEditExMediaItems((prev) => prev.filter((entry) => entry.id !== item.id))}
                       className="text-red-500"
                       aria-label={t('workoutEditor.removeMedia')}
                     >
                       <Trash2 size={14} />
                     </button>
                   </div>
                   <Input
                     placeholder={t('workoutEditor.mediaTitle')}
                     value={item.title}
                     onChange={(event) =>
                       setEditExMediaItems((prev) =>
                         prev.map((entry) =>
                           entry.id === item.id
                             ? {
                                 ...entry,
                                 title: event.target.value,
                               }
                             : entry
                         )
                       )
                     }
                   />
                 </div>
               ))
             )}
           </div>
         </div>

         <div className="mb-4">
           <textarea
             ref={editExMarkdownRef}
             value={editExMarkdown}
             onChange={(event) => setEditExMarkdown(event.target.value)}
             rows={5}
             placeholder={t('workoutEditor.markdownPlaceholder')}
             className="w-full rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-sm text-gray-900 dark:text-gray-100 outline-none"
           />
           <div className="mt-2">
             <div className="flex gap-2 items-start">
               <Input
                 placeholder={t('workoutEditor.youtubeUrl')}
                 value={editExYoutubeInput}
                 onChange={(event) => setEditExYoutubeInput(event.target.value)}
                 className="mb-0"
               />
               <button
                 type="button"
                 onClick={() => {
                   const added = insertYoutubeIntoMarkdown(editExYoutubeInput, editExMarkdown, setEditExMarkdown, editExMarkdownRef);
                   if (!added) {
                     pushToast({ kind: 'error', message: t('workoutEditor.invalidYoutube') });
                     return;
                   }
                   setEditExYoutubeInput('');
                 }}
                 className="w-10 h-10 mt-1 rounded-xl bg-brand text-gray-900 flex items-center justify-center hover:brightness-95"
                 aria-label={t('workoutEditor.addYoutube')}
                 title={t('workoutEditor.addYoutube')}
               >
                 <Youtube size={16} />
               </button>
             </div>
             <p className="text-[11px] text-gray-400 dark:text-gray-500 -mt-2">
               {t('workoutEditor.youtubeEmbedHint')}
             </p>
           </div>
         </div>
         <Button onClick={handleUpdateExercise} className="w-full">{t('workoutEditor.saveChanges')}</Button>
      </BottomSheet>

      <SessionReport
        isOpen={showReport}
        currentUnit={currentUnit}
        animMinutes={animMinutes}
        animCompletion={animCompletion}
        animVolume={animVolume}
        prBreaks={brokenPRs}
        onShare={handleShareReport}
        onClose={handleExitReport}
      />
      <ExerciseDetailModal
        isOpen={detailExerciseDef !== null}
        exercise={detailExerciseDef}
        currentExercise={detailExerciseInstance}
        currentWorkoutId={workout.id}
        workouts={workouts}
        onClose={() => {
          setDetailExerciseDef(null);
          setDetailExerciseInstance(null);
        }}
      />
      <RestTimer
        isOpen={showRestTimer}
        durationSeconds={restTimerSeconds}
        restartToken={restTimerRestartToken}
        onClose={() => setShowRestTimer(false)}
        onDurationChange={setRestTimerSeconds}
      />
      {confirmDialog}
    </div>
  );
};




export default WorkoutEditor;
