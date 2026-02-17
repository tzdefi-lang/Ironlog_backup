import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getMediaFromDB } from '@/services/utils';
import { ImageOff, Loader2, Trash2, Copy } from 'lucide-react';

// Best-effort haptics (works on many Android devices; iOS Safari/PWAs generally do NOT support vibration).
const haptic = (pattern: number | number[] = 10) => {
  try {
    // @ts-ignore
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      // @ts-ignore
      navigator.vibrate(pattern);
    }
  } catch {
    // no-op
  }
};

// --- Media Resolver Component ---
export const MediaResolver: React.FC<{ 
  mediaId?: string; 
  mediaUrl?: string; 
  type?: 'image' | 'video';
  className?: string; 
}> = ({ mediaId, mediaUrl, type, className }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [src, setSrc] = useState<string | undefined>(undefined);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isVisible) return;

    const node = containerRef.current;
    if (!node) return;

    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '120px 0px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) return;

    let active = true;
    let objectUrl: string | null = null;

    const loadMedia = async () => {
      setIsError(false);
      
      if (mediaId) {
        setIsLoading(true);
        setSrc(undefined);
        try {
          const blob = await getMediaFromDB(mediaId);
          if (!active) return;
          
          if (blob && blob.size > 0) {
            objectUrl = URL.createObjectURL(blob);
            setSrc(objectUrl);
          } else {
            setIsError(true);
          }
        } catch (_e) {
          if (active) setIsError(true);
        } finally {
          if (active) setIsLoading(false);
        }
      } else if (mediaUrl) {
        setSrc(mediaUrl);
        setIsLoading(false);
      } else {
        setSrc(undefined);
        setIsLoading(false);
      }
    };

    loadMedia();

    return () => {
      active = false;
      if (objectUrl) {
         URL.revokeObjectURL(objectUrl);
      }
    };
  }, [mediaId, mediaUrl, isVisible]);

  const wrapperClass = className ?? '';

  if (!isVisible) {
    return <div ref={containerRef} className={`bg-gray-50 dark:bg-gray-800 ${wrapperClass}`} />;
  }

  if (isError) {
    return (
      <div
        ref={containerRef}
        className={`bg-gray-100 dark:bg-gray-800 flex flex-col items-center justify-center text-gray-300 dark:text-gray-500 ${wrapperClass}`}
      >
        <ImageOff size={20} />
      </div>
    );
  }

  if (isLoading || (!src && mediaId)) {
     return (
        <div
          ref={containerRef}
          className={`bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-300 dark:text-gray-500 ${wrapperClass}`}
        >
           <Loader2 size={16} className="animate-spin" />
        </div>
     );
  }

  if (!src) {
    return <div ref={containerRef} className={`bg-gray-50 dark:bg-gray-800 ${wrapperClass}`} />;
  }

  if (type === 'video') {
    return (
      <div ref={containerRef} className={wrapperClass}>
        <video
          src={src}
          className="w-full h-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          disablePictureInPicture
          onError={() => setIsError(true)}
        />
      </div>
    );
  }
  
  return (
    <div ref={containerRef} className={wrapperClass}>
      <img
        src={src}
        alt="Media"
        className="w-full h-full object-cover"
        onError={(e) => {
          console.warn("Media failed to render", e);
          setIsError(true);
        }}
      />
    </div>
  );
};

