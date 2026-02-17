import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { ExerciseInstance } from '@/types';

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

type UseExerciseReorderOptions = {
  exercises: ExerciseInstance[];
  onReorder: (nextExercises: ExerciseInstance[]) => void;
};

type UseExerciseReorderResult = {
  exerciseReorder: ExerciseReorderState | null;
  setCardRef: (exerciseId: string) => (el: HTMLDivElement | null) => void;
  startExerciseReorder: (exerciseId: string, e: ReactPointerEvent) => void;
  moveExerciseReorderPointer: (exerciseId: string, e: ReactPointerEvent) => void;
  endExerciseReorderPointer: (exerciseId: string, e: ReactPointerEvent) => void;
  moveExercise: (exerciseId: string, direction: 'up' | 'down') => void;
  getCardStyle: (exerciseId: string, index: number) => CSSProperties | undefined;
  isDragging: (exerciseId: string) => boolean;
};

export const useExerciseReorder = ({
  exercises,
  onReorder,
}: UseExerciseReorderOptions): UseExerciseReorderResult => {
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

  const setCardRef = useCallback((exerciseId: string) => (el: HTMLDivElement | null) => {
    cardRefs.current[exerciseId] = el;
  }, []);

  const captureReorderFromTops = useCallback(() => {
    const tops: Record<string, number> = {};
    for (const ex of exercises) {
      const el = cardRefs.current[ex.id];
      if (el) tops[ex.id] = el.getBoundingClientRect().top;
    }
    reorderAnimFromRef.current = tops;
  }, [exercises]);

  useLayoutEffect(() => {
    const from = reorderAnimFromRef.current;
    if (!from) return;
    reorderAnimFromRef.current = null;

    const ids = exercises.map(ex => ex.id);
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
  }, [exercises]);

  const cancelPendingReorder = useCallback(() => {
    if (reorderTimerRef.current) window.clearTimeout(reorderTimerRef.current);
    reorderTimerRef.current = null;
    reorderPendingRef.current = null;
  }, []);

  const updateExerciseReorder = useCallback((clientY: number) => {
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
  }, []);

  const startExerciseReorder = useCallback((exerciseId: string, e: ReactPointerEvent) => {
    if (exerciseReorder) return;
    cancelPendingReorder();

    const handleEl = e.currentTarget as HTMLElement;
    reorderPendingRef.current = {
      id: exerciseId,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      handleEl,
    };

    reorderTimerRef.current = window.setTimeout(() => {
      const pending = reorderPendingRef.current;
      if (!pending || pending.id !== exerciseId) return;

      const rects: Array<{ id: string; top: number; height: number; mid: number }> = [];
      for (const ex of exercises) {
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
        itemMids: rects.map(r => ({ id: r.id, mid: r.mid })),
      });
    }, 500);
  }, [cancelPendingReorder, exerciseReorder, exercises]);

  const finishExerciseReorder = useCallback(() => {
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
    const next = [...exercises];
    const [moved] = next.splice(drag.startIndex, 1);
    next.splice(drag.overIndex, 0, moved);
    onReorder(next);
  }, [cancelPendingReorder, captureReorderFromTops, exerciseReorder, exercises, onReorder]);

  const moveExerciseReorderPointer = useCallback((exerciseId: string, e: ReactPointerEvent) => {
    if (exerciseReorder) {
      if (exerciseReorder.id !== exerciseId) return;
      e.preventDefault?.();
      e.stopPropagation?.();
      updateExerciseReorder(e.clientY);
      return;
    }

    const pending = reorderPendingRef.current;
    if (!pending || pending.id !== exerciseId || pending.pointerId !== e.pointerId) return;

    const dx = Math.abs(e.clientX - pending.startX);
    const dy = Math.abs(e.clientY - pending.startY);
    if (dx > 12 || dy > 12) cancelPendingReorder();
  }, [cancelPendingReorder, exerciseReorder, updateExerciseReorder]);

  const endExerciseReorderPointer = useCallback((exerciseId: string, e: ReactPointerEvent) => {
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
  }, [cancelPendingReorder, exerciseReorder, finishExerciseReorder]);

  const moveExercise = useCallback((exerciseId: string, direction: 'up' | 'down') => {
    const index = exercises.findIndex(ex => ex.id === exerciseId);
    if (index === -1) return;
    const nextIndex = direction === 'up' ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= exercises.length) return;

    captureReorderFromTops();
    const next = [...exercises];
    const [moved] = next.splice(index, 1);
    next.splice(nextIndex, 0, moved);
    onReorder(next);
  }, [captureReorderFromTops, exercises, onReorder]);

  const getCardStyle = useCallback((exerciseId: string, index: number): CSSProperties | undefined => {
    if (!exerciseReorder) return undefined;

    const isDragging = exerciseReorder.id === exerciseId;
    const delta = exerciseReorder.itemHeight + exerciseReorder.gap;
    if (isDragging) {
      return {
        transform: `translate3d(0, ${exerciseReorder.offsetY}px, 0) scale(1.02)`,
        zIndex: 50,
        position: 'relative',
      };
    }

    let translateY = 0;
    if (exerciseReorder.overIndex > exerciseReorder.startIndex) {
      if (index > exerciseReorder.startIndex && index <= exerciseReorder.overIndex) translateY = -delta;
    } else if (exerciseReorder.overIndex < exerciseReorder.startIndex) {
      if (index >= exerciseReorder.overIndex && index < exerciseReorder.startIndex) translateY = delta;
    }
    if (translateY !== 0) {
      return { transform: `translate3d(0, ${translateY}px, 0)` };
    }
    return undefined;
  }, [exerciseReorder]);

  const isDragging = useCallback(
    (exerciseId: string) => exerciseReorder?.id === exerciseId,
    [exerciseReorder]
  );

  useEffect(() => () => {
    if (reorderTimerRef.current) {
      window.clearTimeout(reorderTimerRef.current);
      reorderTimerRef.current = null;
    }
    if (reorderRafRef.current) {
      cancelAnimationFrame(reorderRafRef.current);
      reorderRafRef.current = null;
    }
    const active = reorderActiveRef.current;
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
  }, []);

  return {
    exerciseReorder,
    setCardRef,
    startExerciseReorder,
    moveExerciseReorderPointer,
    endExerciseReorderPointer,
    moveExercise,
    getCardStyle,
    isDragging,
  };
};
