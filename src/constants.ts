import type { Unit } from '@/types';

export const BODY_PART_OPTIONS = [
  'Neck',
  'Chest',
  'Shoulders',
  'Back',
  'Arms',
  'Forearms',
  'Abs',
  'Glutes',
  'Quads',
  'Hamstrings',
  'Calves',
  'Full Body',
  'Cardio',
  'Other',
];

export const DEFAULT_BARBELL_KG = 20;
export const KG_TO_LBS = 2.20462;

export const getDefaultBarbellWeight = (unit: Unit) =>
  unit === 'lbs' ? Number((DEFAULT_BARBELL_KG * KG_TO_LBS).toFixed(1)) : DEFAULT_BARBELL_KG;

export const normalizeCategory = (category?: string) => {
  const normalized = (category || 'Other').trim();
  return BODY_PART_OPTIONS.includes(normalized) ? normalized : 'Other';
};
