import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
    <div className="h-full bg-white dark:bg-gray-950 overflow-y-auto scroll-area px-6 pt-8 pb-[calc(7.5rem+env(safe-area-inset-bottom))] view-enter transition-colors">
      <header className="flex items-center gap-3 mb-8">
        <button
          type="button"
          onClick={() => navigate('/profile')}
          aria-label={t('profile.back')}
          className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-gray-100 tracking-tight">{t('profile.settingsTitle')}</h1>
          <p className="text-sm text-gray-400 dark:text-gray-500">{t('profile.settingsSubtitle')}</p>
        </div>
      </header>

      <div className="space-y-3 list-stagger">
        <div className="card-lift bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl flex justify-between items-center transition-colors">
          <span className="font-medium text-gray-700 dark:text-gray-300">{t('profile.units')}</span>
          <button
            onClick={toggleUnit}
            className="pressable font-bold text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 px-4 py-2 rounded-xl shadow-sm shadow-gray-200/70 dark:shadow-none hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-95 transition-all flex items-center gap-2"
          >
            {user?.preferences.defaultUnit.toUpperCase()}
            <span className="text-[10px] text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-1 rounded">{t('common.tapToChange')}</span>
          </button>
        </div>

        <div className="card-lift bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl flex justify-between items-center gap-3 transition-colors">
          <span className="font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">{t('profile.appearance')}</span>
          <div className="flex flex-wrap justify-end gap-2">
            {THEME_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setThemeMode(option)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  user?.preferences.themeMode === option
                    ? 'bg-amber-400 text-gray-900'
                    : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {getThemeLabel(option)}
              </button>
            ))}
          </div>
        </div>

        <div className="card-lift bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl flex justify-between items-center gap-3 transition-colors">
          <span className="font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">{t('profile.language')}</span>
          <div className="flex flex-wrap justify-end gap-2">
            {LOCALE_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setLocale(option)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  locale === option
                    ? 'bg-amber-400 text-gray-900'
                    : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {getLocaleLabel(option)}
              </button>
            ))}
          </div>
        </div>

        <div className="card-lift bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl flex justify-between items-center gap-3 transition-colors">
          <div className="flex flex-col">
            <span className="font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">{t('profile.notifications')}</span>
            {!isNotificationSupported() && (
              <span className="text-xs text-gray-400 dark:text-gray-500">{t('profile.notificationsUnsupported')}</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              void handleNotificationToggle();
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              user?.preferences.notificationsEnabled
                ? 'bg-amber-400 text-gray-900'
                : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            {user?.preferences.notificationsEnabled ? t('common.enabled') : t('common.disabled')}
          </button>
        </div>

        <div className="card-lift bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl transition-colors">
          <div className="font-medium text-gray-700 dark:text-gray-300 mb-3">{t('profile.exportData')}</div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" className="w-full" onClick={handleExportJSON}>
              JSON
            </Button>
            <Button variant="secondary" className="w-full" onClick={handleExportCSV}>
              CSV
            </Button>
          </div>
        </div>
      </div>

      <Button variant="danger" className="w-full mt-10 rounded-2xl" onClick={logout}>
        {t('common.signOut')}
      </Button>
      <p className="mt-4 text-center text-xs text-gray-400 dark:text-gray-500">v{__APP_VERSION__}</p>
    </div>
  );
};

export default ProfileSettingsView;
