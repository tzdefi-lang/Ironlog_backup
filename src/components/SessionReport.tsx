import React from 'react';
import { Check } from 'lucide-react';
import { Button, Modal } from '@/components/ui';
import { useI18n } from '@/i18n/useI18n';
import type { PRBreak } from '@/services/pr';

interface SessionReportProps {
  isOpen: boolean;
  currentUnit: string;
  animMinutes: number;
  animCompletion: number;
  animVolume: number;
  prBreaks: PRBreak[];
  onShare: () => void;
  onClose: () => void;
}

const SessionReport: React.FC<SessionReportProps> = ({
  isOpen,
  currentUnit,
  animMinutes,
  animCompletion,
  animVolume,
  prBreaks,
  onShare,
  onClose,
}) => {
  const { t } = useI18n();
  const metricLabel: Record<PRBreak['metric'], string> = {
    maxWeight: t('sessionReport.metricMaxWeight'),
    maxVolume: t('sessionReport.metricMaxVolume'),
    estimated1RM: t('sessionReport.metricEstimated1rm'),
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('sessionReport.title')}
      overlayClassName="bg-gradient-to-b from-white/90 dark:from-black/70 via-black/25 to-black/40 backdrop-blur-md"
      panelClassName="max-w-sm w-[92%] max-h-[78vh]"
      contentClassName="p-5"
    >
      <div className="flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-full bg-brand-tint border border-brand flex items-center justify-center text-brand mb-3 ring-8 ring-brand">
          <Check size={34} strokeWidth={4} />
        </div>
        <h2 className="text-2xl font-black text-gray-900 dark:text-gray-100 mb-1">{t('sessionReport.completeTitle')}</h2>
        <p className="text-gray-400 dark:text-gray-500 text-sm mb-5">{t('sessionReport.completeSubtitle')}</p>

        <div className="w-full grid grid-cols-2 gap-3 mb-5">
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-3xl score-pop transition-colors">
            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest">{t('sessionReport.duration')}</p>
            <p className="text-4xl font-black text-gray-900 dark:text-gray-100 mt-2 leading-none">
              {animMinutes}
              <span className="text-sm font-extrabold text-gray-400 dark:text-gray-500 ml-2">{t('sessionReport.minutes')}</span>
            </p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-3xl score-pop transition-colors">
            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest">{t('sessionReport.completion')}</p>
            <p className="text-4xl font-black text-gray-900 dark:text-gray-100 mt-2 leading-none">{animCompletion}%</p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-3xl score-pop col-span-2 transition-colors">
            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest">{t('sessionReport.totalVolume')}</p>
            <p className="text-4xl font-black text-gray-900 dark:text-gray-100 mt-2 leading-none">
              {animVolume}
              <span className="text-sm font-extrabold text-gray-400 dark:text-gray-500 ml-2">{currentUnit}</span>
            </p>
          </div>
        </div>

        {prBreaks.length > 0 && (
          <div className="w-full mb-5 rounded-3xl bg-emerald-50 p-4">
            <p className="text-[10px] text-emerald-700 font-bold uppercase tracking-widest mb-2">
              {t('sessionReport.newPrs')}
            </p>
            <div className="space-y-1 max-h-28 overflow-y-auto">
              {prBreaks.map((pr) => (
                <div key={`${pr.exerciseDefId}-${pr.metric}`} className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-emerald-800">
                    {pr.exerciseName} • {metricLabel[pr.metric]}
                  </span>
                  <span className="font-black text-emerald-700">{Math.round(pr.current * 10) / 10}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <Button onClick={onShare} className="w-full">
          {t('sessionReport.share')}
        </Button>
        <button
          onClick={onClose}
          className="mt-3 text-sm font-semibold text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          {t('sessionReport.backHome')}
        </button>
      </div>
    </Modal>
  );
};

export default SessionReport;
