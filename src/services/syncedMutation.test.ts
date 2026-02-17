import { describe, expect, it, vi } from 'vitest';
import { syncedMutation } from '@/services/syncedMutation';

describe('syncedMutation', () => {
  it('runs remote operation after optimistic update on success', async () => {
    const optimisticUpdate = vi.fn();
    const rollback = vi.fn();
    const remoteOperation = vi.fn(async () => {});
    const enqueueOfflineOperation = vi.fn(async () => {});

    await syncedMutation({
      optimisticUpdate,
      rollback,
      remoteOperation,
      enqueueOfflineOperation,
      isOffline: () => false,
    });

    expect(optimisticUpdate).toHaveBeenCalledTimes(1);
    expect(remoteOperation).toHaveBeenCalledTimes(1);
    expect(enqueueOfflineOperation).not.toHaveBeenCalled();
    expect(rollback).not.toHaveBeenCalled();
  });

  it('queues operation when remote fails while offline', async () => {
    const optimisticUpdate = vi.fn();
    const rollback = vi.fn();
    const remoteOperation = vi.fn(async () => {
      throw new Error('remote failed');
    });
    const enqueueOfflineOperation = vi.fn(async () => {});
    const onOfflineQueued = vi.fn();

    await syncedMutation({
      optimisticUpdate,
      rollback,
      remoteOperation,
      enqueueOfflineOperation,
      isOffline: () => true,
      onOfflineQueued,
    });

    expect(remoteOperation).toHaveBeenCalledTimes(1);
    expect(enqueueOfflineOperation).toHaveBeenCalledTimes(1);
    expect(onOfflineQueued).toHaveBeenCalledTimes(1);
    expect(rollback).not.toHaveBeenCalled();
  });

  it('rolls back when queueing fails offline', async () => {
    const optimisticUpdate = vi.fn();
    const rollback = vi.fn();
    const remoteOperation = vi.fn(async () => {
      throw new Error('remote failed');
    });
    const enqueueOfflineOperation = vi.fn(async () => {
      throw new Error('queue failed');
    });
    const onQueueError = vi.fn();

    await syncedMutation({
      optimisticUpdate,
      rollback,
      remoteOperation,
      enqueueOfflineOperation,
      isOffline: () => true,
      onQueueError,
    });

    expect(enqueueOfflineOperation).toHaveBeenCalledTimes(1);
    expect(rollback).toHaveBeenCalledTimes(1);
    expect(onQueueError).toHaveBeenCalledTimes(1);
  });

  it('rolls back when remote fails online', async () => {
    const optimisticUpdate = vi.fn();
    const rollback = vi.fn();
    const remoteOperation = vi.fn(async () => {
      throw new Error('remote failed');
    });
    const enqueueOfflineOperation = vi.fn(async () => {});
    const onRemoteError = vi.fn();

    await syncedMutation({
      optimisticUpdate,
      rollback,
      remoteOperation,
      enqueueOfflineOperation,
      isOffline: () => false,
      onRemoteError,
    });

    expect(enqueueOfflineOperation).not.toHaveBeenCalled();
    expect(rollback).toHaveBeenCalledTimes(1);
    expect(onRemoteError).toHaveBeenCalledTimes(1);
  });
});
