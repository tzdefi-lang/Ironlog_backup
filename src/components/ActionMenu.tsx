import React from 'react';
import { Copy, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { useI18n } from '@/i18n/useI18n';
import BottomSheet from '@/components/BottomSheet';

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

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={resolvedTitle}>
      <div className="space-y-3">
        <Button
          onClick={() => {
            onCopy();
            onClose();
          }}
          className="w-full bg-brand-tint text-brand shadow-none hover:brightness-95 justify-start"
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
        <div className="h-2" />
        <Button onClick={onClose} variant="secondary" className="w-full">
          {t('actionMenu.cancel')}
        </Button>
      </div>
    </BottomSheet>
  );
};

export default ActionMenu;
