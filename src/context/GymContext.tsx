import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getIdentityToken, usePrivy } from '@privy-io/react-auth';
import { pushToast } from '@/components/ui';
import { exchangePrivyToken, clearTokenCache } from '@/services/auth';
import {
  normalizeExerciseDefRow,
  normalizeTemplateRow,
  sanitizeTemplateExercises,
  toPersonalExerciseRow,
  toPersonalTemplateRow,
} from '@/services/officialContent';
import { clearAuthToken, getSupabase, setAuthToken } from '@/services/supabase';
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
  refreshOfficialContent: () => Promise<void>;
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

const INITIAL_PERSONAL_EXERCISES: ExerciseDef[] = [];
const REST_TIMER_OPTIONS = [30, 60, 90, 120, 180];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
          source: 'personal',
          readOnly: false,
          description: typeof item.description === 'string' ? item.description : '',
          tagline: typeof item.tagline === 'string' ? item.tagline : '',
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
    const personalOnly = templates.filter((template) => template.source === 'personal');
    localStorage.setItem(getTemplateStorageKey(userId), JSON.stringify(sortTemplatesByCreatedAt(personalOnly)));
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

const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

const getQueuedDeleteId = (payload: Record<string, any>) => {
  const value = payload.id;
  return typeof value === 'string' ? value : '';
};

