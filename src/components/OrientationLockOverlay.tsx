import React, { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import Portal from '@/components/Portal';
import { useI18n } from '@/i18n/useI18n';

const OrientationLockOverlay: React.FC = () => {
  const [isLandscape, setIsLandscape] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const orientationQuery = window.matchMedia('(orientation: landscape)');
    const mobileLikeQuery = window.matchMedia('(max-width: 900px) and (pointer: coarse)');
    const update = () => {
      setIsLandscape(orientationQuery.matches && mobileLikeQuery.matches);
    };

    update();

    if (typeof orientationQuery.addEventListener === 'function') {
      orientationQuery.addEventListener('change', update);
      mobileLikeQuery.addEventListener('change', update);
      return () => {
        orientationQuery.removeEventListener('change', update);
        mobileLikeQuery.removeEventListener('change', update);
      };
    }

    orientationQuery.addListener(update);
    mobileLikeQuery.addListener(update);
    return () => {
      orientationQuery.removeListener(update);
      mobileLikeQuery.removeListener(update);
    };
  }, []);

  if (!isLandscape) return null;

  return (
    <Portal>
      <div className="fixed inset-0 z-[2000] bg-white dark:bg-gray-950 flex items-center justify-center p-10 text-center transition-colors">
        <div className="max-w-xs">
          <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <RotateCcw className="text-gray-900 dark:text-gray-100" size={28} />
          </div>
          <div className="text-xl font-extrabold text-gray-900 dark:text-gray-100">{t('orientation.title')}</div>
          <div className="mt-2 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            {t('orientation.description')}
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default OrientationLockOverlay;
