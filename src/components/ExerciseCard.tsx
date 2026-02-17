import React from 'react';
import { Check, ChevronDown, ChevronUp, GripVertical, Trash2, X } from 'lucide-react';
import { MediaResolver, useLongPress } from '@/components/ui';
import { getDefaultBarbellWeight, normalizeCategory } from '@/constants';
import SetNumberInput from '@/components/SetNumberInput';
import type { ExercisePR } from '@/services/pr';
import type { ExerciseDef, ExerciseInstance, Set, Unit } from '@/types';

export type ExerciseCardProps = {
  ex: ExerciseInstance;
  def: ExerciseDef;
  index: number;
  total: number;
  currentUnit: string;
  unit: Unit;
  historicalPR?: ExercisePR;
  isDragging: boolean;
  style?: React.CSSProperties;
  outerRef?: (el: HTMLDivElement | null) => void;
  onOpenEdit: () => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onHandlePointerDown: (e: React.PointerEvent) => void;
  onHandlePointerMove: (e: React.PointerEvent) => void;
  onHandlePointerUp: (e: React.PointerEvent) => void;
  onHandlePointerCancel: (e: React.PointerEvent) => void;
  onUpdateSet: (setId: string, field: keyof Set, value: any) => void;
  onDeleteSet: (setId: string) => void;
  onAddSet: () => void;
};

