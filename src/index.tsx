import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import { registerSW } from 'virtual:pwa-register';
import AppErrorBoundary from '@/components/AppErrorBoundary';
import AppRoot from '@/AppRoot';
import {
  BOTANICAL_APP_BACKGROUND,
  BOTANICAL_DARK_APP_BACKGROUND,
  BOTANICAL_DARK_THEME_COLOR,
  BOTANICAL_THEME_COLOR,
} from '@/design/tokens';
import '@/index.css';

const DEFAULT_PRIVY_APP_ID = 'cmlib187t04f3jo0cy0ffgof8';
const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID || DEFAULT_PRIVY_APP_ID;
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
const LIGHT_THEME_COLOR = BOTANICAL_THEME_COLOR;
const DARK_THEME_COLOR = BOTANICAL_DARK_THEME_COLOR;
const LIGHT_APP_BACKGROUND = BOTANICAL_APP_BACKGROUND;
const DARK_APP_BACKGROUND = BOTANICAL_DARK_APP_BACKGROUND;

if (import.meta.env.PROD && SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    release: __APP_VERSION__,
    environment: 'production',
    tracesSampleRate: 0.1,
  });
}

const getInitialThemeMode = (): 'light' | 'dark' | 'system' => {
  try {
    const raw = localStorage.getItem('ironlog_theme_mode');
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  } catch {
    // ignore
  }
  return 'system';
};

const applyInitialTheme = () => {
  if (typeof window === 'undefined') return;
  const mode = getInitialThemeMode();
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  const isDark = mode === 'dark' || (mode === 'system' && prefersDark);
  const isLight = mode === 'light';

  document.documentElement.classList.toggle('dark', isDark);
  document.documentElement.classList.toggle('light', isLight);
  document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
  document.documentElement.style.backgroundColor = isDark ? DARK_APP_BACKGROUND : LIGHT_APP_BACKGROUND;
  if (document.body) {
    document.body.style.backgroundColor = isDark ? DARK_APP_BACKGROUND : LIGHT_APP_BACKGROUND;
  }

  const themeColorMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (themeColorMeta) {
    themeColorMeta.setAttribute('content', isDark ? DARK_THEME_COLOR : LIGHT_THEME_COLOR);
  }
};

applyInitialTheme();

if (!import.meta.env.VITE_PRIVY_APP_ID) {
  console.warn(
    '[IronLog] VITE_PRIVY_APP_ID is missing. Falling back to built-in default for emergency startup.'
  );
}

const PRELOAD_RELOAD_KEY = 'ironlog_preload_reload_once';

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  if (sessionStorage.getItem(PRELOAD_RELOAD_KEY) === '1') return;
  sessionStorage.setItem(PRELOAD_RELOAD_KEY, '1');
  window.location.reload();
});

window.addEventListener('load', () => {
  sessionStorage.removeItem(PRELOAD_RELOAD_KEY);
});

if (import.meta.env.PROD) {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateSW(true);
    },
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AppErrorBoundary>
      <AppRoot appId={PRIVY_APP_ID} />
    </AppErrorBoundary>
  </React.StrictMode>
);
