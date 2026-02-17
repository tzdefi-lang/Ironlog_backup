import { useCallback, useRef } from 'react';
import type { PointerEvent } from 'react';

type UseEdgeSwipeBackOptions = {
  enabled: boolean;
  onBack: () => void;
  edgeZonePx?: number;
  minDistancePx?: number;
  maxVerticalDeltaPx?: number;
};

type PointerStart = {
  x: number;
  y: number;
};

export const useEdgeSwipeBack = ({
  enabled,
  onBack,
  edgeZonePx = 28,
  minDistancePx = 72,
  maxVerticalDeltaPx = 48,
}: UseEdgeSwipeBackOptions) => {
  const activeRef = useRef(false);
  const startRef = useRef<PointerStart | null>(null);

  const reset = useCallback(() => {
    activeRef.current = false;
    startRef.current = null;
  }, []);

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (!enabled) return;
      if (event.clientX > edgeZonePx) return;
      activeRef.current = true;
      startRef.current = { x: event.clientX, y: event.clientY };
    },
    [edgeZonePx, enabled]
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (!activeRef.current || !startRef.current) return;
      const deltaX = event.clientX - startRef.current.x;
      const deltaY = Math.abs(event.clientY - startRef.current.y);
      if (deltaX >= minDistancePx && deltaY <= maxVerticalDeltaPx) {
        reset();
        onBack();
      }
    },
    [maxVerticalDeltaPx, minDistancePx, onBack, reset]
  );

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: reset,
    onPointerCancel: reset,
  };
};

export default useEdgeSwipeBack;
