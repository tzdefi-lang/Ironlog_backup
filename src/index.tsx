import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import AppErrorBoundary from '@/components/AppErrorBoundary';
import AppRoot from '@/AppRoot';
import '@/index.css';

const DEFAULT_PRIVY_APP_ID = 'cmlib187t04f3jo0cy0ffgof8';
const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID || DEFAULT_PRIVY_APP_ID;
const LIGHT_THEME_COLOR = '#ffffff';
const DARK_THEME_COLOR = '#111827';
const LIGHT_APP_BACKGROUND = '#ffffff';
const DARK_APP_BACKGROUND = '#030712';

const isIOSDevice = () => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/i.test(ua);
  const isIPadOSDesktop = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return isIOS || isIPadOSDesktop;
};

const isStandaloneMode = () => {
  if (typeof window === 'undefined') return false;
  const mediaStandalone = window.matchMedia?.('(display-mode: standalone)').matches ?? false;
  const navigatorStandalone =
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  const androidTwaReferrer = document.referrer.startsWith('android-app://');
  return mediaStandalone || navigatorStandalone || androidTwaReferrer;
};

const applyStandaloneClass = () => {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('ios-standalone', isIOSDevice() && isStandaloneMode());
};

const getInitialThemeMode = (): 'light' | 'dark' | 'system' => {
  try {
    const raw = localStorage.getItem('ironlog_theme_mode');
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  } catch {
    // ignore
  }
  return 'system';
};

applyStandaloneClass();
if (typeof window !== 'undefined') {
  window.addEventListener('pageshow', applyStandaloneClass);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      applyStandaloneClass();
    }
  });

  const displayModeQuery = window.matchMedia?.('(display-mode: standalone)');
  if (displayModeQuery) {
    if (typeof displayModeQuery.addEventListener === 'function') {
      displayModeQuery.addEventListener('change', applyStandaloneClass);
    } else {
      displayModeQuery.addListener(applyStandaloneClass);
    }
  }
}

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
