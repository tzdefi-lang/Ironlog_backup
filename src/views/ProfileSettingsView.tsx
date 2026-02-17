import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { FilterChip, ScreenShell, SurfaceCard } from '@/components/botanical-ui';
import { Button, pushToast } from '@/components/ui';
import { useGym } from '@/hooks/useGym';
import type { Locale } from '@/i18n/I18nProvider';
import { useI18n } from '@/i18n/useI18n';
import { exportAsCSV, exportAsJSON } from '@/services/export';
import { isNotificationSupported, requestNotificationPermission } from '@/services/notifications';
import type { ThemeMode } from '@/types';

const THEME_OPTIONS: ThemeMode[] = ['light', 'dark', 'system'];
const LOCALE_OPTIONS: Locale[] = ['en', 'zh'];

const ProfileSettingsView: React.FC = () => {
  const {
    user,
    logout,
    toggleUnit,
    setThemeMode,
    setNotificationsEnabled,
    workouts,
    exerciseDefs,
  } = useGym();
  const navigate = useNavigate();
  const { t, locale, setLocale } = useI18n();

  const getThemeLabel = (mode: ThemeMode) => {
    if (mode === 'light') return t('common.light');
    if (mode === 'dark') return t('common.dark');
    return t('common.system');
  };

  const getLocaleLabel = (value: Locale) => (
    value === 'en' ? t('profile.languageEnglish') : t('profile.languageChinese')
  );

  const handleExportJSON = () => {
    try {
      exportAsJSON(workouts, exerciseDefs);
      pushToast({ kind: 'success', message: t('toast.exportJsonSuccess') });
    } catch {
      pushToast({ kind: 'error', message: t('toast.exportJsonError') });
    }
  };

  const handleExportCSV = () => {
    try {
      exportAsCSV(workouts, exerciseDefs);
      pushToast({ kind: 'success', message: t('toast.exportCsvSuccess') });
    } catch {
      pushToast({ kind: 'error', message: t('toast.exportCsvError') });
    }
  };

  const handleNotificationToggle = async () => {
    if (!user) return;

    if (user.preferences.notificationsEnabled) {
      setNotificationsEnabled(false);
      pushToast({ kind: 'info', message: t('toast.notificationsOff') });
      return;
    }

    const permission = await requestNotificationPermission();
    if (permission === 'granted') {
      setNotificationsEnabled(true);
      pushToast({ kind: 'success', message: t('toast.notificationsOn') });
      return;
    }

    if (permission === 'unsupported') {
      pushToast({ kind: 'error', message: t('toast.notificationsUnsupported') });
      return;
    }

    pushToast({ kind: 'error', message: t('toast.notificationsDenied') });
  };

  return (
    <ScreenShell
      title={t('profile.settingsTitle')}
      subtitle={t('profile.settingsSubtitle')}
      leading={
        <button
          type="button"
          onClick={() => navigate('/profile')}
          aria-label={t('profile.back')}
          className="w-10 h-10 rounded-full bg-[var(--surface-muted)] border border-[var(--surface-border)] text-gray-700 dark:text-gray-200 flex items-center justify-center transition-all duration-500 ease-out active:scale-[0.98]"
        >
          <ChevronLeft size={20} />
        </button>
      }
      contentClassName="pb-[calc(8.9rem+env(safe-area-inset-bottom))]"
    >
      <div className="space-y-3 list-stagger">
        <SurfaceCard tone="muted" className="card-lift p-4 flex justify-between items-center">
          <span className="font-medium text-gray-700 dark:text-gray-300">{t('profile.units')}</span>
          <button
            onClick={toggleUnit}
            className="pressable font-semibold text-gray-900 dark:text-gray-100 bg-[var(--surface-card)] border border-[var(--surface-border)] px-4 py-2 rounded-xl shadow-[var(--surface-shadow)] hover:bg-[var(--surface-muted)] transition-all flex items-center gap-2"
          >
            {user?.preferences.defaultUnit.toUpperCase()}
            <span className="text-[10px] text-gray-500 dark:text-gray-400 bg-[var(--surface-muted)] px-1 rounded">
              {t('common.tapToChange')}
            </span>
          </button>
        </SurfaceCard>

        <SurfaceCard tone="muted" className="card-lift p-4 flex justify-between items-center gap-3">
          <span className="font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">{t('profile.appearance')}</span>
          <div className="flex flex-wrap justify-end gap-2">
            {THEME_OPTIONS.map((option) => (
              <FilterChip
                key={option}
                onClick={() => setThemeMode(option)}
                active={user?.preferences.themeMode === option}
              >
                {getThemeLabel(option)}
              </FilterChip>
            ))}
          </div>
        </SurfaceCard>

        <SurfaceCard tone="muted" className="card-lift p-4 flex justify-between items-center gap-3">
          <span className="font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">{t('profile.language')}</span>
          <div className="flex flex-wrap justify-end gap-2">
            {LOCALE_OPTIONS.map((option) => (
              <FilterChip
                key={option}
                onClick={() => setLocale(option)}
                active={locale === option}
              >
                {getLocaleLabel(option)}
              </FilterChip>
            ))}
          </div>
        </SurfaceCard>

        <SurfaceCard tone="muted" className="card-lift p-4 flex justify-between items-center gap-3">
          <div className="flex flex-col">
            <span className="font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">{t('profile.notifications')}</span>
            {!isNotificationSupported() && (
              <span className="text-xs text-gray-500 dark:text-gray-400">{t('profile.notificationsUnsupported')}</span>
            )}
          </div>
          <FilterChip
            active={!!user?.preferences.notificationsEnabled}
            onClick={() => {
              void handleNotificationToggle();
            }}
          >
            {user?.preferences.notificationsEnabled ? t('common.enabled') : t('common.disabled')}
          </FilterChip>
        </SurfaceCard>

        <SurfaceCard tone="muted" className="card-lift p-4">
          <div className="font-medium text-gray-700 dark:text-gray-300 mb-3">{t('profile.exportData')}</div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" className="w-full" onClick={handleExportJSON}>
              JSON
            </Button>
            <Button variant="secondary" className="w-full" onClick={handleExportCSV}>
              CSV
            </Button>
          </div>
        </SurfaceCard>
      </div>

      <Button variant="danger" className="w-full mt-10 rounded-2xl" onClick={logout}>
        {t('common.signOut')}
      </Button>
      <p className="mt-4 text-center text-xs text-gray-500 dark:text-gray-400">v{__APP_VERSION__}</p>
    </ScreenShell>
  );
};

export default ProfileSettingsView;
