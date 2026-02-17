import React, { useEffect } from 'react';
import { HashRouter } from 'react-router-dom';
import AnimatedRoutes from '@/components/AnimatedRoutes';
import BottomNav from '@/components/BottomNav';
import InstallHint from '@/components/InstallHint';
import OrientationLockOverlay from '@/components/OrientationLockOverlay';
import { DashboardSkeleton } from '@/components/Skeleton';
import { ToastViewport } from '@/components/ui';
import { GymProvider } from '@/context/GymContext';
import { useGymData } from '@/hooks/useGymData';
import { I18nProvider } from '@/i18n/I18nProvider';
import { isReminderWindowReached, notifyPendingWorkout } from '@/services/notifications';
import { formatDate } from '@/services/utils';
import type { ThemeMode } from '@/types';
import LoginView from '@/views/LoginView';

const LIGHT_THEME_COLOR = '#ffffff';
const DARK_THEME_COLOR = '#111827';
const DARK_APP_BACKGROUND = '#030712';

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
  const themeMode = user?.preferences.themeMode ?? getInitialThemeMode();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const syncTheme = () => {
      const isDark = themeMode === 'dark' || (themeMode === 'system' && mediaQuery.matches);
      const isLight = themeMode === 'light';
      document.documentElement.classList.toggle('dark', isDark);
      document.documentElement.classList.toggle('light', isLight);
      document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
      document.documentElement.style.backgroundColor = isDark ? DARK_APP_BACKGROUND : LIGHT_THEME_COLOR;
      if (document.body) {
        document.body.style.backgroundColor = isDark ? DARK_APP_BACKGROUND : LIGHT_THEME_COLOR;
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

  if (!user) {
    if (isLoading) {
      return (
        <div className="max-w-md mx-auto h-[100dvh] bg-white dark:bg-gray-950 relative overflow-hidden transition-colors">
          <DashboardSkeleton />
        </div>
      );
    }
    return <LoginView />;
  }

  return (
    <div className="max-w-md mx-auto h-[100dvh] bg-white dark:bg-gray-950 relative shadow-2xl dark:shadow-black/40 overflow-hidden transition-colors">
      <OrientationLockOverlay />
      <InstallHint />
      <AnimatedRoutes />
      <BottomNav />
      <ToastViewport />
    </div>
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
