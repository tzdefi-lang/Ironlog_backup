import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useLongPress } from '@/components/ui';
import { normalizeCategory } from '@/constants';
import { useI18n } from '@/i18n/useI18n';
import type { ExerciseDef } from '@/types';

interface ExercisePickerRowProps {
  def: ExerciseDef;
  isUsed: boolean;
  onAdd: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const ExercisePickerRow: React.FC<ExercisePickerRowProps> = ({ def, isUsed, onAdd, onEdit, onDelete }) => {
  const { t } = useI18n();
  const longPress = useLongPress(def.readOnly ? () => {} : onEdit, onAdd);
  const stop = (e: React.PointerEvent) => e.stopPropagation();
  const cannotDelete = isUsed || def.readOnly;

  return (
    <div
      {...longPress}
      className="p-4 bg-gray-50 dark:bg-gray-800/80 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-2xl flex justify-between items-center cursor-pointer transition-colors select-none border border-transparent dark:border-gray-700/70"
    >
      <div className="flex flex-col">
        <span className="font-bold text-gray-700 dark:text-gray-100">{def.name}</span>
        <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-2">
          {normalizeCategory(def.category)}
          {def.source === 'official' && (
            <span className="inline-flex rounded-full bg-brand-tint-strong text-brand border border-brand px-2 py-0.5 font-semibold">
              {t('common.official')}
            </span>
          )}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Plus size={18} className="text-gray-400 dark:text-gray-500" />
        <button
          onPointerDown={stop}
          onPointerUp={stop}
          onClick={(e) => {
            e.stopPropagation();
            if (cannotDelete) return;
            onDelete();
          }}
          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-95 ${
            cannotDelete
              ? 'bg-gray-100 dark:bg-gray-700 text-gray-300 dark:text-gray-500 cursor-not-allowed'
              : 'bg-red-50 dark:bg-red-950/45 text-red-500 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/45'
          }`}
          aria-label="Delete exercise"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
};

export default React.memo(ExercisePickerRow);
