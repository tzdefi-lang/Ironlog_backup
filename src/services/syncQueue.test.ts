import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  enqueueSyncOperation,
  getQueuedOperationCount,
  listQueuedOperations,
  removeQueuedOperation,
} from '@/services/syncQueue';

describe('syncQueue service', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    const all = await listQueuedOperations();
    await Promise.all(all.map((item) => removeQueuedOperation(item.id)));
  });

  it('enqueues operation with generated id and timestamp', async () => {
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1700000000000);
    const queued = await enqueueSyncOperation({
      userId: 'user-a',
      table: 'workouts',
      action: 'upsert',
      payload: { id: 'workout-1' },
    });

    expect(queued.id).toBeTruthy();
    expect(queued.userId).toBe('user-a');
    expect(queued.timestamp).toBe(1700000000000);
    nowSpy.mockRestore();
  });

  it('lists operations sorted by timestamp ascending', async () => {
    await enqueueSyncOperation({
      userId: 'user-a',
      table: 'workouts',
      action: 'upsert',
      payload: { id: '1' },
    });
    await enqueueSyncOperation({
      userId: 'user-a',
      table: 'workouts',
      action: 'upsert',
      payload: { id: '2' },
    });
    await enqueueSyncOperation({
      userId: 'user-a',
      table: 'workouts',
      action: 'upsert',
      payload: { id: '3' },
    });

    const queued = await listQueuedOperations('user-a');
    const timestamps = queued.map((item) => item.timestamp);
    const sorted = timestamps.slice().sort((a, b) => a - b);
    expect(timestamps).toEqual(sorted);
    expect(queued).toHaveLength(3);
  });

  it('filters queued operations by user id', async () => {
    await enqueueSyncOperation({
      userId: 'user-a',
      table: 'workouts',
      action: 'upsert',
      payload: { id: 'workout-a' },
    });
    await enqueueSyncOperation({
      userId: 'user-b',
      table: 'workouts',
      action: 'upsert',
      payload: { id: 'workout-b' },
    });

    const userA = await listQueuedOperations('user-a');
    const userB = await listQueuedOperations('user-b');

    expect(userA).toHaveLength(1);
    expect(userA[0].payload.id).toBe('workout-a');
    expect(userB).toHaveLength(1);
    expect(userB[0].payload.id).toBe('workout-b');
  });

  it('removes queued operation by id', async () => {
    const queued = await enqueueSyncOperation({
      userId: 'user-a',
      table: 'exercise_defs',
      action: 'delete',
      payload: { id: 'exercise-a' },
    });

    await removeQueuedOperation(queued.id);
    const all = await listQueuedOperations();
    expect(all).toHaveLength(0);
  });

  it('returns queued operation count', async () => {
    await enqueueSyncOperation({
      userId: 'user-a',
      table: 'workouts',
      action: 'upsert',
      payload: { id: 'workout-a' },
    });
    await enqueueSyncOperation({
      userId: 'user-a',
      table: 'exercise_defs',
      action: 'upsert',
      payload: { id: 'def-a' },
    });
    await enqueueSyncOperation({
      userId: 'user-b',
      table: 'workout_templates',
      action: 'upsert',
      payload: { id: 'template-b' },
    });

    await expect(getQueuedOperationCount()).resolves.toBe(3);
    await expect(getQueuedOperationCount('user-a')).resolves.toBe(2);
    await expect(getQueuedOperationCount('user-b')).resolves.toBe(1);
  });
});