const ExerciseCard: React.FC<ExerciseCardProps> = ({
  ex,
  def,
  index,
  total,
  currentUnit,
  unit,
  historicalPR,
  isDragging,
  style,
  outerRef,
  onOpenEdit,
  onRemove,
  onMoveUp,
  onMoveDown,
  onHandlePointerDown,
  onHandlePointerMove,
  onHandlePointerUp,
  onHandlePointerCancel,
  onUpdateSet,
  onDeleteSet,
  onAddSet,
}) => {
  const nameLongPress = useLongPress(onOpenEdit, () => {});

  const categoryLabel = normalizeCategory(def.category);
  const usesBarbell = !!def.usesBarbell;
  const barbellWeight = usesBarbell ? (def.barbellWeight ?? getDefaultBarbellWeight(unit)) : 0;
  const hasHistoricalPR =
    (historicalPR?.maxWeight ?? 0) > 0 || (historicalPR?.maxEstimated1RM ?? 0) > 0;

  return (
    <div
      ref={outerRef}
      style={style}
      className={`bg-[var(--surface-card)] dark:bg-[var(--surface-card)] border border-[var(--surface-border)] rounded-3xl p-5 shadow-[var(--surface-shadow)] will-change-transform ${
        isDragging ? 'ring-2 ring-amber-300 shadow-[var(--surface-shadow-strong)]' : ''
      } ${isDragging ? 'transition-none' : 'transition-transform duration-200 ease-out'}`}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex gap-4">
          {(def.mediaId || def.mediaUrl) && (
            <div className="w-14 h-14 rounded-xl bg-[var(--surface-muted)] overflow-hidden relative">
              <MediaResolver
                mediaId={def.mediaId}
                mediaUrl={def.mediaUrl}
                type={def.mediaType}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div>
            <h4 {...nameLongPress} className="font-semibold text-xl text-gray-900 dark:text-gray-100 select-none cursor-pointer display-serif">
              {def.name}
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {ex.sets.length} Sets • {categoryLabel}
              {usesBarbell ? ' • Barbell' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {total > 1 && (
            <div className="flex flex-col items-center gap-1 text-gray-300 dark:text-gray-600">
              <button
                onClick={onMoveUp}
                disabled={index === 0}
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors active:scale-95 ${
                  index === 0 ? 'bg-[var(--surface-muted)] text-gray-300' : 'bg-[var(--surface-muted)] hover:bg-[var(--surface-border)] text-gray-500'
                }`}
                aria-label="Move exercise up"
              >
                <ChevronUp size={14} />
              </button>

              <div
                onPointerDown={onHandlePointerDown}
                onPointerMove={onHandlePointerMove}
                onPointerUp={onHandlePointerUp}
                onPointerCancel={onHandlePointerCancel}
                className="w-7 h-7 rounded-lg bg-[var(--surface-muted)] text-gray-500 flex items-center justify-center cursor-grab active:cursor-grabbing active:scale-95 transition-transform"
                style={{ touchAction: 'none' }}
                aria-label="Hold to reorder"
              >
                <GripVertical size={14} className="pointer-events-none" />
              </div>

              <button
                onClick={onMoveDown}
                disabled={index === total - 1}
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors active:scale-95 ${
                  index === total - 1
                    ? 'bg-[var(--surface-muted)] text-gray-300'
                    : 'bg-[var(--surface-muted)] hover:bg-[var(--surface-border)] text-gray-500'
                }`}
                aria-label="Move exercise down"
              >
                <ChevronDown size={14} />
              </button>
            </div>
          )}

          <button onClick={onRemove} className="text-gray-300 dark:text-gray-600 hover:text-red-400">
            <X size={20} />
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {ex.sets.map((set, idx) => {
          const oneRm = set.weight * (1 + set.reps / 30);
          const isWeightPR = hasHistoricalPR && set.weight > (historicalPR?.maxWeight ?? 0);
          const isOneRmPR = hasHistoricalPR && oneRm > (historicalPR?.maxEstimated1RM ?? 0);
          const showBadge = isWeightPR || isOneRmPR;

          return (
            <div key={set.id} className="flex items-center gap-2">
              <div className="w-6 text-center text-xs font-bold text-gray-300 dark:text-gray-600">{idx + 1}</div>

              <div className="flex-1 min-w-[120px] bg-[var(--surface-muted)] rounded-xl px-2 py-2 flex items-center gap-2">
                <SetNumberInput
                  value={set.weight}
                  inputMode="decimal"
                  onValueChange={(v) => onUpdateSet(set.id, 'weight', v)}
                  className="flex-1 min-w-0 bg-transparent outline-none font-bold text-gray-900 dark:text-gray-100 text-center tabular-nums"
                />
                <span className="text-xs text-gray-400 dark:text-gray-500 font-medium shrink-0">{currentUnit}</span>
              </div>

              <div className="flex-1 min-w-[104px] bg-[var(--surface-muted)] rounded-xl px-2 py-2 flex items-center gap-2">
                <SetNumberInput
                  value={set.reps}
                  inputMode="numeric"
                  onValueChange={(v) => onUpdateSet(set.id, 'reps', v)}
                  className="flex-1 min-w-0 bg-transparent outline-none font-bold text-gray-900 dark:text-gray-100 text-center tabular-nums"
                />
                <span className="text-xs text-gray-400 dark:text-gray-500 font-medium shrink-0">REPS</span>
              </div>

              {showBadge && (
                <span className="px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700 text-[10px] font-black whitespace-nowrap">
                  {isWeightPR && isOneRmPR ? 'PR x2' : 'PR'}
                </span>
              )}

              <button
                onClick={() => onUpdateSet(set.id, 'completed', !set.completed)}
                aria-label="Complete set"
                data-testid={`set-complete-${ex.id}-${set.id}`}
                className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                  set.completed
                    ? 'bg-amber-400 text-white shadow-[var(--surface-shadow)] growth-mark'
                    : 'bg-[var(--surface-muted)] text-gray-400'
                }`}
              >
                <Check size={14} />
              </button>

              <button
                onClick={() => onDeleteSet(set.id)}
                className="w-8 h-8 rounded-xl flex items-center justify-center bg-[var(--surface-muted)] text-gray-400 hover:text-red-400 transition-all active:scale-95"
                aria-label="Delete set"
              >
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
      </div>

      {usesBarbell && (
        <div className="mt-2 text-[11px] text-gray-400 dark:text-gray-500 leading-snug">
          Log one side of plates only. Barbell weight ({barbellWeight} {currentUnit}) is added automatically.
        </div>
      )}

      <button
        onClick={onAddSet}
        className="w-full mt-3 py-2 text-sm font-semibold text-amber-700 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-900/20 rounded-xl hover:bg-amber-200/80 dark:hover:bg-amber-900/30 transition-colors"
      >
        + Add Set
      </button>
    </div>
  );
};

export default ExerciseCard;