// --- Long Press Hook ---
export function useLongPress(
  callback: () => void,
  onClick: () => void,
  ms = 500
) {
  const [startLongPress, setStartLongPress] = useState(false);
  const timerRef = useRef<number | undefined>(undefined);
  const startPos = useRef<{x: number, y: number} | null>(null);

  useEffect(() => {
    if (startLongPress) {
      timerRef.current = window.setTimeout(() => {
        haptic(10);
        callback();
        setStartLongPress(false);
      }, ms);
    } else {
      clearTimeout(timerRef.current);
    }

    return () => clearTimeout(timerRef.current);
  }, [startLongPress, callback, ms]);

  const cancel = () => {
      if (startLongPress) {
          setStartLongPress(false);
          clearTimeout(timerRef.current);
      }
  };

  return {
    onPointerDown: (e: React.PointerEvent) => {
        startPos.current = { x: e.clientX, y: e.clientY };
        setStartLongPress(true);
    },
    onPointerMove: (e: React.PointerEvent) => {
        if (startLongPress && startPos.current) {
            const moveX = Math.abs(e.clientX - startPos.current.x);
            const moveY = Math.abs(e.clientY - startPos.current.y);
            if (moveX > 10 || moveY > 10) {
                cancel();
            }
        }
    },
    onPointerUp: (_e: React.PointerEvent) => {
       if (startLongPress) {
           setStartLongPress(false);
           // Only trigger click if the timer hasn't fired yet
           if (timerRef.current) {
               clearTimeout(timerRef.current);
               onClick();
           }
       }
       startPos.current = null;
    },
    onPointerLeave: () => cancel(),
  };
}

// --- Swipe Logic (Pointer Events) ---

export const useSwipe = ({ onSwipeUp, onSwipeDown, onSwipeLeft, onSwipeRight }: {
    onSwipeUp?: () => void,
    onSwipeDown?: () => void,
    onSwipeLeft?: () => void,
    onSwipeRight?: () => void,
}) => {
    const touchStart = useRef<{x: number, y: number} | null>(null);
    const touchEnd = useRef<{x: number, y: number} | null>(null);

    const minSwipeDistance = 50;

    const onPointerDown = (e: React.PointerEvent) => {
        touchEnd.current = null;
        touchStart.current = {
            x: e.clientX,
            y: e.clientY
        };
        // Important for touch devices to capture movements
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: React.PointerEvent) => {
        touchEnd.current = {
            x: e.clientX,
            y: e.clientY
        };
    };

    const onPointerUp = (e: React.PointerEvent) => {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        if (!touchStart.current || !touchEnd.current) return;
        
        const distanceX = touchStart.current.x - touchEnd.current.x;
        const distanceY = touchStart.current.y - touchEnd.current.y;
        const isHorizontal = Math.abs(distanceX) > Math.abs(distanceY);

        if (isHorizontal) {
            if (Math.abs(distanceX) < minSwipeDistance) return;
            if (distanceX > 0 && onSwipeLeft) onSwipeLeft();
            if (distanceX < 0 && onSwipeRight) onSwipeRight();
        } else {
            if (Math.abs(distanceY) < minSwipeDistance) return;
            if (distanceY > 0 && onSwipeUp) onSwipeUp();
            if (distanceY < 0 && onSwipeDown) onSwipeDown();
        }
    };

    return { onPointerDown, onPointerMove, onPointerUp };
};

