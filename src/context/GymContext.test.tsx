import { act, render, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GymProvider, type GymContextType } from '@/context/GymContext';
import { useGym } from '@/hooks/useGym';
import type { Workout } from '@/types';

const privyState = {
  ready: true,
  authenticated: false,
  user: null,
  login: vi.fn(),
  logout: vi.fn(async () => {}),
  getAccessToken: vi.fn(async () => null),
};

vi.mock('@privy-io/react-auth', () => ({
  usePrivy: () => privyState,
  getIdentityToken: vi.fn(async () => null),
}));

vi.mock('@/services/auth', () => ({
  exchangePrivyToken: vi.fn(),
  clearTokenCache: vi.fn(),
}));

vi.mock('@/services/supabase', () => ({
  clearAuthToken: vi.fn(),
  setAuthToken: vi.fn(),
  getSupabase: vi.fn(),
}));

vi.mock('@/components/ui', () => ({
  pushToast: vi.fn(),
}));

describe('GymProvider', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined' && typeof window.localStorage?.clear === 'function') {
      window.localStorage.clear();
    }
    vi.clearAllMocks();
    privyState.ready = true;
    privyState.authenticated = false;
    privyState.user = null;
  });

  it('initializes unauthenticated state', async () => {
    const latestRef: { current: GymContextType | null } = { current: null };
    const Probe = () => {
      const gym = useGym();
      useEffect(() => {
        latestRef.current = gym;
      }, [gym]);
      return null;
    };

    render(
      <GymProvider>
        <Probe />
      </GymProvider>
    );

    await waitFor(() => expect(latestRef.current?.isLoading).toBe(false));
    expect(latestRef.current?.user).toBeNull();
    expect(latestRef.current?.exerciseDefs).toHaveLength(0);
    expect(latestRef.current?.workouts).toHaveLength(0);
  });

  it('adds and copies workouts in local state', async () => {
    const latestRef: { current: GymContextType | null } = { current: null };
    const Probe = () => {
      const gym = useGym();
      useEffect(() => {
        latestRef.current = gym;
      }, [gym]);
      return null;
    };

    render(
      <GymProvider>
        <Probe />
      </GymProvider>
    );

    await waitFor(() => expect(latestRef.current?.isLoading).toBe(false));
    expect(latestRef.current).not.toBeNull();

    const workout: Workout = {
      id: 'workout-1',
      date: '2026-02-11',
      title: 'Push Day',
      note: '',
      completed: false,
      elapsedSeconds: 0,
      startTimestamp: null,
      exercises: [
        {
          id: 'exercise-1',
          defId: '1',
          sets: [
            {
              id: 'set-1',
              weight: 100,
              reps: 5,
              completed: false,
            },
          ],
        },
      ],
    };

    await act(async () => {
      await latestRef.current!.addWorkout(workout);
    });

    expect(latestRef.current!.workouts).toHaveLength(1);
    expect(latestRef.current!.workouts[0].id).toBe('workout-1');

    await act(async () => {
      latestRef.current!.copyWorkout('workout-1', '2026-02-12');
    });

    await waitFor(() => expect(latestRef.current!.workouts).toHaveLength(2));
    expect(latestRef.current!.workouts[1].date).toBe('2026-02-12');
    expect(latestRef.current!.workouts[1].completed).toBe(false);
    expect(latestRef.current!.workouts[1].id).not.toBe('workout-1');
  });
});
