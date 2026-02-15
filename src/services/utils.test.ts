import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatDate, formatDuration, generateId, getDisplayDate, parseLocalDate } from '@/services/utils';

describe('utils service', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('generateId uses crypto.randomUUID', () => {
    const mockedUuid = '00000000-0000-4000-8000-000000000000';
    const uuidSpy = vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(mockedUuid);
    expect(generateId()).toBe(mockedUuid);
    expect(uuidSpy).toHaveBeenCalledTimes(1);
  });

  it('formatDate and parseLocalDate round-trip a local date', () => {
    const date = new Date(2026, 1, 11, 23, 59, 0);
    const formatted = formatDate(date);
    expect(formatted).toBe('2026-02-11');

    const parsed = parseLocalDate(formatted);
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(1);
    expect(parsed.getDate()).toBe(11);
  });

  it('formatDuration floors milliseconds and formats mm:ss / h:mm:ss', () => {
    expect(formatDuration(9.9)).toBe('00:09');
    expect(formatDuration(65)).toBe('01:05');
    expect(formatDuration(3605)).toBe('1:00:05');
  });

  it('getDisplayDate returns localized display text', () => {
    const expected = new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    }).format(new Date(2026, 1, 11));

    expect(getDisplayDate('2026-02-11')).toBe(expected);
  });
});
