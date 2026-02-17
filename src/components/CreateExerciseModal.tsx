import React, { useEffect, useState } from 'react';
import { Camera, Check } from 'lucide-react';
import CategoryPicker from '@/components/CategoryPicker';
import SetNumberInput from '@/components/SetNumberInput';
import { Button, Input, Modal } from '@/components/ui';
import { getDefaultBarbellWeight } from '@/constants';
import type { Unit } from '@/types';

export type CreateExerciseInput = {
  name: string;
  description: string;
  category: string;
  usesBarbell: boolean;
  barbellWeight: number;
  mediaFile: File | null;
};

type CreateExerciseModalLabels = {
  title: string;
  name: string;
  description: string;
  barbell: string;
  usesBarbell: string;
  addMedia: string;
  processing: string;
  save: string;
};

type CreateExerciseModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (payload: CreateExerciseInput) => Promise<void>;
  unit: Unit;
  currentUnit: string;
  labels: CreateExerciseModalLabels;
};

const CreateExerciseModal: React.FC<CreateExerciseModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  unit,
  currentUnit,
  labels,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Other');
  const [usesBarbell, setUsesBarbell] = useState(false);
  const [barbellWeight, setBarbellWeight] = useState(0);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setCategory('Other');
    setUsesBarbell(false);
    setBarbellWeight(getDefaultBarbellWeight(unit));
  }, [isOpen, unit]);

  const resetState = () => {
    setName('');
    setDescription('');
    setCategory('Other');
    setUsesBarbell(false);
    setBarbellWeight(getDefaultBarbellWeight(unit));
    setMediaFile(null);
  };

  const handleCreate = async () => {
    const trimmedName = name.trim();
    if (!trimmedName || isProcessing) return;
    setIsProcessing(true);
    try {
      await onCreate({
        name: trimmedName,
        description,
        category: category || 'Other',
        usesBarbell,
        barbellWeight,
        mediaFile,
      });
      resetState();
      onClose();
    } finally {
      setIsProcessing(false);
    }
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
      <div className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl p-6 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 mb-4 cursor-pointer relative bg-gray-50 dark:bg-gray-800">
        <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*,video/*" onChange={e => setMediaFile(e.target.files?.[0] || null)} />
        <Camera size={24} className="mb-2" />
        <span className="text-xs">{mediaFile ? mediaFile.name : labels.addMedia}</span>
      </div>
      <Button onClick={handleCreate} disabled={isProcessing} className="w-full">
        {isProcessing ? labels.processing : labels.save}
      </Button>
    </Modal>
  );
};

export default CreateExerciseModal;