// --- Swipeable List Item (Pointer Events) ---
export const SwipeableItem: React.FC<{
    children: React.ReactNode,
    onSwipeLeft?: () => void,
    onSwipeRight?: () => void,
    className?: string,
    containerClassName?: string,
    leftActionLabel?: string,
    rightActionLabel?: string
}> = ({
    children,
    onSwipeLeft,
    onSwipeRight,
    className,
    containerClassName,
    leftActionLabel = 'Delete',
    rightActionLabel = 'Copy',
}) => {
    // How far the row can slide to reveal the action button.
    const ACTION_WIDTH = 128; // px
    // Make it easier to fully open on iPhone (one swipe should be enough)
    const OPEN_THRESHOLD = Math.max(18, ACTION_WIDTH * 0.18);
    const VELOCITY_OPEN = 0.55; // px/ms

    const [offsetX, setOffsetX] = useState(0);
    const offsetXRef = useRef(0);
    const [isDragging, setIsDragging] = useState(false);
    const [lockedAxis, setLockedAxis] = useState<'x' | 'y' | null>(null);

    const start = useRef({ x: 0, y: 0 });
    const startTime = useRef(0);
    const baseOffset = useRef(0); // offset at the start of drag (0 or +/- ACTION_WIDTH)
    const rafRef = useRef<number | null>(null);

    const minOffset = onSwipeLeft ? -ACTION_WIDTH : 0;
    const maxOffset = onSwipeRight ? ACTION_WIDTH : 0;
    const isEditableTarget = (target: EventTarget | null) => {
      const element = target as HTMLElement | null;
      if (!element) return false;
      if (element.closest('input, textarea, select')) return true;
      return element.isContentEditable || !!element.closest('[contenteditable="true"]');
    };

    const setOffset = (x: number) => {
        // A tiny rubber-band feel near the edges so it doesn't feel "stuck".
        let v = x;
        if (v > maxOffset) v = maxOffset + (v - maxOffset) * 0.12;
        if (v < minOffset) v = minOffset + (v - minOffset) * 0.12;
        const clamped = Math.max(minOffset, Math.min(maxOffset, v));
        offsetXRef.current = clamped;
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => setOffsetX(clamped));
    };

    useEffect(() => {
      const resetGesture = () => {
        setIsDragging(false);
        setLockedAxis(null);
      };
      window.addEventListener('blur', resetGesture);
      return () => window.removeEventListener('blur', resetGesture);
    }, []);

    const close = () => setOffset(0);
    const openLeft = () => {
      if (onSwipeLeft) setOffset(-ACTION_WIDTH);
      else close();
    };
    const openRight = () => {
      if (onSwipeRight) setOffset(ACTION_WIDTH);
      else close();
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        if (isEditableTarget(e.target)) {
            // Let text/number inputs manage focus + keyboard without entering swipe state.
            setIsDragging(false);
            setLockedAxis(null);
            return;
        }
        start.current = { x: e.clientX, y: e.clientY };
        startTime.current = performance.now();
        baseOffset.current = offsetXRef.current;
        setLockedAxis(null);
        setIsDragging(true);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging) return;
        const dx = e.clientX - start.current.x;
        const dy = e.clientY - start.current.y;

        // Direction lock: only capture and drag when it's clearly a horizontal gesture.
        if (!lockedAxis) {
            const adx = Math.abs(dx);
            const ady = Math.abs(dy);
            if (adx < 6 && ady < 6) return;
            if (adx > ady * 1.2) {
                setLockedAxis('x');
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            } else {
                setLockedAxis('y');
                return; // let the page scroll
            }
        }

        if (lockedAxis === 'x') {
            // While dragging horizontally, prevent scroll jitter.
            // NOTE: the real fix for iOS is touch-action: pan-y (below), not preventDefault.
            // We keep preventDefault as a best-effort for non-iOS browsers.
            e.preventDefault?.();
            const BOOST = 1.25; // make it feel less "heavy" on touch
            setOffset(baseOffset.current + dx * BOOST);
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (!isDragging) return;
        setIsDragging(false);
        try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}

        if (lockedAxis !== 'x') {
            // If an action is open, a simple tap closes it.
            if (offsetXRef.current !== 0) close();
            setLockedAxis(null);
            return;
        }

        const x = offsetXRef.current;
        const dt = Math.max(1, performance.now() - startTime.current);
        const dx = x - baseOffset.current;
        const v = Math.abs(dx) / dt;

        // Prefer a one-swipe open if user either:
        // 1) dragged past a small threshold, OR
        // 2) flicked quickly with enough velocity.
        if (onSwipeRight && (x > OPEN_THRESHOLD || (dx > 12 && v > VELOCITY_OPEN))) openRight();
        else if (onSwipeLeft && (x < -OPEN_THRESHOLD || (dx < -12 && v > VELOCITY_OPEN))) openLeft();
        else close();

        setLockedAxis(null);
    };

    const onClickCapture = (e: React.MouseEvent) => {
        // If actions are open, tapping the row closes it instead of navigating.
        if (offsetXRef.current !== 0) {
            e.preventDefault();
            e.stopPropagation();
            close();
        }
    };

    const actionCommon = "h-full flex items-center justify-center font-bold";
    const showRightAction = !!onSwipeRight && offsetX > 10;
    const showLeftAction = !!onSwipeLeft && offsetX < -10;

    return (
        <div
            className={`relative w-full overflow-hidden rounded-3xl mb-4 select-none ${containerClassName || ''}`}
            style={{ touchAction: 'pan-y' }}
        >
            {/* Background actions (clickable) */}
            <div className="absolute inset-0 flex justify-between items-stretch">
                {onSwipeRight ? (
                  <button
                      type="button"
                      className={`${actionCommon} ${showRightAction ? 'opacity-100' : 'opacity-0'} transition-opacity duration-150 bg-green-50 text-green-600`}
                      style={{ width: ACTION_WIDTH }}
                      onClick={() => { haptic(10); onSwipeRight(); close(); }}
                      aria-label={rightActionLabel}
                  >
                      <span className="flex items-center gap-2"><Copy size={20} /> {rightActionLabel}</span>
                  </button>
                ) : (
                  <div style={{ width: ACTION_WIDTH }} />
                )}
                {onSwipeLeft ? (
                  <button
                      type="button"
                      className={`${actionCommon} ${showLeftAction ? 'opacity-100' : 'opacity-0'} transition-opacity duration-150 bg-red-50 text-red-500`}
                      style={{ width: ACTION_WIDTH }}
                      onClick={() => { haptic(10); onSwipeLeft(); close(); }}
                      aria-label={leftActionLabel}
                  >
                      <span className="flex items-center gap-2">{leftActionLabel} <Trash2 size={20} /></span>
                  </button>
                ) : (
                  <div style={{ width: ACTION_WIDTH }} />
                )}
            </div>

            {/* Foreground content */}
            <div
                className={`relative bg-white dark:bg-gray-900 will-change-transform ${isDragging ? '' : 'transition-transform duration-200 ease-out'} ${className || ''}`}
                style={{ transform: `translate3d(${offsetX}px, 0, 0)`, willChange: 'transform', touchAction: 'pan-y' }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onClickCapture={onClickCapture}
            >
                {children}
            </div>
        </div>
    );
};

