import React from 'react';
import { Check, GripVertical, Info, X } from 'lucide-react';
import { MediaResolver, SwipeableItem, useLongPress } from '@/components/ui';
import { getDefaultBarbellWeight, normalizeCategory } from '@/constants';
import { useI18n } from '@/i18n/useI18n';
import { inferMediaTypeFromUrl } from '@/services/mediaType';
import SetNumberInput from '@/components/SetNumberInput';
import type { ExercisePR } from '@/services/pr';
import type { ExerciseDef, ExerciseInstance, Set as WorkoutSet, Unit } from '@/types';

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
  onOpenDetail: () => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onHandlePointerDown: (e: React.PointerEvent) => void;
  onHandlePointerMove: (e: React.PointerEvent) => void;
  onHandlePointerUp: (e: React.PointerEvent) => void;
  onHandlePointerCancel: (e: React.PointerEvent) => void;
  onUpdateSet: (setId: string, field: keyof WorkoutSet, value: any) => void;
  onDeleteSet: (setId: string) => void;
  onAddSet: () => void;
};

const ExerciseCard: React.FC<ExerciseCardProps> = ({
  ex,
  def,
  total,
  currentUnit,
  unit,
  historicalPR,
  isDragging,
  style,
  outerRef,
  onOpenEdit,
  onOpenDetail,
  onRemove,
  onHandlePointerDown,
  onHandlePointerMove,
  onHandlePointerUp,
  onHandlePointerCancel,
  onUpdateSet,
  onDeleteSet,
  onAddSet,
}) => {
  const { t } = useI18n();
  const nameLongPress = useLongPress(onOpenEdit, () => {});

  const categoryLabel = normalizeCategory(def.category);
  const usesBarbell = !!def.usesBarbell;
  const barbellWeight = usesBarbell ? (def.barbellWeight ?? getDefaultBarbellWeight(unit)) : 0;
  const hasHistoricalPR =
    (historicalPR?.maxWeight ?? 0) > 0 || (historicalPR?.maxEstimated1RM ?? 0) > 0;
  const firstUpload = def.mediaItems.find((item) => item.kind === 'upload');
  const previewUrl = def.thumbnailUrl || firstUpload?.url || def.mediaUrl;
  const previewType = def.thumbnailUrl
    ? inferMediaTypeFromUrl(def.thumbnailUrl) ?? 'image'
    : firstUpload?.contentType || def.mediaType;
  const hasPreview = !!previewUrl || !!def.mediaId;
  const hasRichContent = !!(def.description?.trim() || def.markdown?.trim() || def.mediaItems.length > 0);

  const prevSetIdsRef = React.useRef<string[]>(ex.sets.map((s) => s.id));
  const [enteringSetIds, setEnteringSetIds] = React.useState<Set<string>>(new Set());
  const [poppedSetId, setPoppedSetId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const prevIds = new Set(prevSetIdsRef.current);
    const nextIds = ex.sets.map((s) => s.id);
    const added = nextIds.filter((id) => !prevIds.has(id));
    if (added.length > 0) {
      setEnteringSetIds((prev) => {
        const next = new Set(prev);
        for (const id of added) next.add(id);
        return next;
      });
      window.setTimeout(() => {
        setEnteringSetIds((prev) => {
          const next = new Set(prev);
          for (const id of added) next.delete(id);
          return next;
        });
      }, 420);
    }
    prevSetIdsRef.current = nextIds;
  }, [ex.sets]);

  return (
    <div
      ref={outerRef}
      style={style}
      className={`bg-white dark:bg-gray-900 rounded-3xl p-5 shadow-sm dark:shadow-black/20 will-change-transform ${
        isDragging ? 'ring-2 ring-brand shadow-lg shadow-brand-soft' : ''
      } ${isDragging ? 'transition-none' : 'transition-transform duration-200 ease-out'}`}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex gap-4">
          {hasPreview && (
            <button
              type="button"
              onClick={onOpenDetail}
              className="w-14 h-14 rounded-xl bg-gray-100 dark:bg-gray-800 overflow-hidden relative ring-offset-2 ring-offset-white dark:ring-offset-gray-900 focus-visible:ring-2 ring-brand"
              aria-label={`Open ${def.name} details`}
            >
              <MediaResolver
                mediaId={def.mediaId}
                mediaUrl={previewUrl}
                type={previewType}
                className="w-full h-full object-cover"
              />
            </button>
          )}
          <div>
            <h4 {...nameLongPress} className="font-bold text-lg text-gray-900 dark:text-gray-100 select-none cursor-pointer">
              {def.name}
            </h4>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {ex.sets.length} Sets • {categoryLabel}
              {usesBarbell ? ' • Barbell' : ''}
              {def.source === 'official' ? ` • ${t('common.official')}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!hasPreview && hasRichContent && (
            <button
              type="button"
              onClick={onOpenDetail}
              className="w-8 h-8 rounded-xl bg-brand-tint text-brand border border-brand flex items-center justify-center hover:brightness-95"
              aria-label="Open exercise details"
            >
              <Info size={15} />
            </button>
          )}
          {total > 1 && (
            <div
              onPointerDown={onHandlePointerDown}
              onPointerMove={onHandlePointerMove}
              onPointerUp={onHandlePointerUp}
              onPointerCancel={onHandlePointerCancel}
              className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 flex items-center justify-center cursor-grab active:cursor-grabbing active:scale-95 transition-transform"
              style={{ touchAction: 'none' }}
              aria-label="Hold to reorder"
            >
              <GripVertical size={16} className="pointer-events-none" />
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
          const isEntering = enteringSetIds.has(set.id);
          const pop = poppedSetId === set.id;

          return (
            <SwipeableItem
              key={set.id}
              onSwipeLeft={() => onDeleteSet(set.id)}
              leftActionLabel={t('common.delete')}
              containerClassName={`${isEntering ? 'set-row-enter ' : ''}rounded-2xl mb-0`}
              className="bg-transparent dark:bg-transparent"
            >
              <div
                className={`flex items-center gap-2 rounded-2xl -mx-2 px-2 py-1 transition-colors ${
                  set.completed ? 'bg-brand-tint' : ''
                }`}
              >
                <div className="w-6 text-center text-xs font-bold text-gray-300 dark:text-gray-600">
                  {idx + 1}
                </div>

                <div className="flex-1 min-w-[120px] bg-gray-50 dark:bg-gray-800 rounded-xl px-2 py-2 flex items-center gap-2">
                  <SetNumberInput
                    value={set.weight}
                    inputMode="decimal"
                    onValueChange={(v) => onUpdateSet(set.id, 'weight', v)}
                    className="flex-1 min-w-0 bg-transparent outline-none font-bold text-gray-900 dark:text-gray-100 text-center tabular-nums"
                  />
                  <span className="text-xs text-gray-400 dark:text-gray-500 font-medium shrink-0">
                    {currentUnit}
                  </span>
                </div>

                <div className="flex-1 min-w-[104px] bg-gray-50 dark:bg-gray-800 rounded-xl px-2 py-2 flex items-center gap-2">
                  <SetNumberInput
                    value={set.reps}
                    inputMode="numeric"
                    onValueChange={(v) => onUpdateSet(set.id, 'reps', v)}
                    className="flex-1 min-w-0 bg-transparent outline-none font-bold text-gray-900 dark:text-gray-100 text-center tabular-nums"
                  />
                  <span className="text-xs text-gray-400 dark:text-gray-500 font-medium shrink-0">
                    REPS
                  </span>
                </div>

                {showBadge && (
                  <span className="px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700 text-[10px] font-black whitespace-nowrap">
                    {isWeightPR && isOneRmPR ? 'PR x2' : 'PR'}
                  </span>
                )}

                <button
                  onClick={() => {
                    const next = !set.completed;
                    onUpdateSet(set.id, 'completed', next);
                    if (next) {
                      setPoppedSetId(set.id);
                      window.setTimeout(() => setPoppedSetId((prev) => (prev === set.id ? null : prev)), 260);
                    }
                  }}
                  aria-label="Complete set"
                  data-testid={`set-complete-${ex.id}-${set.id}`}
                  className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                    set.completed
                      ? 'bg-brand text-gray-900 shadow-lg shadow-brand-soft'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-300 dark:text-gray-600'
                  } ${pop ? 'set-complete-pop' : ''}`}
                >
                  <Check size={14} />
                </button>
              </div>
            </SwipeableItem>
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
        className="w-full mt-3 py-2 text-sm font-bold text-brand bg-brand-tint border border-brand rounded-xl hover:brightness-95 transition-colors"
      >
        + Add Set
      </button>
    </div>
  );
};

export default ExerciseCard;
