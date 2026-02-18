import React, { useEffect } from 'react';
import { HashRouter, useLocation } from 'react-router-dom';
import AnimatedRoutes from '@/components/AnimatedRoutes';
import BottomNav from '@/components/BottomNav';
import InstallHint from '@/components/InstallHint';
import OrientationLockOverlay from '@/components/OrientationLockOverlay';
import { DashboardSkeleton } from '@/components/Skeleton';
import StarterSplash from '@/components/StarterSplash';
import { ToastViewport } from '@/components/ui';
import { GymProvider } from '@/context/GymContext';
import {
  BOTANICAL_APP_BACKGROUND,
  BOTANICAL_DARK_APP_BACKGROUND,
  BOTANICAL_DARK_THEME_COLOR,
  BOTANICAL_THEME_COLOR,
} from '@/design/tokens';
import { useGymData } from '@/hooks/useGymData';
import { I18nProvider } from '@/i18n/I18nProvider';
import { isReminderWindowReached, notifyPendingWorkout } from '@/services/notifications';
import { formatDate } from '@/services/utils';
import type { ThemeMode } from '@/types';
import LoginView from '@/views/LoginView';
import NativeAuthProxyView from '@/views/NativeAuthProxyView';

const LIGHT_THEME_COLOR = BOTANICAL_THEME_COLOR;
const DARK_THEME_COLOR = BOTANICAL_DARK_THEME_COLOR;
const LIGHT_APP_BACKGROUND = BOTANICAL_APP_BACKGROUND;
const DARK_APP_BACKGROUND = BOTANICAL_DARK_APP_BACKGROUND;

const getInitialThemeMode = (): ThemeMode => {
  if (typeof window === 'undefined') return 'system';
  try {
    const raw = localStorage.getItem('ironlog_theme_mode');
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  } catch {
    // Ignore localStorage read failures and fallback to system mode.
  }
  return 'system';
};

const AppContent: React.FC = () => {
  const { user, workouts, isLoading } = useGymData();
  const location = useLocation();
  const themeMode = user?.preferences.themeMode ?? getInitialThemeMode();
  const isManageRoute = location.pathname.startsWith('/manage');
  const isNativeAuthRoute = location.pathname === '/native-auth';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const syncTheme = () => {
      const isDark = themeMode === 'dark' || (themeMode === 'system' && mediaQuery.matches);
      const isLight = themeMode === 'light';
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

      const appleStatusBarMeta = document.querySelector<HTMLMetaElement>(
        'meta[name="apple-mobile-web-app-status-bar-style"]'
      );
      if (appleStatusBarMeta) {
        appleStatusBarMeta.setAttribute('content', isDark ? 'black-translucent' : 'default');
      }
    };

    syncTheme();

    if (themeMode === 'system') {
      mediaQuery.addEventListener('change', syncTheme);
      return () => mediaQuery.removeEventListener('change', syncTheme);
    }

    return;
  }, [themeMode]);

  useEffect(() => {
    if (!user?.id || !user.preferences.notificationsEnabled) return;
    if (typeof window === 'undefined' || typeof Notification === 'undefined') return;

    const checkAndNotify = () => {
      if (Notification.permission !== 'granted') return;

      const now = new Date();
      if (!isReminderWindowReached(now)) return;

      const today = formatDate(now);
      const reminderKey = `ironlog_reminder_${user.id}_${today}`;
      if (localStorage.getItem(reminderKey) === '1') return;

      const hasPendingWorkout = workouts.some(
        (workout) => workout.date === today && !workout.completed
      );
      if (!hasPendingWorkout) return;

      if (notifyPendingWorkout()) {
        localStorage.setItem(reminderKey, '1');
      }
    };

    checkAndNotify();
    const timer = window.setInterval(checkAndNotify, 60 * 1000);
    const handleFocus = () => checkAndNotify();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkAndNotify();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [user?.id, user?.preferences.notificationsEnabled, workouts]);

  // iOS Safari shifts the body scroll position when the keyboard opens despite
  // overflow:hidden. Force it back when the keyboard actually closes.
  useEffect(() => {
    const onFocusOut = () => {
      // Wait a tick so focusin on the next input (if any) fires first.
      setTimeout(() => {
        const active = document.activeElement;
        // If focus moved to another interactive element the keyboard is still
        // open — skip the reset to avoid a scroll jump between inputs.
        if (active && active !== document.body) return;
        window.scrollTo(0, 0);
      }, 0);
    };
    window.addEventListener('focusout', onFocusOut);
    return () => window.removeEventListener('focusout', onFocusOut);
  }, []);

  if (isNativeAuthRoute) {
    return <NativeAuthProxyView />;
  }

  if (!user) {
    if (isLoading) {
      return (
        <>
          <div className="app-shell max-w-md mx-auto h-[100dvh] bg-[var(--surface-card)] dark:bg-[var(--surface-card)] relative overflow-hidden transition-colors">
            <DashboardSkeleton />
          </div>
          <StarterSplash ready={!isLoading} />
        </>
      );
    }
    return (
      <>
        <LoginView />
        <StarterSplash ready={!isLoading} />
      </>
    );
  }

  const shellClass = isManageRoute
    ? 'app-shell w-full h-[100dvh] bg-[var(--surface-card)] dark:bg-[var(--surface-card)] relative overflow-hidden transition-colors'
    : 'app-shell max-w-md mx-auto h-[100dvh] bg-[var(--surface-card)] dark:bg-[var(--surface-card)] relative shadow-[var(--surface-shadow-strong)] overflow-hidden transition-colors';

  return (
    <>
      <div className={shellClass}>
        <OrientationLockOverlay />
        {!isManageRoute && <InstallHint />}
        <AnimatedRoutes />
        <BottomNav />
        <ToastViewport />
      </div>
      <StarterSplash ready={!isLoading} />
    </>
  );
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <I18nProvider>
        <GymProvider>
          <AppContent />
        </GymProvider>
      </I18nProvider>
    </HashRouter>
  );
};

export default App;
