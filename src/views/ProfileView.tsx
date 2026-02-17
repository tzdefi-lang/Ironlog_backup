import React from 'react';
import { ChevronRight, History, Settings2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ScreenShell, SurfaceCard } from '@/components/botanical-ui';
import { useGym } from '@/hooks/useGym';
import { useI18n } from '@/i18n/useI18n';

const ProfileView: React.FC = () => {
  const { user } = useGym();
  const navigate = useNavigate();
  const { t } = useI18n();
  const primaryAddress = user?.email || user?.walletAddress || user?.solanaAddress || '';

  return (
    <ScreenShell title={t('profile.title')} contentClassName="pb-[calc(8.9rem+env(safe-area-inset-bottom))]">
      <SurfaceCard tone="muted" archTop className="p-6 mb-8">
        <div className="flex flex-col items-center">
          <div className="p-1 rounded-full border-2 border-amber-400 mb-4">
            <img
              src={user?.photoUrl}
              alt="Profile"
              className="w-24 h-24 rounded-full border-4 border-[var(--surface-card)]"
            />
          </div>
          <h2 className="text-3xl font-semibold text-gray-900 dark:text-gray-100 display-serif text-center">
            {user?.name}
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{primaryAddress}</p>
        </div>
      </SurfaceCard>

      <div className="space-y-3 list-stagger">
        <SurfaceCard
          interactive
          className="card-lift p-4 flex justify-between items-center w-full text-left"
          tone="paper"
        >
          <button type="button" onClick={() => navigate('/history')} className="w-full flex justify-between items-center text-left">
            <span className="flex items-center gap-3">
              <History size={20} className="text-gray-500 dark:text-gray-400" />
              <span className="font-medium text-gray-700 dark:text-gray-300">{t('history.title')}</span>
            </span>
            <ChevronRight size={18} className="text-gray-400 dark:text-gray-500" />
          </button>
        </SurfaceCard>

        <SurfaceCard
          interactive
          className="card-lift p-4 flex justify-between items-center w-full text-left"
          tone="paper"
        >
          <button type="button" onClick={() => navigate('/profile/settings')} className="w-full flex justify-between items-center text-left">
            <span className="flex items-center gap-3">
              <Settings2 size={20} className="text-gray-500 dark:text-gray-400" />
              <span>
                <span className="block font-medium text-gray-700 dark:text-gray-300">{t('profile.settings')}</span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">{t('profile.settingsHint')}</span>
              </span>
            </span>
            <ChevronRight size={18} className="text-gray-400 dark:text-gray-500" />
          </button>
        </SurfaceCard>

        {user?.walletAddress && (
          <SurfaceCard tone="muted" className="card-lift p-4 flex justify-between items-center">
            <span className="font-medium text-gray-700 dark:text-gray-300">{t('profile.evmWallet')}</span>
            <span className="text-sm text-gray-500 dark:text-gray-400 font-mono">
              {user.walletAddress.slice(0, 6)}...{user.walletAddress.slice(-4)}
            </span>
          </SurfaceCard>
        )}

        {user?.solanaAddress && (
          <SurfaceCard tone="muted" className="card-lift p-4 flex justify-between items-center">
            <span className="font-medium text-gray-700 dark:text-gray-300">{t('profile.solanaWallet')}</span>
            <span className="text-sm text-gray-500 dark:text-gray-400 font-mono">
              {user.solanaAddress.slice(0, 4)}...{user.solanaAddress.slice(-4)}
            </span>
          </SurfaceCard>
        )}
      </div>
    </ScreenShell>
  );
};

export default ProfileView;
