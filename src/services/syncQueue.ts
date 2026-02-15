import { generateId } from '@/services/utils';

const DB_NAME = 'IronLogDB';
const DB_VERSION = 2;
const MEDIA_STORE = 'media';
const SYNC_QUEUE_STORE = 'sync_queue';

export interface QueuedOperation {
  id: string;
  userId: string;
  table: 'workouts' | 'exercise_defs' | 'workout_templates';
  action: 'upsert' | 'delete';
  payload: Record<string, any>;
  timestamp: number;
}

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(MEDIA_STORE)) {
        db.createObjectStore(MEDIA_STORE);
      }
      if (!db.objectStoreNames.contains(SYNC_QUEUE_STORE)) {
        const queueStore = db.createObjectStore(SYNC_QUEUE_STORE, { keyPath: 'id' });
        queueStore.createIndex('timestamp', 'timestamp', { unique: false });
        queueStore.createIndex('userId', 'userId', { unique: false });
      }
    };
  });

const withStore = async <T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => void,
  onSuccess: () => T
): Promise<T> => {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(SYNC_QUEUE_STORE, mode);
    const store = tx.objectStore(SYNC_QUEUE_STORE);

    tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
    tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'));
    tx.oncomplete = () => resolve(onSuccess());

    run(store);
  });
};

export const enqueueSyncOperation = async (
  operation: Omit<QueuedOperation, 'id' | 'timestamp'>
): Promise<QueuedOperation> => {
  const queued: QueuedOperation = {
    ...operation,
    id: generateId(),
    timestamp: Date.now(),
  };

  await withStore('readwrite', (store) => {
    store.put(queued);
  }, () => queued);

  return queued;
};

export const listQueuedOperations = async (userId?: string): Promise<QueuedOperation[]> => {
  const db = await openDb();
  return new Promise<QueuedOperation[]>((resolve, reject) => {
    const tx = db.transaction(SYNC_QUEUE_STORE, 'readonly');
    const store = tx.objectStore(SYNC_QUEUE_STORE);
    const request = store.getAll();

    request.onerror = () => reject(request.error || new Error('Failed to read sync queue'));
    request.onsuccess = () => {
      const all = Array.isArray(request.result) ? (request.result as QueuedOperation[]) : [];
      const filtered = userId ? all.filter((item) => item.userId === userId) : all;
      filtered.sort((a, b) => a.timestamp - b.timestamp);
      resolve(filtered);
    };
  });
};

export const removeQueuedOperation = async (id: string): Promise<void> => {
  await withStore(
    'readwrite',
    (store) => {
      store.delete(id);
    },
    () => undefined
  );
};

export const getQueuedOperationCount = async (userId?: string): Promise<number> => {
  const queued = await listQueuedOperations(userId);
  return queued.length;
};
