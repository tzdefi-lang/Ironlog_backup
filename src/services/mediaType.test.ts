import { describe, expect, it } from 'vitest';
import { inferMediaTypeFromUrl } from '@/services/mediaType';

describe('inferMediaTypeFromUrl', () => {
  it('infers video types', () => {
    expect(inferMediaTypeFromUrl('https://cdn.example.com/video.mp4')).toBe('video');
    expect(inferMediaTypeFromUrl('https://cdn.example.com/video.webm?token=abc')).toBe('video');
    expect(inferMediaTypeFromUrl('https://cdn.example.com/video.MOV#hash')).toBe('video');
  });

  it('infers image types', () => {
    expect(inferMediaTypeFromUrl('https://cdn.example.com/image.jpg')).toBe('image');
    expect(inferMediaTypeFromUrl('https://cdn.example.com/image.PNG?x=1')).toBe('image');
    expect(inferMediaTypeFromUrl('https://cdn.example.com/image.webp')).toBe('image');
  });

  it('returns undefined for unknown or missing', () => {
    expect(inferMediaTypeFromUrl('')).toBeUndefined();
    expect(inferMediaTypeFromUrl(null)).toBeUndefined();
    expect(inferMediaTypeFromUrl(undefined)).toBeUndefined();
    expect(inferMediaTypeFromUrl('https://cdn.example.com/file.unknown')).toBeUndefined();
    expect(inferMediaTypeFromUrl('https://cdn.example.com/no-extension')).toBeUndefined();
  });
});

