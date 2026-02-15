import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadAdminModule = async () => {
  vi.resetModules();
  return await import('@/services/admin');
};

describe('admin service', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('parses allowlist and matches user email case-insensitively', async () => {
    vi.stubEnv('VITE_ADMIN_EMAILS', ' admin@example.com , Ops@Example.com ');
    const admin = await loadAdminModule();

    expect(admin.getAdminEmails()).toEqual(['admin@example.com', 'ops@example.com']);
    expect(admin.isAdminUser('ADMIN@example.com')).toBe(true);
    expect(admin.isAdminUser('ops@example.com')).toBe(true);
    expect(admin.isAdminUser('user@example.com')).toBe(false);
  });

  it('returns false when no email is provided', async () => {
    vi.stubEnv('VITE_ADMIN_EMAILS', 'admin@example.com');
    const admin = await loadAdminModule();

    expect(admin.isAdminUser(undefined)).toBe(false);
    expect(admin.isAdminUser(null)).toBe(false);
    expect(admin.isAdminUser('')).toBe(false);
  });
});
