import { useContext } from 'react';
import { GymActionsContext } from '@/context/GymContext';

export const useGymActions = () => {
  const context = useContext(GymActionsContext);
  if (!context) {
    throw new Error('useGymActions must be used within a GymProvider');
  }
  return context;
};
