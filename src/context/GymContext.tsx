import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getIdentityToken, usePrivy } from '@privy-io/react-auth';
import { pushToast } from '@/components/ui';
import { clearTokenCache, exchangePrivyToken, getTokenExpiresAt } from '@/services/auth';
import { clearAuthToken, getSupabase, setAuthToken } from '@/services/supabase';
import { syncedMutation } from '@/services/syncedMutation';
import {
  enqueueSyncOperation,
  listQueuedOperations,
  removeQueuedOperation,
  type QueuedOperation,
} from '@/services/syncQueue';
import { generateId } from '@/services/utils';
import type { ExerciseDef, ThemeMode, Unit, UserProfile, Workout, WorkoutTemplate } from '@/types';

export interface GymContextType {
  user: UserProfile | null;
  isLoading: boolean;
  authError: string | null;
  login: () => void;
  logout: () => void;
  toggleUnit: () => void;
  setRestTimerSeconds: (seconds: number) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  workouts: Workout[];
  exerciseDefs: ExerciseDef[];
  templates: WorkoutTemplate[];
  addWorkout: (workout: Workout) => Promise<void>;
  updateWorkout: (workout: Workout) => Promise<void>;
  deleteWorkout: (id: string) => Promise<void>;
  addExerciseDef: (def: ExerciseDef) => Promise<void>;
  updateExerciseDef: (def: ExerciseDef) => Promise<void>;
  deleteExerciseDef: (id: string) => Promise<void>;
  addTemplateFromWorkout: (name: string, workout: Workout) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  startWorkoutFromTemplate: (templateId: string, targetDate: string) => Promise<Workout | null>;
  copyWorkout: (workoutId: string, targetDate: string) => void;
}

export type GymDataContextType = Pick<
  GymContextType,
  'user' | 'isLoading' | 'authError' | 'workouts' | 'exerciseDefs' | 'templates'
>;

export type GymActionsContextType = Omit<GymContextType, keyof GymDataContextType>;

export const GymDataContext = createContext<GymDataContextType | null>(null);
export const GymActionsContext = createContext<GymActionsContextType | null>(null);

const INITIAL_EXERCISES: ExerciseDef[] = [
  { id: '1', name: 'Bench Press', description: 'Barbell bench press', mediaType: 'image', category: 'Chest' },
  { id: '2', name: 'Squat', description: 'Barbell back squat', mediaType: 'image', category: 'Quads' },
  { id: '3', name: 'Deadlift', description: 'Conventional deadlift', mediaType: 'image', category: 'Back' },
];
const REST_TIMER_OPTIONS = [30, 60, 90, 120, 180];

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

const normalizeRestTimerSeconds = (value: number) =>
  REST_TIMER_OPTIONS.includes(value) ? value : 90;

const normalizeThemeMode = (value: string | null): ThemeMode =>
  value === 'light' || value === 'dark' || value === 'system' ? value : 'system';

const THEME_STORAGE_KEY = 'ironlog_theme_mode';

const getTemplateStorageKey = (userId: string) => `ironlog_templates_${userId}`;

const sanitizeTemplateExercises = (value: unknown): WorkoutTemplate['exercises'] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const defId = typeof (item as { defId?: unknown }).defId === 'string'
        ? (item as { defId: string }).defId
        : '';
      const defaultSetsRaw = Number((item as { defaultSets?: unknown }).defaultSets);
      const defaultSets = Number.isFinite(defaultSetsRaw) ? Math.max(1, Math.round(defaultSetsRaw)) : 1;
      if (!defId) return null;
      return { defId, defaultSets };
    })
    .filter((item): item is WorkoutTemplate['exercises'][number] => item !== null);
};

const sortTemplatesByCreatedAt = (templates: WorkoutTemplate[]) =>
  templates
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

const readLocalTemplates = (userId: string): WorkoutTemplate[] => {
  try {
    const raw = localStorage.getItem(getTemplateStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const templates = parsed
      .map((item: any) => {
        if (!item || typeof item !== 'object') return null;
        const id = typeof item.id === 'string' ? item.id : '';
        const name = typeof item.name === 'string' ? item.name : '';
        if (!id || !name) return null;
        return {
          id,
          name,
          createdAt:
            typeof item.createdAt === 'string' && item.createdAt
              ? item.createdAt
              : new Date().toISOString(),
          exercises: sanitizeTemplateExercises(item.exercises),
        } as WorkoutTemplate;
      })
      .filter((item): item is WorkoutTemplate => item !== null);

    return sortTemplatesByCreatedAt(templates);
  } catch {
    return [];
  }
};

const writeLocalTemplates = (userId: string, templates: WorkoutTemplate[]) => {
  try {
    localStorage.setItem(getTemplateStorageKey(userId), JSON.stringify(sortTemplatesByCreatedAt(templates)));
  } catch {
    // Ignore localStorage write errors.
  }
};

const retryWithBackoff = async <T,>(
  operation: () => Promise<T>,
  attempts = 3,
  initialDelayMs = 250
): Promise<T> => {
  let lastError: unknown = null;

  for (let i = 0; i < attempts; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (i === attempts - 1) break;
      await sleep(initialDelayMs * 2 ** i);
    }
  }

  throw lastError ?? new Error('Operation failed');
};