// --- Components ---

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }> = ({ 
  className = '', variant = 'primary', onClick, ...props 
}) => {
  const base = "px-6 py-3 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 pressable";
  const variants = {
    // Warm "yellow" accent (amber) reads better than pure yellow on white and keeps contrast.
    primary: "bg-amber-400 text-gray-900 shadow-lg shadow-amber-100 hover:bg-amber-500 dark:shadow-amber-900/30",
    secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700",
    danger: "bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950/45 dark:text-red-300 dark:hover:bg-red-900/45 dark:border dark:border-red-900/55",
    ghost: "bg-transparent text-gray-500 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
  };
  return (
    <button
      className={`${base} ${variants[variant]} ${className}`}
      {...props}
      onClick={(e) => {
        haptic(10);
        onClick?.(e);
      }}
    />
  );
};

export const Modal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  panelClassName?: string;
  contentClassName?: string;
  overlayClassName?: string;
}> = ({
  isOpen,
  onClose,
  title,
  children,
  panelClassName,
  contentClassName,
  overlayClassName,
}) => {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsClosing(false);
      return;
    }

    if (!shouldRender) return;

    setIsClosing(true);
    const timer = window.setTimeout(() => {
      setShouldRender(false);
      setIsClosing(false);
    }, 220);

    return () => window.clearTimeout(timer);
  }, [isOpen, shouldRender]);

  useEffect(() => {
    if (!shouldRender) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [shouldRender, onClose]);

  if (!shouldRender) return null;

  const phaseClass = isClosing ? 'modal-backdrop--exit' : 'modal-backdrop--enter';
  const panelPhaseClass = isClosing ? 'modal-panel--exit' : 'modal-panel--enter';

  const overlay = (
    <div
      className={`fixed inset-0 z-[1000] flex items-center justify-center ${
        overlayClassName ??
        'bg-gradient-to-t from-black/40 via-black/25 to-black/10 backdrop-blur-sm'
      } modal-backdrop ${phaseClass}`}
      onMouseDown={onClose}
      role="presentation"
    >
      <div
        className={`bg-white dark:bg-gray-900 rounded-[32px] shadow-2xl dark:shadow-black/60 w-full max-w-md mx-4 max-h-[92vh] overflow-hidden flex flex-col modal-panel ${panelPhaseClass} ${
          panelClassName ?? ''
        }`}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-white dark:bg-gray-900 rounded-t-[32px]">
          <h3 className="font-bold text-xl text-gray-900 dark:text-gray-100 tracking-tight">{title}</h3>
          <button
            onClick={onClose}
            className="pressable w-8 h-8 rounded-full flex items-center justify-center text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-95 transition-all"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className={`flex-1 ${contentClassName ?? 'p-6 overflow-y-auto scroll-area'}`}>
          {children}
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') return createPortal(overlay, document.body);
  return overlay;
};


export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label?: string }> = ({ label, className = '', ...props }) => (
  <div className="flex flex-col gap-2 mb-4">
    {label && <label className="text-sm font-semibold text-gray-500 dark:text-gray-400 ml-1">{label}</label>}
    <input className={`bg-gray-50 dark:bg-gray-800 border-none rounded-2xl px-4 py-3 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-amber-200 outline-none transition-all ${className}`} {...props} />
  </div>
);

