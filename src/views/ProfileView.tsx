import React from 'react';
import { ChevronRight, History, Settings2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useGym } from '@/hooks/useGym';
import { useI18n } from '@/i18n/useI18n';

const ProfileView: React.FC = () => {
  const { user } = useGym();
  const navigate = useNavigate();
  const { t } = useI18n();

  return (
    <div className="h-full bg-[var(--app-bg)] dark:bg-[var(--app-bg)] overflow-y-auto scroll-area px-6 pt-8 pb-[calc(7.5rem+env(safe-area-inset-bottom))] view-enter transition-colors">
      <h1 className="text-4xl font-semibold text-gray-900 dark:text-gray-100 tracking-tight mb-8 display-serif">{t('profile.title')}</h1>
      <div className="flex flex-col items-center mb-10">
        <div className="p-1 rounded-full border-2 border-brand mb-4">
          <img src={user?.photoUrl} alt="Profile" className="w-24 h-24 rounded-full border-4 border-white dark:border-gray-900" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{user?.name}</h2>
        <p className="text-gray-400 dark:text-gray-500 text-sm">{user?.email || ''}</p>
      </div>

      <div className="space-y-3 list-stagger">
        <button
          type="button"
          onClick={() => navigate('/history')}
          className="pressable card-lift bg-[var(--surface-card)] dark:bg-[var(--surface-card)] p-4 rounded-3xl border border-[var(--surface-border)] flex justify-between items-center transition-colors w-full text-left active:scale-[0.98]"
        >
          <span className="flex items-center gap-3">
            <History size={20} className="text-gray-400 dark:text-gray-500" />
            <span className="font-medium text-gray-700 dark:text-gray-300">{t('history.title')}</span>
          </span>
          <ChevronRight size={18} className="text-gray-300 dark:text-gray-600" />
        </button>

        <button
          type="button"
          onClick={() => navigate('/profile/settings')}
          className="pressable card-lift bg-[var(--surface-card)] dark:bg-[var(--surface-card)] p-4 rounded-3xl border border-[var(--surface-border)] flex justify-between items-center transition-colors w-full text-left active:scale-[0.98]"
        >
          <span className="flex items-center gap-3">
            <Settings2 size={20} className="text-gray-400 dark:text-gray-500" />
            <span>
              <span className="block font-medium text-gray-700 dark:text-gray-300">{t('profile.settings')}</span>
              <span className="block text-xs text-gray-400 dark:text-gray-500">{t('profile.settingsHint')}</span>
            </span>
          </span>
          <ChevronRight size={18} className="text-gray-300 dark:text-gray-600" />
        </button>
      </div>
    </div>
  );
};

export default ProfileView;