const OFFLINE_QUEUE_TOAST_MESSAGE = 'Offline: changes saved locally and queued for sync.';
const E2E_BYPASS_AUTH = import.meta.env.VITE_E2E_BYPASS_AUTH === '1';
const E2E_USER_ID = '00000000-0000-4000-8000-000000000000';

const isOffline = () =>
  typeof navigator !== 'undefined' && navigator.onLine === false;

const getQueuedDeleteId = (payload: Record<string, any>) => {
  const value = payload.id;
  return typeof value === 'string' ? value : '';
};

const buildWorkoutRow = (workout: Workout, userId: string) => ({
  id: workout.id,
  user_id: userId,
  date: workout.date,
  title: workout.title,
  completed: workout.completed,
  data: {
    exercises: workout.exercises,
    note: workout.note,
    elapsedSeconds: workout.elapsedSeconds,
    startTimestamp: workout.startTimestamp,
  },
});

const buildExerciseDefRow = (def: ExerciseDef, userId: string) => ({
  id: def.id,
  user_id: userId,
  name: def.name,
  description: def.description,
  media_url: def.mediaUrl,
  media_type: def.mediaType,
  data: {
    category: def.category ?? 'Other',
    usesBarbell: !!def.usesBarbell,
    barbellWeight: def.barbellWeight,
  },
});

