import { useContext } from 'react';
import { GymDataContext } from '@/context/GymContext';

export const useGymData = () => {
  const context = useContext(GymDataContext);
  if (!context) {
    throw new Error('useGymData must be used within a GymProvider');
  }
  return context;
};
