import { act, render, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GymProvider, type GymContextType } from '@/context/GymContext';
import { useGym } from '@/hooks/useGym';
import { useGymActions } from '@/hooks/useGymActions';
import { useGymData } from '@/hooks/useGymData';
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
  getTokenExpiresAt: vi.fn(() => null),
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
    expect(latestRef.current?.exerciseDefs).toHaveLength(3);
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
    const copied = latestRef.current!.workouts[1];
    expect(copied.date).toBe('2026-02-12');
    expect(copied.completed).toBe(false);
    expect(copied.id).not.toBe('workout-1');
    expect(copied.exercises[0].id).not.toBe('exercise-1');
    expect(copied.exercises[0].sets[0].id).not.toBe('set-1');
    expect(copied.exercises[0].sets[0].completed).toBe(false);
  });

  it('keeps actions context identity stable when only data changes', async () => {
    const latestActionsRef: { current: ReturnType<typeof useGymActions> | null } = { current: null };
    const latestDataRef: { current: ReturnType<typeof useGymData> | null } = { current: null };

    const Probe = () => {
      const actions = useGymActions();
      const data = useGymData();
      useEffect(() => {
        latestActionsRef.current = actions;
        latestDataRef.current = data;
      }, [actions, data]);
      return null;
    };

    render(
      <GymProvider>
        <Probe />
      </GymProvider>
    );

    await waitFor(() => expect(latestDataRef.current?.isLoading).toBe(false));
    const initialActions = latestActionsRef.current;
    expect(initialActions).not.toBeNull();

    const workout: Workout = {
      id: 'workout-stable-action',
      date: '2026-02-11',
      title: 'Leg Day',
      note: '',
      completed: false,
      elapsedSeconds: 0,
      startTimestamp: null,
      exercises: [],
    };

    await act(async () => {
      await latestActionsRef.current!.addWorkout(workout);
    });

    await waitFor(() => expect(latestDataRef.current!.workouts).toHaveLength(1));
    expect(latestActionsRef.current).toBe(initialActions);
  });
});
