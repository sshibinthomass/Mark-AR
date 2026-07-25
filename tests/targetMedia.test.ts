import { describe, expect, it } from 'vitest';
import {
  normalizeTargetImageUrl,
  normalizeYouTubeUrl,
  validateTargetImageFile,
} from '../src/app/targetMedia';

describe('target media validation', () => {
  it.each([
    ['https://www.youtube.com/watch?v=M7lc1UVf-VE', 'M7lc1UVf-VE'],
    ['https://youtu.be/M7lc1UVf-VE?t=12', 'M7lc1UVf-VE'],
    ['https://www.youtube.com/shorts/M7lc1UVf-VE', 'M7lc1UVf-VE'],
    ['https://www.youtube.com/embed/M7lc1UVf-VE', 'M7lc1UVf-VE'],
  ])('normalizes supported YouTube URL %s', (input, videoId) => {
    expect(normalizeYouTubeUrl(input)).toEqual({
      videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    });
  });

  it('rejects non-YouTube hosts and malformed video IDs', () => {
    expect(normalizeYouTubeUrl('https://example.com/watch?v=M7lc1UVf-VE')).toBeNull();
    expect(normalizeYouTubeUrl('https://www.youtube.com/watch?v=short')).toBeNull();
    expect(normalizeYouTubeUrl('not a URL')).toBeNull();
  });

  it('accepts only public HTTPS image URLs', () => {
    expect(normalizeTargetImageUrl(' https://cdn.example.com/poster.webp?size=large '))
      .toBe('https://cdn.example.com/poster.webp?size=large');
    expect(normalizeTargetImageUrl('http://cdn.example.com/poster.webp')).toBeNull();
    expect(normalizeTargetImageUrl('https://localhost/poster.webp')).toBeNull();
    expect(normalizeTargetImageUrl('https://127.0.0.1/poster.webp')).toBeNull();
  });

  it('rejects unsupported and oversized image files', () => {
    expect(validateTargetImageFile({ name: 'poster.gif', type: 'image/gif', size: 10 }))
      .toBe('Image objects must be PNG, JPEG, or WebP.');
    expect(validateTargetImageFile({
      name: 'poster.png',
      type: 'image/png',
      size: 5 * 1024 * 1024 + 1,
    })).toBe('Image objects must be 5 MB or smaller.');
    expect(validateTargetImageFile({
      name: 'poster.webp',
      type: 'image/webp',
      size: 5 * 1024 * 1024,
    })).toBeNull();
  });
});