const mergeExerciseDefs = (official: ExerciseDef[], personal: ExerciseDef[]) => {
  const byId = new Map<string, ExerciseDef>();
  for (const def of official) byId.set(def.id, def);
  for (const def of personal) byId.set(def.id, def);

  return Array.from(byId.values()).sort((a, b) => {
    if (a.source !== b.source) return a.source === 'official' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
};

const mergeTemplates = (official: WorkoutTemplate[], personal: WorkoutTemplate[]) => {
  const byId = new Map<string, WorkoutTemplate>();
  for (const template of official) byId.set(template.id, template);
  for (const template of personal) byId.set(template.id, template);
  return sortTemplatesByCreatedAt(Array.from(byId.values()));
};

const ensurePersonalExerciseShape = (def: ExerciseDef): ExerciseDef => {
  const mediaItems = Array.isArray(def.mediaItems) ? def.mediaItems : [];
  const firstUpload = mediaItems.find((item) => item.kind === 'upload');

  return {
    ...def,
    source: 'personal',
    readOnly: false,
    markdown: def.markdown ?? '',
    mediaItems,
    mediaUrl: firstUpload?.url ?? def.mediaUrl,
    mediaType: firstUpload?.contentType ?? def.mediaType,
    category: def.category ?? 'Other',
    usesBarbell: !!def.usesBarbell,
    barbellWeight: Number.isFinite(def.barbellWeight) ? def.barbellWeight : 0,
  };
};

export const GymProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [personalExerciseDefs, setPersonalExerciseDefs] = useState<ExerciseDef[]>(INITIAL_PERSONAL_EXERCISES);
  const [officialExerciseDefs, setOfficialExerciseDefs] = useState<ExerciseDef[]>([]);
  const [personalTemplates, setPersonalTemplates] = useState<WorkoutTemplate[]>([]);
  const [officialTemplates, setOfficialTemplates] = useState<WorkoutTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const initInFlightRef = useRef<Promise<void> | null>(null);

  const {
    ready,
    authenticated,
    user: privyUser,
    login: privyLogin,
    logout: privyLogout,
    getAccessToken,
  } = usePrivy();

  const isConsumingQueueRef = useRef(false);

  const exerciseDefs = useMemo(
    () => mergeExerciseDefs(officialExerciseDefs, personalExerciseDefs),
    [officialExerciseDefs, personalExerciseDefs]
  );

  const templates = useMemo(
    () => mergeTemplates(officialTemplates, personalTemplates),
    [officialTemplates, personalTemplates]
  );

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

  const consumeSyncQueue = useCallback(
    async (targetUserId?: string) => {
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
    },
    [executeQueuedOperation, user?.id]
  );

  const queueOfflineOperation = useCallback(
    async (
      operation: Omit<QueuedOperation, 'id' | 'timestamp'>,
      rollback: () => void,
      fallbackMessage: string
    ) => {
      try {
        await enqueueSyncOperation(operation);
        pushToast({ kind: 'info', message: OFFLINE_QUEUE_TOAST_MESSAGE });
      } catch (queueError) {
        rollback();
        pushToast({ kind: 'error', message: getErrorMessage(queueError, fallbackMessage) });
      }
    },
    []
  );

  const fetchOfficialContent = useCallback(async () => {
    try {
      const [officialExercisesResult, officialTemplatesResult] = await Promise.all([
        getSupabase().from('official_exercise_defs').select('*').order('updated_at', { ascending: false }),
        getSupabase().from('official_workout_templates').select('*').order('created_at', { ascending: false }),
      ]);

      if (officialExercisesResult.error) throw officialExercisesResult.error;
      if (officialTemplatesResult.error) throw officialTemplatesResult.error;

      setOfficialExerciseDefs(
        (officialExercisesResult.data ?? []).map((row: any) => normalizeExerciseDefRow(row, 'official'))
      );

      setOfficialTemplates(
        sortTemplatesByCreatedAt(
          (officialTemplatesResult.data ?? [])
            .map((row: any) => normalizeTemplateRow(row, 'official'))
            .filter((template: WorkoutTemplate) => template.exercises.length > 0)
        )
      );
    } catch (error) {
      console.warn('Official content sync skipped:', error);
    }
  }, []);

  useEffect(() => {
    if (E2E_BYPASS_AUTH) {
      setAuthError(null);
      if (!user) {
        mapPrivyUser(null, E2E_USER_ID);
      }
      setIsLoading(false);
      return;
    }

    if (!ready) return;

    if (authenticated) {
      void initSession();
      return;
    }

    clearAuthToken();
    clearTokenCache();
    setUser(null);
    setWorkouts([]);
    setPersonalExerciseDefs(INITIAL_PERSONAL_EXERCISES);
    setOfficialExerciseDefs([]);
    setPersonalTemplates([]);
    setOfficialTemplates([]);
    setAuthError(null);
    setIsLoading(false);
    // initSession intentionally reads latest auth state from current closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, authenticated, privyUser, user]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      void consumeSyncQueue();
      void fetchOfficialContent();
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [consumeSyncQueue, fetchOfficialContent]);

  useEffect(() => {
    if (!user?.id) return;
    void consumeSyncQueue(user.id);
  }, [user?.id, consumeSyncQueue]);

  useEffect(() => {
    if (!user?.id || E2E_BYPASS_AUTH) return;

    const channel = getSupabase()
      .channel(`official-content-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'official_exercise_defs' },
        () => {
          void fetchOfficialContent();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'official_workout_templates' },
        () => {
          void fetchOfficialContent();
        }
      )
      .subscribe();

    return () => {
      void getSupabase().removeChannel(channel);
    };
  }, [user?.id, fetchOfficialContent]);

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

        await new Promise((resolve) => setTimeout(resolve, 300 * (i + 1)));
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
        setPersonalExerciseDefs(INITIAL_PERSONAL_EXERCISES);
        setOfficialExerciseDefs([]);
        setPersonalTemplates([]);
        setOfficialTemplates([]);
        setIsLoading(false);
      } finally {
        initInFlightRef.current = null;
      }
    })();

    await initInFlightRef.current;
  };

  const mapPrivyUser = (pUser: any | null | undefined, determinedUserId: string) => {
    const email = pUser?.email?.address || pUser?.google?.email || '';
    const name = pUser?.google?.name || (email ? email.split('@')[0] : null) || 'User';
    const photoUrl =
      pUser?.google?.profilePictureUrl ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0D8ABC&color=fff`;

    let loginMethod: 'google' | 'email' = 'email';
    if (pUser?.google) loginMethod = 'google';

    const unitKey = `ironlog_unit_${determinedUserId}`;
    const savedUnit = localStorage.getItem(unitKey);
    const defaultUnit: Unit = savedUnit === 'kg' || savedUnit === 'lbs' ? savedUnit : 'lbs';
    const restTimerKey = `ironlog_rest_timer_${determinedUserId}`;
    const savedRestTimer = Number(localStorage.getItem(restTimerKey));
    const restTimerSeconds = normalizeRestTimerSeconds(Number.isFinite(savedRestTimer) ? savedRestTimer : 90);
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
      loginMethod,
      preferences: { defaultUnit, restTimerSeconds, themeMode, notificationsEnabled },
    });
  };

  const fetchData = async (activeUserId?: string) => {
    setIsLoading(true);
    const templateUserId = activeUserId ?? user?.id;
    const localTemplates = templateUserId ? readLocalTemplates(templateUserId) : [];

    if (templateUserId) {
      setPersonalTemplates(localTemplates);
    }

    try {
      const [wResult, eResult, tResult] = await Promise.all([
        getSupabase().from('workouts').select('*'),
        getSupabase().from('exercise_defs').select('*'),
        templateUserId
          ? getSupabase().from('workout_templates').select('*').order('created_at', { ascending: false })
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (wResult.error) throw wResult.error;
      if (wResult.data) {
        const parsedWorkouts = wResult.data.map((row: any) => ({
          id: row.id,
          date: row.date,
          title: row.title,
          completed: row.completed,
          ...row.data,
        }));
        setWorkouts(parsedWorkouts);
      }

      if (eResult.error) throw eResult.error;
      if (eResult.data) {
        const parsedDefs = eResult.data.map((row: any) => normalizeExerciseDefRow(row, 'personal'));
        setPersonalExerciseDefs(parsedDefs);
      }

      if (templateUserId) {
        if (tResult.error) {
          console.warn('Template sync skipped:', tResult.error.message);
        } else if (tResult.data) {
          const remoteTemplates: WorkoutTemplate[] = sortTemplatesByCreatedAt(
            tResult.data
              .map((row: any) => normalizeTemplateRow(row, 'personal'))
              .filter((template: WorkoutTemplate) => template.exercises.length > 0)
          );

          const mergedTemplates = sortTemplatesByCreatedAt([
            ...remoteTemplates,
            ...localTemplates.filter(
              (localTemplate) => !remoteTemplates.some((remoteTemplate) => remoteTemplate.id === localTemplate.id)
            ),
          ]);

          setPersonalTemplates(mergedTemplates);
          writeLocalTemplates(templateUserId, mergedTemplates);
        }
      }

      await fetchOfficialContent();
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

  const login = () => {
    if (E2E_BYPASS_AUTH) {
      mapPrivyUser(null, E2E_USER_ID);
      setIsLoading(false);
      return;
    }

    setAuthError(null);
    if (authenticated) {
      void initSession();
      return;
    }
    privyLogin();
  };

  const logout = async () => {
    if (E2E_BYPASS_AUTH) {
      setUser(null);
      setWorkouts([]);
      setPersonalTemplates([]);
      setOfficialTemplates([]);
      return;
    }

    clearAuthToken();
    clearTokenCache();
    setAuthError(null);
    await privyLogout();
    setUser(null);
    setPersonalTemplates([]);
    setOfficialTemplates([]);
  };

  const toggleUnit = () => {
    if (!user) return;
    const newUnit = user.preferences.defaultUnit === 'kg' ? 'lbs' : 'kg';
    localStorage.setItem(`ironlog_unit_${user.id}`, newUnit);
    setUser({ ...user, preferences: { ...user.preferences, defaultUnit: newUnit } });
  };

  const setRestTimerSeconds = (seconds: number) => {
    setUser((prev) => {
      if (!prev) return prev;
      const nextSeconds = normalizeRestTimerSeconds(seconds);
      localStorage.setItem(`ironlog_rest_timer_${prev.id}`, String(nextSeconds));
      return {
        ...prev,
        preferences: { ...prev.preferences, restTimerSeconds: nextSeconds },
      };
    });
  };

  const setThemeMode = (mode: ThemeMode) => {
    setUser((prev) => {
      if (!prev) return prev;
      const nextMode = normalizeThemeMode(mode);
      localStorage.setItem(`ironlog_theme_${prev.id}`, nextMode);
      localStorage.setItem(THEME_STORAGE_KEY, nextMode);
      return {
        ...prev,
        preferences: { ...prev.preferences, themeMode: nextMode },
      };
    });
  };

  const setNotificationsEnabled = (enabled: boolean) => {
    setUser((prev) => {
      if (!prev) return prev;
      localStorage.setItem(`ironlog_notifications_${prev.id}`, enabled ? '1' : '0');
      return {
        ...prev,
        preferences: { ...prev.preferences, notificationsEnabled: enabled },
      };
    });
  };

  const addWorkout = async (workout: Workout) => {
    const previous = workouts;
    setWorkouts((prev) => [...prev, workout]);

    if (user && !E2E_BYPASS_AUTH) {
      const row = {
        id: workout.id,
        user_id: user.id,
        date: workout.date,
        title: workout.title,
        completed: workout.completed,
        data: {
          exercises: workout.exercises,
          note: workout.note,
          elapsedSeconds: workout.elapsedSeconds,
          startTimestamp: workout.startTimestamp,
        },
      };
      try {
        await retryWithBackoff(async () => {
          const { error } = await getSupabase().from('workouts').upsert(row);
          if (error) throw error;
        });
      } catch (error) {
        if (isOffline()) {
          await queueOfflineOperation(
            {
              userId: user.id,
              table: 'workouts',
              action: 'upsert',
              payload: row,
            },
            () => setWorkouts(previous),
            'Failed to queue workout while offline'
          );
        } else {
          setWorkouts(previous);
          pushToast({ kind: 'error', message: getErrorMessage(error, 'Failed to save workout') });
        }
      }
    }
  };

  const updateWorkout = async (updated: Workout) => {
    const previous = workouts;
    setWorkouts((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));

    if (user && !E2E_BYPASS_AUTH) {
      const row = {
        id: updated.id,
        user_id: user.id,
        date: updated.date,
        title: updated.title,
        completed: updated.completed,
        data: {
          exercises: updated.exercises,
          note: updated.note,
          elapsedSeconds: updated.elapsedSeconds,
          startTimestamp: updated.startTimestamp,
        },
      };
      try {
        await retryWithBackoff(async () => {
          const { error } = await getSupabase().from('workouts').upsert(row);
          if (error) throw error;
        });
      } catch (error) {
        if (isOffline()) {
          await queueOfflineOperation(
            {
              userId: user.id,
              table: 'workouts',
              action: 'upsert',
              payload: row,
            },
            () => setWorkouts(previous),
            'Failed to queue workout update while offline'
          );
        } else {
          setWorkouts(previous);
          pushToast({ kind: 'error', message: getErrorMessage(error, 'Failed to update workout') });
        }
      }
    }
  };

  const deleteWorkout = async (id: string) => {
    const previous = workouts;
    setWorkouts((prev) => prev.filter((w) => w.id !== id));
    if (user && !E2E_BYPASS_AUTH) {
      try {
        await retryWithBackoff(async () => {
          const { error } = await getSupabase().from('workouts').delete().eq('id', id);
          if (error) throw error;
        });
      } catch (error) {
        if (isOffline()) {
          await queueOfflineOperation(
            {
              userId: user.id,
              table: 'workouts',
              action: 'delete',
              payload: { id },
            },
            () => setWorkouts(previous),
            'Failed to queue workout delete while offline'
          );
        } else {
          setWorkouts(previous);
          pushToast({ kind: 'error', message: getErrorMessage(error, 'Failed to delete workout') });
        }
      }
    }
  };

  const addExerciseDef = async (def: ExerciseDef) => {
    if (def.source === 'official' || def.readOnly) {
      pushToast({ kind: 'error', message: 'Official exercises are read-only' });
      return;
    }

    const normalized = ensurePersonalExerciseShape(def);
    const previous = personalExerciseDefs;
    setPersonalExerciseDefs((prev) => [...prev, normalized]);

    if (user && !E2E_BYPASS_AUTH) {
      const row = toPersonalExerciseRow(normalized, user.id);
      try {
        await retryWithBackoff(async () => {
          const { error } = await getSupabase().from('exercise_defs').upsert(row);
          if (error) throw error;
        });
      } catch (error) {
        if (isOffline()) {
          await queueOfflineOperation(
            {
              userId: user.id,
              table: 'exercise_defs',
              action: 'upsert',
              payload: row,
            },
            () => setPersonalExerciseDefs(previous),
            'Failed to queue exercise while offline'
          );
        } else {
          setPersonalExerciseDefs(previous);
          pushToast({ kind: 'error', message: getErrorMessage(error, 'Failed to save exercise') });
        }
      }
    }
  };

  const updateExerciseDef = async (def: ExerciseDef) => {
    if (def.source === 'official' || def.readOnly) {
      pushToast({ kind: 'error', message: 'Official exercises are read-only' });
      return;
    }

    const normalized = ensurePersonalExerciseShape(def);
    const previous = personalExerciseDefs;
    setPersonalExerciseDefs((prev) => prev.map((d) => (d.id === normalized.id ? normalized : d)));

    if (user && !E2E_BYPASS_AUTH) {
      const row = toPersonalExerciseRow(normalized, user.id);
      try {
        await retryWithBackoff(async () => {
          const { error } = await getSupabase().from('exercise_defs').upsert(row);
          if (error) throw error;
        });
      } catch (error) {
        if (isOffline()) {
          await queueOfflineOperation(
            {
              userId: user.id,
              table: 'exercise_defs',
              action: 'upsert',
              payload: row,
            },
            () => setPersonalExerciseDefs(previous),
            'Failed to queue exercise update while offline'
          );
        } else {
          setPersonalExerciseDefs(previous);
          pushToast({ kind: 'error', message: getErrorMessage(error, 'Failed to update exercise') });
        }
      }
    }
  };

  const deleteExerciseDef = async (id: string) => {
    const target = exerciseDefs.find((item) => item.id === id);
    if (target?.source === 'official' || target?.readOnly) {
      pushToast({ kind: 'error', message: 'Official exercises are read-only' });
      return;
    }

    const previous = personalExerciseDefs;
    setPersonalExerciseDefs((prev) => prev.filter((d) => d.id !== id));

    if (user && !E2E_BYPASS_AUTH) {
      try {
        await retryWithBackoff(async () => {
          const { error } = await getSupabase().from('exercise_defs').delete().eq('id', id);
          if (error) throw error;
        });
      } catch (error) {
        if (isOffline()) {
          await queueOfflineOperation(
            {
              userId: user.id,
              table: 'exercise_defs',
              action: 'delete',
              payload: { id },
            },
            () => setPersonalExerciseDefs(previous),
            'Failed to queue exercise delete while offline'
          );
        } else {
          setPersonalExerciseDefs(previous);
          pushToast({ kind: 'error', message: getErrorMessage(error, 'Failed to delete exercise') });
        }
      }
    }
  };

  const persistTemplatesLocal = (nextTemplates: WorkoutTemplate[], activeUserId?: string) => {
    const targetUserId = activeUserId ?? user?.id;
    if (!targetUserId) return;
    writeLocalTemplates(targetUserId, nextTemplates.filter((template) => template.source === 'personal'));
  };

  const addTemplate = async (template: WorkoutTemplate): Promise<boolean> => {
    const normalized = {
      ...template,
      source: 'personal' as const,
      readOnly: false,
      description: template.description ?? '',
      tagline: template.tagline ?? '',
      exercises: sanitizeTemplateExercises(template.exercises),
      createdAt: template.createdAt || new Date().toISOString(),
    };

    const next = sortTemplatesByCreatedAt([...personalTemplates, normalized]);
    setPersonalTemplates(next);
    persistTemplatesLocal(next);
    let syncedToRemote = false;

    if (user && !E2E_BYPASS_AUTH) {
      const row = toPersonalTemplateRow(normalized, user.id);
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
            userId: user.id,
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

    return syncedToRemote || !user || E2E_BYPASS_AUTH;
  };

  const addTemplateFromWorkout = async (name: string, workout: Workout) => {
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
      source: 'personal',
      readOnly: false,
      description: '',
      tagline: '',
      exercises: templateExercises,
      createdAt: new Date().toISOString(),
    };

    const synced = await addTemplate(template);
    if (synced) {
      pushToast({ kind: 'success', message: 'Template saved' });
      return;
    }
    pushToast({ kind: 'info', message: 'Template saved locally and will sync later' });
  };

  const deleteTemplate = async (id: string) => {
    const target = templates.find((template) => template.id === id);
    if (target?.source === 'official' || target?.readOnly) {
      pushToast({ kind: 'error', message: 'Official templates are read-only' });
      return;
    }

    const previous = personalTemplates;
    const next = personalTemplates.filter((template) => template.id !== id);
    setPersonalTemplates(next);
    persistTemplatesLocal(next);

    if (user && !E2E_BYPASS_AUTH) {
      try {
        await retryWithBackoff(async () => {
          const { error } = await getSupabase().from('workout_templates').delete().eq('id', id);
          if (error) throw error;
        });
      } catch (error) {
        if (isOffline()) {
          await queueOfflineOperation(
            {
              userId: user.id,
              table: 'workout_templates',
              action: 'delete',
              payload: { id },
            },
            () => {
              setPersonalTemplates(previous);
              persistTemplatesLocal(previous);
            },
            'Failed to queue template delete while offline'
          );
        } else {
          setPersonalTemplates(previous);
          persistTemplatesLocal(previous);
          pushToast({ kind: 'error', message: getErrorMessage(error, 'Failed to delete template') });
        }
      }
    }
  };

  const startWorkoutFromTemplate = async (templateId: string, targetDate: string) => {
    const template = templates.find((item) => item.id === templateId);
    if (!template) {
      pushToast({ kind: 'error', message: 'Template not found' });
      return null;
    }

    const existingDefIds = new Set(exerciseDefs.map((def) => def.id));
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
  };

  const copyWorkout = (workoutId: string, targetDate: string) => {
    const source = workouts.find((w) => w.id === workoutId);
    if (!source) return;

    const newWorkout: Workout = {
      ...source,
      id: generateId(),
      date: targetDate,
      completed: false,
      elapsedSeconds: 0,
      startTimestamp: null,
      exercises: source.exercises.map((ex) => ({
        ...ex,
        sets: ex.sets.map((s) => ({ ...s, completed: false })),
      })),
    };

    void addWorkout(newWorkout);
  };

  const dataValue = useMemo<GymDataContextType>(
    () => ({
      user,
      isLoading,
      authError,
      workouts,
      exerciseDefs,
      templates,
    }),
    [user, isLoading, authError, workouts, exerciseDefs, templates]
  );

  const actionsValue: GymActionsContextType = {
    login,
    logout,
    toggleUnit,
    setRestTimerSeconds,
    setThemeMode,
    setNotificationsEnabled,
    refreshOfficialContent: fetchOfficialContent,
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
  };

  return (
    <GymDataContext.Provider value={dataValue}>
      <GymActionsContext.Provider value={actionsValue}>{children}</GymActionsContext.Provider>
    </GymDataContext.Provider>
  );
};
