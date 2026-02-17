export type SyncedMutationOptions = {
  optimisticUpdate: () => void;
  rollback: () => void;
  remoteOperation: () => Promise<void>;
  enqueueOfflineOperation: () => Promise<void>;
  isOffline: () => boolean;
  onOfflineQueued?: () => void;
  onRemoteError?: (error: unknown) => void;
  onQueueError?: (error: unknown) => void;
};

export const syncedMutation = async ({
  optimisticUpdate,
  rollback,
  remoteOperation,
  enqueueOfflineOperation,
  isOffline,
  onOfflineQueued,
  onRemoteError,
  onQueueError,
}: SyncedMutationOptions): Promise<void> => {
  optimisticUpdate();
  try {
    await remoteOperation();
    return;
  } catch (error) {
    if (isOffline()) {
      try {
        await enqueueOfflineOperation();
        onOfflineQueued?.();
        return;
      } catch (queueError) {
        rollback();
        onQueueError?.(queueError);
        return;
      }
    }

    rollback();
    onRemoteError?.(error);
  }
};
