import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useLongPress } from '@/components/ui';
import { normalizeCategory } from '@/constants';
import type { ExerciseDef } from '@/types';

interface ExercisePickerRowProps {
  def: ExerciseDef;
  isUsed: boolean;
  onAdd: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const ExercisePickerRow: React.FC<ExercisePickerRowProps> = ({ def, isUsed, onAdd, onEdit, onDelete }) => {
  const longPress = useLongPress(onEdit, onAdd);
  const stop = (e: React.PointerEvent) => e.stopPropagation();

  return (
    <div
      {...longPress}
      className="p-4 bg-gray-50 dark:bg-gray-800/80 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-2xl flex justify-between items-center cursor-pointer transition-colors select-none border border-transparent dark:border-gray-700/70"
    >
      <div className="flex flex-col">
        <span className="font-bold text-gray-700 dark:text-gray-100">{def.name}</span>
        <span className="text-xs text-gray-400 dark:text-gray-500">{normalizeCategory(def.category)}</span>
      </div>
      <div className="flex items-center gap-2">
        <Plus size={18} className="text-gray-400 dark:text-gray-500" />
        <button
          onPointerDown={stop}
          onPointerUp={stop}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-95 ${
            isUsed
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
