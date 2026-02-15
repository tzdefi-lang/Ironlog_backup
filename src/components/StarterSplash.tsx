import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type StarterSplashProps = {
  ready: boolean;
};

const MIN_SHOW_MS = 420;
const EXIT_MS = 740;

const prefersReducedMotion = () => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
};

const StarterSplash: React.FC<StarterSplashProps> = ({ ready }) => {
  const [shouldRender, setShouldRender] = useState(true);
  const [isExiting, setIsExiting] = useState(false);
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (startedAtRef.current !== null) return;
    startedAtRef.current = typeof performance !== 'undefined' ? performance.now() : Date.now();
  }, []);

  useEffect(() => {
    if (!ready) return;

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const startedAt = startedAtRef.current ?? now;
    const elapsed = now - startedAt;
    const delay = Math.max(0, MIN_SHOW_MS - elapsed);
    const exitMs = prefersReducedMotion() ? 60 : EXIT_MS;

    const openTimer = window.setTimeout(() => setIsExiting(true), delay);
    const closeTimer = window.setTimeout(() => setShouldRender(false), delay + exitMs);

    return () => {
      window.clearTimeout(openTimer);
      window.clearTimeout(closeTimer);
    };
  }, [ready]);

  if (!shouldRender) return null;

  const overlay = (
    <div className={`starter-splash ${isExiting ? 'is-exiting' : ''}`} aria-hidden="true">
      <div className="starter-splash__bg" />
      <img
        className="starter-splash__logo"
        src="/icons/icon-512x512.png"
        alt=""
        draggable={false}
      />
    </div>
  );

  if (typeof document !== 'undefined') return createPortal(overlay, document.body);
  return overlay;
};

export default StarterSplash;