export const ConfirmDialog: React.FC<{
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={title}>
      <p className="mb-6 text-gray-600 dark:text-gray-300">{message}</p>
      <Button
        className="w-full mb-3"
        variant={danger ? 'danger' : 'primary'}
        onClick={onConfirm}
      >
        {confirmText}
      </Button>
      <Button className="w-full" variant="secondary" onClick={onCancel}>
        {cancelText}
      </Button>
    </Modal>
  );
};

export type ToastKind = 'success' | 'error' | 'info';

type ToastPayload = { message: string; kind?: ToastKind; durationMs?: number };

const TOAST_EVENT = 'ironlog:toast';

export const pushToast = (payload: ToastPayload | string) => {
  if (typeof window === 'undefined') return;
  const normalized: ToastPayload =
    typeof payload === 'string' ? { message: payload } : payload;
  window.dispatchEvent(new CustomEvent<ToastPayload>(TOAST_EVENT, { detail: normalized }));
};

export const Toast: React.FC<{
  open: boolean;
  message: string;
  kind?: ToastKind;
  onClose: () => void;
  durationMs?: number;
}> = ({ open, message, kind = 'info', onClose, durationMs = 2600 }) => {
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(onClose, durationMs);
    return () => window.clearTimeout(timer);
  }, [open, durationMs, onClose]);

  if (!open) return null;

  const styleByKind: Record<ToastKind, string> = {
    success: 'bg-green-600 text-white',
    error: 'bg-red-600 text-white',
    info: 'bg-gray-900 text-white',
  };

  const toast = (
    <div className="fixed inset-x-0 bottom-[calc(5.8rem+env(safe-area-inset-bottom))] z-[1200] px-6 flex justify-center pointer-events-none">
      <div
        className={`max-w-md w-full rounded-2xl px-4 py-3 text-sm font-semibold shadow-2xl ${styleByKind[kind]}`}
      >
        {message}
      </div>
    </div>
  );

  if (typeof document !== 'undefined') return createPortal(toast, document.body);
  return toast;
};

export const ToastViewport: React.FC = () => {
  const [state, setState] = useState<{ open: boolean; message: string; kind: ToastKind; durationMs: number }>({
    open: false,
    message: '',
    kind: 'info',
    durationMs: 2600,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (event: Event) => {
      const custom = event as CustomEvent<ToastPayload>;
      const detail = custom.detail;
      if (!detail?.message) return;
      setState({
        open: true,
        message: detail.message,
        kind: detail.kind ?? 'info',
        durationMs: detail.durationMs ?? 2600,
      });
    };
    window.addEventListener(TOAST_EVENT, handler as EventListener);
    return () => window.removeEventListener(TOAST_EVENT, handler as EventListener);
  }, []);

  return (
    <Toast
      open={state.open}
      message={state.message}
      kind={state.kind}
      durationMs={state.durationMs}
      onClose={() => setState(prev => ({ ...prev, open: false }))}
    />
  );
};
