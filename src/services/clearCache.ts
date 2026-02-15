export const clearAppCache = async (): Promise<void> => {
  // LocalStorage: only keys owned by the app (avoid nuking auth/vendor state).
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.startsWith('ironlog_')) toRemove.push(key);
    }
    for (const key of toRemove) {
      localStorage.removeItem(key);
    }
  } catch {
    // ignore
  }

  // Cache Storage: clear all SW caches (Vite PWA + runtime caches).
  try {
    if (typeof caches !== 'undefined' && typeof caches.keys === 'function') {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch {
    // ignore
  }

  // IndexedDB: remove media + offline queue.
  try {
    if (typeof indexedDB !== 'undefined' && typeof indexedDB.deleteDatabase === 'function') {
      await new Promise<void>((resolve) => {
        const request = indexedDB.deleteDatabase('IronLogDB');
        request.onsuccess = () => resolve();
        request.onerror = () => resolve();
        request.onblocked = () => resolve();
      });
    }
  } catch {
    // ignore
  }
};

