import { describe, expect, it } from 'vitest';
import {
  normalizeExerciseDefRow,
  normalizeTemplateRow,
  normalizeYouTubeUrl,
  toPersonalExerciseRow,
} from '@/services/officialContent';
import type { ExerciseDef } from '@/types';

describe('officialContent normalizers', () => {
  it('maps legacy media fields into mediaItems', () => {
    const normalized = normalizeExerciseDefRow(
      {
        id: 'ex-1',
        name: 'Row',
        description: 'desc',
        media_url: 'https://cdn.example.com/row.mp4',
        media_type: 'video',
        data: {},
      },
      'personal'
    );

    expect(normalized.mediaItems).toHaveLength(1);
    expect(normalized.mediaItems[0].kind).toBe('upload');
    expect(normalized.mediaItems[0].contentType).toBe('video');
    expect(normalized.mediaItems[0].url).toBe('https://cdn.example.com/row.mp4');
  });

  it('normalizes template rows and preserves exercise settings', () => {
    const normalized = normalizeTemplateRow(
      {
        id: 'tpl-1',
        name: 'Push',
        description: 'desc',
        tagline: 'tag',
        created_at: '2026-02-10T00:00:00.000Z',
        data: {
          exercises: [
            { defId: 'ex-1', defaultSets: 3 },
            { defId: 'ex-2', defaultSets: 4 },
          ],
        },
      },
      'official'
    );

    expect(normalized.source).toBe('official');
    expect(normalized.readOnly).toBe(true);
    expect(normalized.exercises).toEqual([
      { defId: 'ex-1', defaultSets: 3 },
      { defId: 'ex-2', defaultSets: 4 },
    ]);
  });

  it('backfills legacy media fields from first upload item on write', () => {
    const def: ExerciseDef = {
      id: 'ex-1',
      name: 'Bench',
      description: '',
      source: 'personal',
      readOnly: false,
      markdown: '',
      mediaItems: [
        {
          id: 'm1',
          kind: 'youtube',
          contentType: 'video',
          url: 'https://www.youtube.com/embed/abc',
        },
        {
          id: 'm2',
          kind: 'upload',
          contentType: 'image',
          url: 'https://cdn.example.com/bench.jpg',
        },
      ],
    };

    const row = toPersonalExerciseRow(def, 'user-1');
    expect(row.media_url).toBe('https://cdn.example.com/bench.jpg');
    expect(row.media_type).toBe('image');
  });
});

describe('normalizeYouTubeUrl', () => {
  it('supports watch, shorts, and youtu.be URLs', () => {
    expect(normalizeYouTubeUrl('https://www.youtube.com/watch?v=abc123')).toBe(
      'https://www.youtube.com/embed/abc123?playsinline=1'
    );
    expect(normalizeYouTubeUrl('https://youtube.com/shorts/xyz987')).toBe(
      'https://www.youtube.com/embed/xyz987?playsinline=1'
    );
    expect(normalizeYouTubeUrl('https://youtu.be/pqr456')).toBe(
      'https://www.youtube.com/embed/pqr456?playsinline=1'
    );
  });

  it('supports scheme-less and punctuation wrapped URLs', () => {
    expect(normalizeYouTubeUrl('youtube.com/watch?v=abc123')).toBe(
      'https://www.youtube.com/embed/abc123?playsinline=1'
    );
    expect(normalizeYouTubeUrl('https://youtu.be/pqr456?si=abc')).toBe(
      'https://www.youtube.com/embed/pqr456?playsinline=1'
    );
    expect(normalizeYouTubeUrl('https://youtu.be/pqr456).')).toBe(
      'https://www.youtube.com/embed/pqr456?playsinline=1'
    );
  });

  it('returns null for invalid url', () => {
    expect(normalizeYouTubeUrl('not-a-youtube-link')).toBeNull();
  });
});