export const GymProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [exerciseDefs, setExerciseDefs] = useState<ExerciseDef[]>(INITIAL_EXERCISES);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const initInFlightRef = useRef<Promise<void> | null>(null);
  const tokenRefreshTimerRef = useRef<number | null>(null);

  const {
    ready,
    authenticated,
    user: privyUser,
    login: privyLogin,
    logout: privyLogout,
    getAccessToken,
  } = usePrivy();

  const isConsumingQueueRef = useRef(false);
  const userRef = useRef<UserProfile | null>(user);
  const workoutsRef = useRef<Workout[]>(workouts);
  const exerciseDefsRef = useRef<ExerciseDef[]>(exerciseDefs);
  const templatesRef = useRef<WorkoutTemplate[]>(templates);
  const authenticatedRef = useRef(authenticated);
  const privyLoginRef = useRef(privyLogin);
  const privyLogoutRef = useRef(privyLogout);
  const initSessionRef = useRef<() => Promise<void>>(async () => {});
  const mapPrivyUserRef = useRef<(pUser: any | null | undefined, determinedUserId: string) => void>(() => {});

  userRef.current = user;
  workoutsRef.current = workouts;
  exerciseDefsRef.current = exerciseDefs;
  templatesRef.current = templates;
  authenticatedRef.current = authenticated;
  privyLoginRef.current = privyLogin;
  privyLogoutRef.current = privyLogout;

  const executeQueuedOperation = useCallback(async (operation: QueuedOperation) => {
    if (operation.action === 'upsert') {
      const { error } = await getSupabase().from(operation.table).upsert(operation.payload);
      if (error) throw error;
      return;
    }

    const deleteId = getQueuedDeleteId(operation.payload);
    if (!deleteId) throw new Error('Queued delete operation missing id');

    const { error } = await getSupabase().from(operation.table).delete().eq('id', deleteId);
    if (error) throw error;
  }, []);

  const consumeSyncQueue = useCallback(async (targetUserId?: string) => {
    if (E2E_BYPASS_AUTH) return;
    const activeUserId = targetUserId ?? user?.id;
    if (!activeUserId || isOffline() || isConsumingQueueRef.current) return;

    isConsumingQueueRef.current = true;
    let processedCount = 0;
    try {
      const queued = await listQueuedOperations(activeUserId);
      for (const operation of queued) {
        try {
          await executeQueuedOperation(operation);
          await removeQueuedOperation(operation.id);
          processedCount += 1;
        } catch (error) {
          if (isOffline()) break;
          console.warn('Sync queue operation failed:', error);
          break;
        }
      }

      if (processedCount > 0) {
        pushToast({ kind: 'success', message: 'Offline changes synced' });
      }
    } catch (error) {
      console.warn('Failed to process sync queue:', error);
    } finally {
      isConsumingQueueRef.current = false;
    }
  }, [executeQueuedOperation, user?.id]);

  useEffect(() => {
    if (E2E_BYPASS_AUTH) {
      setAuthError(null);
      if (!userRef.current) {
        mapPrivyUserRef.current(null, E2E_USER_ID);
      }
      setIsLoading(false);
      return;
    }

    if (!ready) return;

    if (authenticated) {
      void initSessionRef.current();
      return;
    }

    clearAuthToken();
    clearTokenCache();
    setUser(null);
    setWorkouts([]);
    setExerciseDefs(INITIAL_EXERCISES);
    setTemplates([]);
    setAuthError(null);
    setIsLoading(false);
  }, [ready, authenticated, privyUser]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      void consumeSyncQueue();
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [consumeSyncQueue]);

  useEffect(() => {
    if (!user?.id) return;
    void consumeSyncQueue(user.id);
  }, [user?.id, consumeSyncQueue]);

  const initSession = async () => {
    if (initInFlightRef.current) {
      await initInFlightRef.current;
      return;
    }

    const exchangePrivyTokenWithRetry = async () => {
      const attempts = 8;
      let lastError: unknown = null;

      for (let i = 0; i < attempts; i++) {
        const identityToken = await getIdentityToken();
        const accessToken = await getAccessToken();

        const tokenCandidates = Array.from(
          new globalThis.Set([identityToken, accessToken].filter((token): token is string => !!token))
        );

        for (const token of tokenCandidates) {
          try {
            return await exchangePrivyToken(token);
          } catch (error) {
            lastError = error;
          }
        }

        await new Promise(resolve => setTimeout(resolve, 300 * (i + 1)));
      }

      if (lastError) throw lastError;
      throw new Error('Failed to exchange Privy token');
    };

    initInFlightRef.current = (async () => {
      setIsLoading(true);
      setAuthError(null);
      try {
        const { token: supabaseJwt, userId } = await exchangePrivyTokenWithRetry();
        setAuthToken(supabaseJwt);

        mapPrivyUser(privyUser, userId);
        await consumeSyncQueue(userId);
        await Promise.all([migrateLegacyDataByEmail(), fetchData(userId)]);
      } catch (e: any) {
        console.error('Auth init error:', e);
        setAuthError(e?.message || 'Authentication failed');
        clearAuthToken();
        clearTokenCache();
        setUser(null);
        setWorkouts([]);
        setExerciseDefs(INITIAL_EXERCISES);
        setTemplates([]);
        setIsLoading(false);
      } finally {
        initInFlightRef.current = null;
      }
    })();

    await initInFlightRef.current;
  };
  initSessionRef.current = initSession;

  useEffect(() => {
    if (E2E_BYPASS_AUTH || !user?.id) return;

    let canceled = false;
    const clearRefreshTimer = () => {
      if (tokenRefreshTimerRef.current !== null) {
        window.clearTimeout(tokenRefreshTimerRef.current);
        tokenRefreshTimerRef.current = null;
      }
    };

    const scheduleTokenRefresh = () => {
      clearRefreshTimer();
      const expiresAt = getTokenExpiresAt();
      if (!expiresAt) return;

      const refreshAt = expiresAt - (5 * 60 * 1000);
      const delay = Math.max(0, refreshAt - Date.now());

      tokenRefreshTimerRef.current = window.setTimeout(async () => {
        try {
          const accessToken = await getAccessToken();
          const identityToken = accessToken ? null : await getIdentityToken();
          const privyToken = accessToken || identityToken;
          if (!privyToken) throw new Error('No Privy token available');

          clearTokenCache();
          const { token: refreshedJwt } = await exchangePrivyToken(privyToken);
          setAuthToken(refreshedJwt);

          if (!canceled) {
            scheduleTokenRefresh();
          }
        } catch (error) {
          console.error('Token refresh failed:', error);
          pushToast({ kind: 'error', message: 'Session expired. Please reload the page.' });
        }
      }, delay);
    };

    scheduleTokenRefresh();
    return () => {
      canceled = true;
      clearRefreshTimer();
    };
  }, [user?.id, getAccessToken]);

  const shortenAddress = (addr?: string) =>
    addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : undefined;

  const mapPrivyUser = (pUser: any | null | undefined, determinedUserId: string) => {
    const email = pUser?.email?.address || pUser?.google?.email || '';
    const name =
      pUser?.google?.name ||
      (email ? email.split('@')[0] : null) ||
      shortenAddress(pUser?.wallet?.address) ||
      'User';
    const photoUrl =
      pUser?.google?.profilePictureUrl ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0D8ABC&color=fff`;

    let loginMethod: 'google' | 'email' | 'wallet' = 'email';
    if (pUser?.google) loginMethod = 'google';
    else if (pUser?.wallet && !pUser?.email) loginMethod = 'wallet';

    const linkedAccounts = pUser?.linkedAccounts || [];

    const evmWallet = linkedAccounts.find(
      (a: any) => a.type === 'wallet' && a.chainType === 'ethereum'
    );
    const solWallet = linkedAccounts.find(
      (a: any) => a.type === 'wallet' && a.chainType === 'solana'
    );

    const unitKey = `ironlog_unit_${determinedUserId}`;
    const savedUnit = localStorage.getItem(unitKey);
    const defaultUnit: Unit = savedUnit === 'kg' || savedUnit === 'lbs' ? savedUnit : 'lbs';
    const restTimerKey = `ironlog_rest_timer_${determinedUserId}`;
    const savedRestTimer = Number(localStorage.getItem(restTimerKey));
    const restTimerSeconds = normalizeRestTimerSeconds(
      Number.isFinite(savedRestTimer) ? savedRestTimer : 90
    );
    const notificationsKey = `ironlog_notifications_${determinedUserId}`;
    const notificationsEnabled = localStorage.getItem(notificationsKey) === '1';
    const themeKey = `ironlog_theme_${determinedUserId}`;
    const themeMode = normalizeThemeMode(localStorage.getItem(themeKey) ?? localStorage.getItem(THEME_STORAGE_KEY));
    localStorage.setItem(THEME_STORAGE_KEY, themeMode);

    setUser({
      id: determinedUserId,
      privyDid: pUser?.id,
      name,
      email,
      photoUrl,
      walletAddress: evmWallet?.address,
      solanaAddress: solWallet?.address,
      loginMethod,
      preferences: { defaultUnit, restTimerSeconds, themeMode, notificationsEnabled },
    });
  };
  mapPrivyUserRef.current = mapPrivyUser;

  const fetchData = async (activeUserId?: string) => {
    setIsLoading(true);
    const templateUserId = activeUserId ?? user?.id;
    const localTemplates = templateUserId ? readLocalTemplates(templateUserId) : [];

    if (templateUserId) {
      setTemplates(localTemplates);
    }

    try {
      const fetchAllWorkouts = async () => {
        const pageSize = 200;
        const rows: any[] = [];
        let from = 0;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await getSupabase()
            .from('workouts')
            .select('*')
            .order('date', { ascending: false })
            .range(from, from + pageSize - 1);

          if (error) throw error;
          if (!data || data.length === 0) {
            hasMore = false;
            break;
          }

          rows.push(...data);
          if (data.length < pageSize) {
            hasMore = false;
            break;
          }
          from += pageSize;
        }

        return rows;
      };

      const [workoutRows, eResult, tResult] = await Promise.all([
        fetchAllWorkouts(),
        getSupabase().from('exercise_defs').select('*'),
        templateUserId
          ? getSupabase()
              .from('workout_templates')
              .select('*')
              .order('created_at', { ascending: false })
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (workoutRows.length > 0) {
        const parsedWorkouts = workoutRows.map((row: any) => ({
          id: row.id,
          date: row.date,
          title: row.title,
          completed: row.completed,
          ...row.data,
        }));
        setWorkouts(parsedWorkouts);
      } else {
        setWorkouts([]);
      }

      if (eResult.error) throw eResult.error;
      if (eResult.data && eResult.data.length > 0) {
        const parsedDefs = eResult.data.map((row: any) => ({
          id: row.id,
          name: row.name,
          description: row.description,
          mediaUrl: row.media_url,
          mediaType: row.media_type,
          ...row.data,
        }));
        setExerciseDefs(parsedDefs);
      }

      if (templateUserId) {
        if (tResult.error) {
          console.warn('Template sync skipped:', tResult.error.message);
        } else if (tResult.data) {
          const remoteTemplates: WorkoutTemplate[] = sortTemplatesByCreatedAt(
            tResult.data
              .map((row: any) => ({
                id: row.id,
                name: row.name,
                createdAt: row.created_at || new Date().toISOString(),
                exercises: sanitizeTemplateExercises(row.data?.exercises),
              }))
              .filter((template: WorkoutTemplate) => template.exercises.length > 0)
          );
          const mergedTemplates = sortTemplatesByCreatedAt([
            ...remoteTemplates,
            ...localTemplates.filter(
              (localTemplate) => !remoteTemplates.some((remoteTemplate) => remoteTemplate.id === localTemplate.id)
            ),
          ]);
          setTemplates(mergedTemplates);
          writeLocalTemplates(templateUserId, mergedTemplates);
        }
      }
    } catch (e) {
      console.error('Sync Error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const migrateLegacyDataByEmail = async () => {
    try {
      const { data, error } = await getSupabase().rpc('migrate_legacy_user_data_by_email');
      if (error) {
        console.warn('Legacy migration skipped:', error.message);
        return;
      }

      if (data?.migrated_workouts || data?.migrated_exercise_defs) {
        console.info('Legacy data migrated:', data);
      }
    } catch (e) {
      console.warn('Legacy migration failed:', e);
    }
  };

  const login = useCallback(() => {
    if (E2E_BYPASS_AUTH) {
      mapPrivyUserRef.current(null, E2E_USER_ID);
      setIsLoading(false);
      return;
    }

    setAuthError(null);
    if (authenticatedRef.current) {
      void initSessionRef.current();
      return;
    }
    privyLoginRef.current();
  }, []);

  const logout = useCallback(async () => {
    if (E2E_BYPASS_AUTH) {
      setUser(null);
      setWorkouts([]);
      setTemplates([]);
      return;
    }

    clearAuthToken();
    clearTokenCache();
    setAuthError(null);
    await privyLogoutRef.current();
    setUser(null);
    setTemplates([]);
  }, []);

  const toggleUnit = useCallback(() => {
    setUser(prev => {
      if (!prev) return prev;
      const newUnit = prev.preferences.defaultUnit === 'kg' ? 'lbs' : 'kg';
      localStorage.setItem(`ironlog_unit_${prev.id}`, newUnit);
      return { ...prev, preferences: { ...prev.preferences, defaultUnit: newUnit } };
    });
  }, []);

  const setRestTimerSeconds = useCallback((seconds: number) => {
    setUser(prev => {
      if (!prev) return prev;
      const nextSeconds = normalizeRestTimerSeconds(seconds);
      localStorage.setItem(`ironlog_rest_timer_${prev.id}`, String(nextSeconds));
      return {
        ...prev,
        preferences: { ...prev.preferences, restTimerSeconds: nextSeconds },
      };
    });
  }, []);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setUser(prev => {
      if (!prev) return prev;
      const nextMode = normalizeThemeMode(mode);
      localStorage.setItem(`ironlog_theme_${prev.id}`, nextMode);
      localStorage.setItem(THEME_STORAGE_KEY, nextMode);
      return {
        ...prev,
        preferences: { ...prev.preferences, themeMode: nextMode },
      };
    });
  }, []);

  const setNotificationsEnabled = useCallback((enabled: boolean) => {
    setUser(prev => {
      if (!prev) return prev;
      localStorage.setItem(`ironlog_notifications_${prev.id}`, enabled ? '1' : '0');
      return {
        ...prev,
        preferences: { ...prev.preferences, notificationsEnabled: enabled },
      };
    });
  }, []);

  const addWorkout = useCallback(async (workout: Workout) => {
    const activeUser = userRef.current;
    if (!activeUser || E2E_BYPASS_AUTH) {
      setWorkouts(prev => [...prev, workout]);
      return;
    }

    const previous = workoutsRef.current;
    const row = buildWorkoutRow(workout, activeUser.id);
    await syncedMutation({
      optimisticUpdate: () => setWorkouts(prev => [...prev, workout]),
      rollback: () => setWorkouts(previous),
      remoteOperation: async () => {
        await retryWithBackoff(async () => {
          const { error } = await getSupabase().from('workouts').upsert(row);
          if (error) throw error;
        });
      },
      enqueueOfflineOperation: async () => {
        await enqueueSyncOperation({
          userId: activeUser.id,
          table: 'workouts',
          action: 'upsert',
          payload: row,
        });
      },
      isOffline,
      onOfflineQueued: () => {
        pushToast({ kind: 'info', message: OFFLINE_QUEUE_TOAST_MESSAGE });
      },
      onRemoteError: (error) => {
        pushToast({ kind: 'error', message: getErrorMessage(error, 'Failed to save workout') });
      },
      onQueueError: (queueError) => {
        pushToast({ kind: 'error', message: getErrorMessage(queueError, 'Failed to queue workout while offline') });
      },
    });
  }, []);

  const updateWorkout = useCallback(async (updated: Workout) => {
    const activeUser = userRef.current;
    if (!activeUser || E2E_BYPASS_AUTH) {
      setWorkouts(prev => prev.map(w => (w.id === updated.id ? updated : w)));
      return;
    }

    const previous = workoutsRef.current;
    const row = buildWorkoutRow(updated, activeUser.id);
    await syncedMutation({
      optimisticUpdate: () => setWorkouts(prev => prev.map(w => (w.id === updated.id ? updated : w))),
      rollback: () => setWorkouts(previous),
      remoteOperation: async () => {
        await retryWithBackoff(async () => {
          const { error } = await getSupabase().from('workouts').upsert(row);
          if (error) throw error;
        });
      },
      enqueueOfflineOperation: async () => {
        await enqueueSyncOperation({
          userId: activeUser.id,
          table: 'workouts',
          action: 'upsert',
          payload: row,
        });
      },
      isOffline,
      onOfflineQueued: () => {
        pushToast({ kind: 'info', message: OFFLINE_QUEUE_TOAST_MESSAGE });
      },
      onRemoteError: (error) => {
        pushToast({ kind: 'error', message: getErrorMessage(error, 'Failed to update workout') });
      },
      onQueueError: (queueError) => {
        pushToast({ kind: 'error', message: getErrorMessage(queueError, 'Failed to queue workout update while offline') });
      },
    });
  }, []);

  const deleteWorkout = useCallback(async (id: string) => {
    const activeUser = userRef.current;
    if (!activeUser || E2E_BYPASS_AUTH) {
      setWorkouts(prev => prev.filter(w => w.id !== id));
      return;
    }

    const previous = workoutsRef.current;
    await syncedMutation({
      optimisticUpdate: () => setWorkouts(prev => prev.filter(w => w.id !== id)),
      rollback: () => setWorkouts(previous),
      remoteOperation: async () => {
        await retryWithBackoff(async () => {
          const { error } = await getSupabase().from('workouts').delete().eq('id', id);
          if (error) throw error;
        });
      },
      enqueueOfflineOperation: async () => {
        await enqueueSyncOperation({
          userId: activeUser.id,
          table: 'workouts',
          action: 'delete',
          payload: { id },
        });
      },
      isOffline,
      onOfflineQueued: () => {
        pushToast({ kind: 'info', message: OFFLINE_QUEUE_TOAST_MESSAGE });
      },
      onRemoteError: (error) => {
        pushToast({ kind: 'error', message: getErrorMessage(error, 'Failed to delete workout') });
      },
      onQueueError: (queueError) => {
        pushToast({ kind: 'error', message: getErrorMessage(queueError, 'Failed to queue workout delete while offline') });
      },
    });
  }, []);

  const addExerciseDef = useCallback(async (def: ExerciseDef) => {
    const activeUser = userRef.current;
    if (!activeUser || E2E_BYPASS_AUTH) {
      setExerciseDefs(prev => [...prev, def]);
      return;
    }

    const previous = exerciseDefsRef.current;
    const row = buildExerciseDefRow(def, activeUser.id);
    await syncedMutation({
      optimisticUpdate: () => setExerciseDefs(prev => [...prev, def]),
      rollback: () => setExerciseDefs(previous),
      remoteOperation: async () => {
        await retryWithBackoff(async () => {
          const { error } = await getSupabase().from('exercise_defs').upsert(row);
          if (error) throw error;
        });
      },
      enqueueOfflineOperation: async () => {
        await enqueueSyncOperation({
          userId: activeUser.id,
          table: 'exercise_defs',
          action: 'upsert',
          payload: row,
        });
      },
      isOffline,
      onOfflineQueued: () => {
        pushToast({ kind: 'info', message: OFFLINE_QUEUE_TOAST_MESSAGE });
      },
      onRemoteError: (error) => {
        pushToast({ kind: 'error', message: getErrorMessage(error, 'Failed to save exercise') });
      },
      onQueueError: (queueError) => {
        pushToast({ kind: 'error', message: getErrorMessage(queueError, 'Failed to queue exercise while offline') });
      },
    });
  }, []);

  const updateExerciseDef = useCallback(async (def: ExerciseDef) => {
    const activeUser = userRef.current;
    if (!activeUser || E2E_BYPASS_AUTH) {
      setExerciseDefs(prev => prev.map(d => (d.id === def.id ? def : d)));
      return;
    }

    const previous = exerciseDefsRef.current;
    const row = buildExerciseDefRow(def, activeUser.id);
    await syncedMutation({
      optimisticUpdate: () => setExerciseDefs(prev => prev.map(d => (d.id === def.id ? def : d))),
      rollback: () => setExerciseDefs(previous),
      remoteOperation: async () => {
        await retryWithBackoff(async () => {
          const { error } = await getSupabase().from('exercise_defs').upsert(row);
          if (error) throw error;
        });
      },
      enqueueOfflineOperation: async () => {
        await enqueueSyncOperation({
          userId: activeUser.id,
          table: 'exercise_defs',
          action: 'upsert',
          payload: row,
        });
      },
      isOffline,
      onOfflineQueued: () => {
        pushToast({ kind: 'info', message: OFFLINE_QUEUE_TOAST_MESSAGE });
      },
      onRemoteError: (error) => {
        pushToast({ kind: 'error', message: getErrorMessage(error, 'Failed to update exercise') });
      },
      onQueueError: (queueError) => {
        pushToast({ kind: 'error', message: getErrorMessage(queueError, 'Failed to queue exercise update while offline') });
      },
    });
  }, []);

  const deleteExerciseDef = useCallback(async (id: string) => {
    const activeUser = userRef.current;
    if (!activeUser || E2E_BYPASS_AUTH) {
      setExerciseDefs(prev => prev.filter(d => d.id !== id));
      return;
    }

    const previous = exerciseDefsRef.current;
    await syncedMutation({
      optimisticUpdate: () => setExerciseDefs(prev => prev.filter(d => d.id !== id)),
      rollback: () => setExerciseDefs(previous),
      remoteOperation: async () => {
        await retryWithBackoff(async () => {
          const { error } = await getSupabase().from('exercise_defs').delete().eq('id', id);
          if (error) throw error;
        });
      },
      enqueueOfflineOperation: async () => {
        await enqueueSyncOperation({
          userId: activeUser.id,
          table: 'exercise_defs',
          action: 'delete',
          payload: { id },
        });
      },
      isOffline,
      onOfflineQueued: () => {
        pushToast({ kind: 'info', message: OFFLINE_QUEUE_TOAST_MESSAGE });
      },
      onRemoteError: (error) => {
        pushToast({ kind: 'error', message: getErrorMessage(error, 'Failed to delete exercise') });
      },
      onQueueError: (queueError) => {
        pushToast({ kind: 'error', message: getErrorMessage(queueError, 'Failed to queue exercise delete while offline') });
      },
    });
  }, []);

  const persistTemplatesLocal = useCallback((nextTemplates: WorkoutTemplate[], activeUserId?: string) => {
    const targetUserId = activeUserId ?? userRef.current?.id;
    if (!targetUserId) return;
    writeLocalTemplates(targetUserId, nextTemplates);
  }, []);

  const addTemplate = useCallback(async (template: WorkoutTemplate): Promise<boolean> => {
    const normalized = {
      ...template,
      exercises: sanitizeTemplateExercises(template.exercises),
      createdAt: template.createdAt || new Date().toISOString(),
    };
    const next = sortTemplatesByCreatedAt([...templatesRef.current, normalized]);
    setTemplates(next);
    persistTemplatesLocal(next);
    let syncedToRemote = false;

    const activeUser = userRef.current;
    if (activeUser && !E2E_BYPASS_AUTH) {
      const row = {
        id: normalized.id,
        user_id: activeUser.id,
        name: normalized.name,
        data: { exercises: normalized.exercises },
        created_at: normalized.createdAt,
      };
      try {
        await retryWithBackoff(async () => {
          const { error } = await getSupabase().from('workout_templates').upsert(row);
          if (error) throw error;
        });
        syncedToRemote = true;
      } catch (error) {
        console.warn('Template sync failed, keeping local template:', error);
        try {
          await enqueueSyncOperation({
            userId: activeUser.id,
            table: 'workout_templates',
            action: 'upsert',
            payload: row,
          });
        } catch (queueError) {
          pushToast({
            kind: 'error',
            message: getErrorMessage(queueError, 'Template saved locally but failed to queue sync'),
          });
        }
      }
    }
    return syncedToRemote || !activeUser || E2E_BYPASS_AUTH;
  }, [persistTemplatesLocal]);

  const addTemplateFromWorkout = useCallback(async (name: string, workout: Workout) => {
    const setsByDefId = new Map<string, number>();
    for (const exercise of workout.exercises) {
      const setCount = Math.max(1, exercise.sets.length);
      const previousCount = setsByDefId.get(exercise.defId) ?? 0;
      setsByDefId.set(exercise.defId, Math.max(previousCount, setCount));
    }

    const templateExercises = Array.from(setsByDefId.entries()).map(([defId, defaultSets]) => ({
      defId,
      defaultSets,
    }));

    if (templateExercises.length === 0) {
      pushToast({ kind: 'info', message: 'No exercises available to save as template' });
      return;
    }

    const template: WorkoutTemplate = {
      id: generateId(),
      name: name.trim() || workout.title || 'Workout Template',
      exercises: templateExercises,
      createdAt: new Date().toISOString(),
    };

    const synced = await addTemplate(template);
    if (synced) {
      pushToast({ kind: 'success', message: 'Template saved' });
      return;
    }
    pushToast({ kind: 'info', message: 'Template saved locally and will sync later' });
  }, [addTemplate]);

  const deleteTemplate = useCallback(async (id: string) => {
    const previous = templatesRef.current;
    const next = templatesRef.current.filter((template) => template.id !== id);
    const activeUser = userRef.current;
    if (!activeUser || E2E_BYPASS_AUTH) {
      setTemplates(next);
      persistTemplatesLocal(next);
      return;
    }

    await syncedMutation({
      optimisticUpdate: () => {
        setTemplates(next);
        persistTemplatesLocal(next);
      },
      rollback: () => {
        setTemplates(previous);
        persistTemplatesLocal(previous);
      },
      remoteOperation: async () => {
        await retryWithBackoff(async () => {
          const { error } = await getSupabase().from('workout_templates').delete().eq('id', id);
          if (error) throw error;
        });
      },
      enqueueOfflineOperation: async () => {
        await enqueueSyncOperation({
          userId: activeUser.id,
          table: 'workout_templates',
          action: 'delete',
          payload: { id },
        });
      },
      isOffline,
      onOfflineQueued: () => {
        pushToast({ kind: 'info', message: OFFLINE_QUEUE_TOAST_MESSAGE });
      },
      onRemoteError: (error) => {
        pushToast({ kind: 'error', message: getErrorMessage(error, 'Failed to delete template') });
      },
      onQueueError: (queueError) => {
        pushToast({ kind: 'error', message: getErrorMessage(queueError, 'Failed to queue template delete while offline') });
      },
    });
  }, [persistTemplatesLocal]);

  const startWorkoutFromTemplate = useCallback(async (templateId: string, targetDate: string) => {
    const template = templatesRef.current.find((item) => item.id === templateId);
    if (!template) {
      pushToast({ kind: 'error', message: 'Template not found' });
      return null;
    }

    const existingDefIds = new Set(exerciseDefsRef.current.map((def) => def.id));
    const exercises: Workout['exercises'] = template.exercises
      .filter((item) => existingDefIds.has(item.defId))
      .map((item) => ({
        id: generateId(),
        defId: item.defId,
        sets: Array.from({ length: Math.max(1, item.defaultSets) }, () => ({
          id: generateId(),
          weight: 0,
          reps: 0,
          completed: false,
        })),
      }));

    if (exercises.length === 0) {
      pushToast({ kind: 'error', message: 'This template has no available exercises' });
      return null;
    }

    const workout: Workout = {
      id: generateId(),
      date: targetDate,
      title: template.name,
      note: '',
      exercises,
      completed: false,
      elapsedSeconds: 0,
      startTimestamp: null,
    };

    await addWorkout(workout);
    return workout;
  }, [addWorkout]);

  const copyWorkout = useCallback((workoutId: string, targetDate: string) => {
    const source = workoutsRef.current.find(w => w.id === workoutId);
    if (!source) return;

    const newWorkout: Workout = {
      ...source,
      id: generateId(),
      date: targetDate,
      completed: false,
      elapsedSeconds: 0,
      startTimestamp: null,
      exercises: source.exercises.map(ex => ({
        ...ex,
        id: generateId(),
        sets: ex.sets.map(s => ({ ...s, id: generateId(), completed: false })),
      })),
    };

    void addWorkout(newWorkout);
  }, [addWorkout]);

  const dataValue = useMemo<GymDataContextType>(() => ({
    user,
    isLoading,
    authError,
    workouts,
    exerciseDefs,
    templates,
  }), [user, isLoading, authError, workouts, exerciseDefs, templates]);

  const actionsValue = useMemo<GymActionsContextType>(() => ({
    login,
    logout,
    toggleUnit,
    setRestTimerSeconds,
    setThemeMode,
    setNotificationsEnabled,
    addWorkout,
    updateWorkout,
    deleteWorkout,
    addExerciseDef,
    updateExerciseDef,
    deleteExerciseDef,
    addTemplateFromWorkout,
    deleteTemplate,
    startWorkoutFromTemplate,
    copyWorkout,
  }), [
    login,
    logout,
    toggleUnit,
    setRestTimerSeconds,
    setThemeMode,
    setNotificationsEnabled,
    addWorkout,
    updateWorkout,
    deleteWorkout,
    addExerciseDef,
    updateExerciseDef,
    deleteExerciseDef,
    addTemplateFromWorkout,
    deleteTemplate,
    startWorkoutFromTemplate,
    copyWorkout,
  ]);

  return (
    <GymDataContext.Provider value={dataValue}>
      <GymActionsContext.Provider value={actionsValue}>
        {children}
      </GymActionsContext.Provider>
    </GymDataContext.Provider>
  );
};
