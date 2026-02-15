import React, { useEffect, useRef, useState } from 'react';
import Portal from '@/components/Portal';

type BottomSheetProps = {
  isOpen: boolean;
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
  topGapPx?: number;
  maxWidthClassName?: string;
  panelClassName?: string;
  contentClassName?: string;
};

const CLOSE_MS = 420;

const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  title,
  onClose,
  children,
  topGapPx = 56,
  maxWidthClassName = 'max-w-md',
  panelClassName,
  contentClassName,
}) => {
  const [isMounted, setIsMounted] = useState(false);
  const [phase, setPhase] = useState<'opening' | 'open' | 'closing'>('opening');
  const closeTimerRef = useRef<number | null>(null);
  const openRafRef = useRef<number | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const [dragY, setDragY] = useState(0);
  const dragYRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ pointerId: number; startY: number } | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      if (openRafRef.current) window.cancelAnimationFrame(openRafRef.current);

      setIsMounted(true);
      setIsDragging(false);
      setDragY(0);
      dragYRef.current = 0;
      setPhase('opening');

      openRafRef.current = window.requestAnimationFrame(() => {
        openRafRef.current = window.requestAnimationFrame(() => {
          // Force a layout read so iOS reliably animates from translateY(100%) -> 0.
          panelRef.current?.getBoundingClientRect();
          setPhase('open');
        });
      });
      return;
    }

    if (!isOpen && isMounted) {
      if (openRafRef.current) window.cancelAnimationFrame(openRafRef.current);
      setIsDragging(false);
      setDragY(0);
      dragYRef.current = 0;
      setPhase('closing');
      closeTimerRef.current = window.setTimeout(() => {
        setIsMounted(false);
        closeTimerRef.current = null;
      }, CLOSE_MS);
    }
  }, [isOpen, isMounted]);

  useEffect(() => {
    if (!isMounted) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMounted]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
      if (openRafRef.current) window.cancelAnimationFrame(openRafRef.current);
    };
  }, []);

  const requestClose = () => {
    if (phase === 'closing') return;
    setPhase('closing');
    onClose();
  };

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    requestClose();
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (phase !== 'open') return;
    setIsDragging(true);
    dragStartRef.current = { pointerId: event.pointerId, startY: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragStartRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const delta = event.clientY - drag.startY;
    const next = Math.max(0, delta);
    dragYRef.current = next;
    setDragY(next);
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragStartRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragStartRef.current = null;
    setIsDragging(false);

    const sheetHeight =
      (event.currentTarget.parentElement as HTMLElement | null)?.getBoundingClientRect()?.height ?? 0;
    const threshold = Math.max(72, sheetHeight * 0.12);
    const finalDragY = dragYRef.current;
    if (finalDragY > threshold) {
      window.requestAnimationFrame(() => requestClose());
      return;
    }
    dragYRef.current = 0;
    setDragY(0);
  };

  if (!isMounted) return null;

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[1000] flex items-end justify-center"
        onClick={handleBackdropClick}
        aria-hidden={phase === 'closing'}
      >
        <div
          className={`bottom-sheet-backdrop pointer-events-none absolute inset-0 bg-black/45 backdrop-blur-sm ${
            phase === 'open' ? 'is-open' : ''
          }`}
        />

        <div
          ref={panelRef}
          className={`bottom-sheet-panel relative w-full ${maxWidthClassName} mx-auto rounded-t-[32px] border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-2xl flex flex-col ${
            phase === 'open' ? 'is-open' : ''
          } ${isDragging ? 'is-dragging' : ''} ${panelClassName ?? ''}`}
          style={{
            maxHeight: `calc(100dvh - var(--standalone-safe-top) - ${topGapPx}px)`,
            transform:
              phase === 'open'
                ? `translate3d(0, ${dragY}px, 0)`
                : phase === 'opening'
                  ? 'translate3d(0, 100%, 0)'
                  : 'translate3d(0, 100%, 0)',
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <div
            className="px-6 pt-3 pb-4 select-none"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            style={{ touchAction: 'none' }}
            aria-label={title ?? 'Sheet'}
          >
            <div className="flex items-center justify-center">
              <div className="h-1.5 w-12 rounded-full bg-gray-200 dark:bg-gray-800" />
            </div>
            {title && (
              <h3 className="mt-4 text-center font-black text-xl text-gray-900 dark:text-gray-100 tracking-tight">
                {title}
              </h3>
            )}
          </div>

          <div
            className={`flex-1 min-h-0 overflow-y-auto scroll-area px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] ${
              contentClassName ?? ''
            }`}
          >
            {children}
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default BottomSheet;

