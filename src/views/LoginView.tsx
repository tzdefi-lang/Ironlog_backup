import React from 'react';
import { User } from 'lucide-react';
import { SurfaceCard } from '@/components/botanical-ui';
import { useGym } from '@/hooks/useGym';
import { useI18n } from '@/i18n/useI18n';

const LoginView: React.FC = () => {
  const { login, isLoading, authError } = useGym();
  const { t } = useI18n();

  if (isLoading) {
    return (
      <div className="h-full bg-[var(--surface-card)] px-8 pt-8 pb-[calc(1.5rem+env(safe-area-inset-bottom))] animate-pulse transition-colors">
        <div className="h-full flex flex-col justify-between gap-8">
          <div className="pt-8 space-y-3">
            <div className="h-10 rounded-2xl bg-[var(--surface-muted)]" />
            <div className="h-10 rounded-2xl bg-[var(--surface-muted)]" />
            <div className="h-10 rounded-2xl bg-[var(--surface-muted)]" />
          </div>
          <div className="space-y-4">
            <div className="h-16 rounded-2xl bg-[var(--surface-muted)]" />
            <div className="h-14 rounded-2xl bg-[var(--surface-muted)]" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[var(--surface-card)] px-8 pt-8 pb-[calc(1.5rem+env(safe-area-inset-bottom))] view-enter transition-colors">
      <div className="flex-1 flex flex-col justify-center min-h-0">
        <div className="pt-4">
          <h1 className="text-5xl font-semibold text-center leading-tight tracking-tight text-gray-900 dark:text-gray-100 display-serif">
            {t('login.headlineLine1')}
            <br />
            {t('login.headlineLine2')}
            <br />
            {t('login.headlineLine3')}
          </h1>
        </div>
      </div>

      <div className="flex flex-col items-center w-full gap-6 shrink-0">
        <SurfaceCard tone="muted" className="w-full p-6 flex flex-col items-center">
          <div className="flex gap-2 justify-center mb-6">
            <div className="flex items-center text-amber-400">
              <User size={32} />
              <User size={32} className="-ml-2 opacity-60" />
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center leading-relaxed max-w-xs mx-auto">
            {t('login.description')}
          </p>
          {authError && (
            <div className="mt-4 w-full max-w-xs rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-600 text-center">
              {authError}
            </div>
          )}
        </SurfaceCard>

        <button
          onClick={login}
          className="pressable w-full bg-red-500 text-white py-4 rounded-2xl font-semibold text-lg shadow-[var(--surface-shadow-strong)] active:scale-[0.98] transition-all hover:bg-red-600"
        >
          {t('login.signIn')}
        </button>
      </div>
    </div>
  );
};

export default LoginView;
