import React, { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import CategoryPicker from '@/components/CategoryPicker';
import SetNumberInput from '@/components/SetNumberInput';
import { Button, Input, Modal } from '@/components/ui';
import { getDefaultBarbellWeight, normalizeCategory } from '@/constants';
import type { ExerciseDef, Unit } from '@/types';

export type EditExerciseInput = {
  id: string;
  name: string;
  description: string;
  category: string;
  usesBarbell: boolean;
  barbellWeight: number;
};

type EditExerciseModalLabels = {
  title: string;
  name: string;
  description: string;
  barbell: string;
  usesBarbell: string;
  saveChanges: string;
};

type EditExerciseModalProps = {
  isOpen: boolean;
  onClose: () => void;
  exerciseDef: ExerciseDef | null;
  onSave: (payload: EditExerciseInput) => Promise<void>;
  unit: Unit;
  currentUnit: string;
  labels: EditExerciseModalLabels;
};

const EditExerciseModal: React.FC<EditExerciseModalProps> = ({
  isOpen,
  onClose,
  exerciseDef,
  onSave,
  unit,
  currentUnit,
  labels,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Other');
  const [usesBarbell, setUsesBarbell] = useState(false);
  const [barbellWeight, setBarbellWeight] = useState(0);

  useEffect(() => {
    if (!isOpen || !exerciseDef) return;
    setName(exerciseDef.name);
    setDescription(exerciseDef.description || '');
    setCategory(normalizeCategory(exerciseDef.category));
    setUsesBarbell(!!exerciseDef.usesBarbell);
    setBarbellWeight(exerciseDef.barbellWeight ?? getDefaultBarbellWeight(unit));
  }, [exerciseDef, isOpen, unit]);

  const handleSave = async () => {
    if (!exerciseDef) return;
    await onSave({
      id: exerciseDef.id,
      name,
      description,
      category: category || 'Other',
      usesBarbell,
      barbellWeight,
    });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={labels.title}>
      <Input placeholder={labels.name} value={name} onChange={e => setName(e.target.value)} />
      <Input placeholder={labels.description} value={description} onChange={e => setDescription(e.target.value)} />
      <CategoryPicker value={category} onChange={setCategory} />
      <div className="mb-4">
        <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{labels.barbell}</div>
        <button
          type="button"
          onClick={() => {
            setUsesBarbell(prev => {
              const next = !prev;
              if (next && (!barbellWeight || barbellWeight <= 0)) {
                setBarbellWeight(getDefaultBarbellWeight(unit));
              }
              return next;
            });
          }}
          className="w-full flex items-center gap-3 bg-gray-50 dark:bg-gray-800 rounded-2xl px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <span className={`w-5 h-5 rounded-md flex items-center justify-center border ${usesBarbell ? 'bg-amber-400 border-amber-400 text-gray-900' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-transparent'}`}>
            <Check size={14} />
          </span>
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{labels.usesBarbell}</span>
        </button>
        {usesBarbell && (
          <div className="mt-3 bg-gray-50 dark:bg-gray-800 rounded-2xl px-4 py-3 flex items-center gap-2">
            <SetNumberInput
              value={barbellWeight}
              inputMode="decimal"
              onValueChange={(v) => setBarbellWeight(v)}
              className="flex-1 min-w-0 bg-transparent outline-none font-bold text-gray-900 dark:text-gray-100 text-center tabular-nums"
            />
            <span className="text-xs text-gray-400 dark:text-gray-500 font-medium shrink-0">{currentUnit}</span>
          </div>
        )}
      </div>
      <Button onClick={handleSave} className="w-full">{labels.saveChanges}</Button>
    </Modal>
  );
};

export default EditExerciseModal;
