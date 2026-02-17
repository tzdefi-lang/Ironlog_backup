import React from 'react';
import { Copy, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { useI18n } from '@/i18n/useI18n';

interface ActionMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onCopy: () => void;
  onDelete: () => void;
  title?: string;
}

const ActionMenu: React.FC<ActionMenuProps> = ({
  isOpen,
  onClose,
  onCopy,
  onDelete,
  title,
}) => {
  const { t } = useI18n();
  const resolvedTitle = title || t('actionMenu.title');

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col justify-end bg-gradient-to-t from-black/35 via-black/20 to-black/6 backdrop-blur-sm action-sheet-overlay"
      onClick={onClose}
    >
      <div
        className="bg-[var(--surface-card)] dark:bg-[var(--surface-card)] rounded-t-[40px] p-6 pb-[calc(8rem+env(safe-area-inset-bottom))] max-h-[92vh] overflow-y-auto action-sheet-panel transition-colors border border-[var(--surface-border)] border-b-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mb-6" />
        <h3 className="font-semibold text-2xl text-gray-900 dark:text-gray-100 mb-6 text-center display-serif">{resolvedTitle}</h3>
        <div className="space-y-3">
          <Button
            onClick={() => {
              onCopy();
              onClose();
            }}
            className="w-full bg-amber-100/80 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 shadow-none hover:bg-amber-200/85 dark:hover:bg-amber-900/40 justify-start"
          >
            <Copy size={20} /> {t('actionMenu.scheduleCopy')}
          </Button>
          <Button
            onClick={() => {
              onDelete();
              onClose();
            }}
            variant="danger"
            className="w-full justify-start bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-300 shadow-none hover:bg-red-100 dark:hover:bg-red-900/40"
          >
            <Trash2 size={20} /> {t('actionMenu.deleteWorkout')}
          </Button>
          <div className="h-4" />
          <Button onClick={onClose} variant="secondary" className="w-full">
            {t('actionMenu.cancel')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ActionMenu;
