import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearTokenCache, exchangePrivyToken, privyDidToUuid } from '@/services/auth';

describe('auth service', () => {
  beforeEach(() => {
    clearTokenCache();
    vi.restoreAllMocks();
  });

  it('privyDidToUuid is deterministic for the same DID', async () => {
    await expect(privyDidToUuid('did:privy:test-user-123')).resolves.toBe(
      'd0f3fc25-5592-462a-ba6f-27deefadebbc'
    );
    await expect(privyDidToUuid('did:privy:test-user-123')).resolves.toBe(
      'd0f3fc25-5592-462a-ba6f-27deefadebbc'
    );
  });

  it('exchangePrivyToken caches by source token', async () => {
    const payload = {
      token: 'supabase-jwt',
      userId: 'user-1',
      expiresAt: Date.now() + 30 * 60 * 1000,
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(payload),
    } as any);

    await expect(exchangePrivyToken('privy-access-token')).resolves.toEqual(payload);
    await expect(exchangePrivyToken('privy-access-token')).resolves.toEqual(payload);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('exchangePrivyToken retries network call for different source tokens', async () => {
    const payload = {
      token: 'supabase-jwt',
      userId: 'user-2',
      expiresAt: Date.now() + 30 * 60 * 1000,
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(payload),
    } as any);

    await exchangePrivyToken('token-a');
    await exchangePrivyToken('token-b');

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('exchangePrivyToken throws service error when endpoint fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      statusText: 'Unauthorized',
      json: vi.fn().mockResolvedValue({ error: 'invalid token' }),
    } as any);

    await expect(exchangePrivyToken('broken-token')).rejects.toThrow(
      'Token exchange failed: invalid token'
    );
  });
});
