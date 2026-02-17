import React, { useEffect, useState } from 'react';
import { Button, Modal } from '@/components/ui';
import { useI18n } from '@/i18n/useI18n';

const isStandaloneMode = () => {
  if (typeof window === 'undefined') return true;
  const mm = window.matchMedia?.('(display-mode: standalone)');
  const standalone = (mm && mm.matches) || (navigator as any).standalone;
  return !!standalone;
};

const isIOSDevice = () => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const iOS = /iPad|iPhone|iPod/i.test(ua);
  const iPadOS = ua.includes('Mac') && typeof document !== 'undefined' && 'ontouchend' in document;
  return iOS || iPadOS;
};

const InstallHint: React.FC = () => {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    try {
      if (localStorage.getItem('ironlog_install_hint_dismissed_v1') === '1') return;
    } catch {
      // ignore
    }

    if (isStandaloneMode()) return;

    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isMobile = /iPhone|iPad|iPod|Android/i.test(ua);
    if (!isMobile) return;

    const t = window.setTimeout(() => setOpen(true), 900);
    return () => window.clearTimeout(t);
  }, []);

  const dismiss = (dontShowAgain: boolean) => {
    if (dontShowAgain) {
      try {
        localStorage.setItem('ironlog_install_hint_dismissed_v1', '1');
      } catch {
        // ignore
      }
    }
    setOpen(false);
  };

  return (
    <Modal
      isOpen={open}
      onClose={() => dismiss(true)}
      title={t('installHint.title')}
      panelClassName="max-w-sm w-[92%]"
      contentClassName="p-6"
    >
      <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
        {t('installHint.description')}
      </p>

      {isIOSDevice() ? (
        <ol className="mt-4 space-y-2 text-sm text-gray-800 dark:text-gray-200 list-decimal list-inside">
          <li>{t('installHint.iosStep1')}</li>
          <li>{t('installHint.iosStep2')}</li>
          <li>{t('installHint.iosStep3')}</li>
        </ol>
      ) : (
        <ol className="mt-4 space-y-2 text-sm text-gray-800 dark:text-gray-200 list-decimal list-inside">
          <li>{t('installHint.androidStep1')}</li>
          <li>{t('installHint.androidStep2')}</li>
        </ol>
      )}

      <div className="mt-6 flex gap-3">
        <Button
          onClick={() => dismiss(false)}
          className="flex-1"
        >
          {t('installHint.notNow')}
        </Button>
        <Button
          variant="secondary"
          onClick={() => dismiss(true)}
          className="flex-1"
        >
          {t('installHint.dontShowAgain')}
        </Button>
      </div>
    </Modal>
  );
};

export default InstallHint;
