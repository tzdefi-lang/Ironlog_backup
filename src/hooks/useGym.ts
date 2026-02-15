import { useContext, useMemo } from 'react';
import { GymActionsContext, GymDataContext, type GymContextType } from '@/context/GymContext';

export const useGym = (): GymContextType => {
  const data = useContext(GymDataContext);
  const actions = useContext(GymActionsContext);

  if (!data || !actions) {
    throw new Error('useGym must be used within a GymProvider');
  }

  return useMemo(() => ({ ...data, ...actions }), [data, actions]);
};
