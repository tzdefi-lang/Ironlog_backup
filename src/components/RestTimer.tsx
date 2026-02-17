import React, { useEffect, useRef, useState } from 'react';
import { Pause, Play, SkipForward, X } from 'lucide-react';
import Portal from '@/components/Portal';
import { useI18n } from '@/i18n/useI18n';

const TIMER_OPTIONS = [30, 60, 90, 120, 180] as const;

const normalizeDuration = (value: number): number =>
  TIMER_OPTIONS.includes(value as (typeof TIMER_OPTIONS)[number]) ? value : 90;

const formatClock = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remain = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remain).padStart(2, '0')}`;
};

const playDoneTone = () => {
  try {
    if (typeof window === 'undefined' || typeof window.AudioContext === 'undefined') return;
    const context = new window.AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.value = 880;
    gain.gain.value = 0.001;

    oscillator.connect(gain);
    gain.connect(context.destination);

    const now = context.currentTime;
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    oscillator.start(now);
    oscillator.stop(now + 0.25);
    oscillator.onended = () => {
      void context.close();
    };
  } catch {
    // no-op
  }
};

const vibrateDone = () => {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate([120, 80, 120]);
    }
  } catch {
    // no-op
  }
};

export type RestTimerProps = {
  isOpen: boolean;
  durationSeconds: number;
  restartToken: number;
  onClose: () => void;
  onDurationChange?: (seconds: number) => void;
};

const RestTimer: React.FC<RestTimerProps> = ({
  isOpen,
  durationSeconds,
  restartToken,
  onClose,
  onDurationChange,
}) => {
  const { t } = useI18n();
  const [activeDuration, setActiveDuration] = useState(normalizeDuration(durationSeconds));
  const [remainingSeconds, setRemainingSeconds] = useState(normalizeDuration(durationSeconds));
  const [isPaused, setIsPaused] = useState(false);
  const didCompleteRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;
    const normalized = normalizeDuration(durationSeconds);
    setActiveDuration(normalized);
    setRemainingSeconds(normalized);
    setIsPaused(false);
    didCompleteRef.current = false;
  }, [isOpen, durationSeconds, restartToken]);

  useEffect(() => {
    if (!isOpen || isPaused || remainingSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setRemainingSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isOpen, isPaused, remainingSeconds]);

  useEffect(() => {
    if (!isOpen || remainingSeconds !== 0 || didCompleteRef.current) return;
    didCompleteRef.current = true;
    vibrateDone();
    playDoneTone();
    const closeTimer = window.setTimeout(() => onClose(), 900);
    return () => window.clearTimeout(closeTimer);
  }, [isOpen, remainingSeconds, onClose]);

  if (!isOpen) return null;

  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const progress = activeDuration > 0 ? remainingSeconds / activeDuration : 0;
  const dashOffset = circumference * (1 - progress);

  const chooseDuration = (seconds: number) => {
    setActiveDuration(seconds);
    setRemainingSeconds(seconds);
    setIsPaused(false);
    didCompleteRef.current = false;
    onDurationChange?.(seconds);
  };

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[950] bg-black/45 backdrop-blur-sm px-6 flex items-center justify-center"
        onClick={onClose}
      >
        <div
          className="w-full max-w-sm rounded-[32px] border border-[var(--surface-border)] bg-[var(--surface-card)] dark:bg-[var(--surface-card)] p-6 shadow-[var(--surface-shadow-strong)] transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 tracking-tight display-serif">{t('restTimer.title')}</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500">{t('restTimer.subtitle')}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-[var(--surface-muted)] text-gray-500 dark:text-gray-300 flex items-center justify-center hover:brightness-95 transition-colors"
              aria-label={t('restTimer.close')}
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex justify-center mb-5">
            <div className="relative w-44 h-44">
              <svg
                className="w-full h-full -rotate-90"
                viewBox="0 0 140 140"
                role="img"
                aria-label={t('restTimer.countdown')}
              >
                <circle cx="70" cy="70" r={radius} fill="none" stroke="var(--surface-muted)" strokeWidth="10" />
                <circle
                  cx="70"
                  cy="70"
                  r={radius}
                  fill="none"
                  stroke="var(--stats-line-primary)"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  className="transition-[stroke-dashoffset] duration-500 ease-linear"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-4xl font-black font-mono text-gray-900 dark:text-gray-100 tracking-tight">
                  {formatClock(remainingSeconds)}
                </div>
                <div className="text-[11px] uppercase font-bold tracking-wide text-gray-400 dark:text-gray-500 mt-1">
                  {remainingSeconds === 0
                    ? t('restTimer.done')
                    : isPaused
                      ? t('restTimer.paused')
                      : t('restTimer.resting')}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-2 mb-4">
            {TIMER_OPTIONS.map((seconds) => (
              <button
                key={seconds}
                type="button"
                onClick={() => chooseDuration(seconds)}
                className={`py-2 rounded-lg text-xs font-bold transition-colors ${
                  activeDuration === seconds
                    ? 'bg-brand text-[var(--botanical-text)]'
                    : 'bg-[var(--surface-muted)] text-gray-500 dark:text-gray-300 hover:brightness-95'
                }`}
              >
                {seconds}s
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setIsPaused((prev) => !prev)}
              disabled={remainingSeconds === 0}
              className="h-11 rounded-2xl bg-[var(--botanical-accent)] text-[var(--botanical-text)] font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
            >
              {isPaused ? <Play size={16} /> : <Pause size={16} />}
              {isPaused ? t('restTimer.resume') : t('restTimer.pause')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-2xl bg-[var(--surface-muted)] text-gray-700 dark:text-gray-300 font-semibold flex items-center justify-center gap-2 hover:brightness-95 transition-colors"
            >
              <SkipForward size={16} />
              {t('restTimer.skip')}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default RestTimer;
