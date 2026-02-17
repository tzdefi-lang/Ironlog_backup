import React, { useEffect, useMemo, useState } from 'react';
import ExercisePickerRow from '@/components/ExercisePickerRow';
import { Button, Modal } from '@/components/ui';
import { BODY_PART_OPTIONS, normalizeCategory } from '@/constants';
import type { ExerciseDef, Workout } from '@/types';

type ExercisePickerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (defId: string) => void;
  onEdit: (def: ExerciseDef) => void;
  onDelete: (def: ExerciseDef, isUsed: boolean) => void | Promise<void>;
  onCreateNew: () => void;
  exerciseDefs: ExerciseDef[];
  workouts: Workout[];
  title: string;
  hint: string;
  noExercisesInLabel: string;
  createNewLabel: string;
};

const ExercisePickerModal: React.FC<ExercisePickerModalProps> = ({
  isOpen,
  onClose,
  onAdd,
  onEdit,
  onDelete,
  onCreateNew,
  exerciseDefs,
  workouts,
  title,
  hint,
  noExercisesInLabel,
  createNewLabel,
}) => {
  const [exPickerCategory, setExPickerCategory] = useState<string>('Other');

  const exDefsByCategory = useMemo<Record<string, ExerciseDef[]>>(() => {
    const map: Record<string, ExerciseDef[]> = {};
    for (const cat of BODY_PART_OPTIONS) map[cat] = [];
    for (const def of exerciseDefs) {
      const cat = normalizeCategory(def.category);
      map[cat] = map[cat] || [];
      map[cat].push(def);
    }
    for (const cat of Object.keys(map)) {
      map[cat].sort((a, b) => a.name.localeCompare(b.name));
    }
    return map;
  }, [exerciseDefs]);

  const filteredExerciseDefs = useMemo(() => {
    return (exDefsByCategory[exPickerCategory] || []).slice();
  }, [exDefsByCategory, exPickerCategory]);

  useEffect(() => {
    if (!isOpen) return;
    const currentCount = (exDefsByCategory[exPickerCategory] || []).length;
    if (currentCount > 0) return;
    const first =
      BODY_PART_OPTIONS.find(cat => (exDefsByCategory[cat] || []).length > 0) || 'Other';
    if (first !== exPickerCategory) setExPickerCategory(first);
  }, [isOpen, exDefsByCategory, exPickerCategory]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      panelClassName="exercise-picker-modal-panel"
      overlayClassName="exercise-picker-modal-overlay bg-gradient-to-t from-black/35 via-black/18 to-black/6 backdrop-blur-sm"
    >
      <p className="text-xs text-gray-400 mb-3">{hint}</p>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-1 px-1">
        {BODY_PART_OPTIONS.map((cat) => {
          const count = (exDefsByCategory[cat] || []).length;
          const active = cat === exPickerCategory;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setExPickerCategory(cat)}
              className={`shrink-0 px-3 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center gap-2 ${
                active ? 'bg-amber-400 text-gray-900' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <span>{cat}</span>
              {count > 0 && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${active ? 'bg-black/15' : 'bg-black/10'}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="space-y-2">
        {filteredExerciseDefs.length === 0 ? (
          <div className="text-center py-10 text-gray-300 dark:text-gray-500 border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-3xl">
            {noExercisesInLabel} {exPickerCategory}.
          </div>
        ) : (
          filteredExerciseDefs.map(def => {
            const isUsed = workouts.some(w => w.exercises.some(ex => ex.defId === def.id));
            return (
              <ExercisePickerRow
                key={def.id}
                def={def}
                isUsed={isUsed}
                onAdd={() => onAdd(def.id)}
                onEdit={() => onEdit(def)}
                onDelete={() => onDelete(def, isUsed)}
              />
            );
          })
        )}
        <Button className="w-full mt-4" onClick={onCreateNew}>
          {createNewLabel}
        </Button>
      </div>
    </Modal>
  );
};

export default ExercisePickerModal;
