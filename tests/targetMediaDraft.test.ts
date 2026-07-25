import { describe, expect, it, vi } from 'vitest';
import {
  createTargetImageDraftFromFile,
  createTargetImageDraftFromUrl,
} from '../src/app/targetMediaDraft';

describe('target media drafts', () => {
  it('creates an upload draft with browser dimensions and a local preview URL', async () => {
    const file = new File(['poster'], 'poster.png', { type: 'image/png' });
    const draft = await createTargetImageDraftFromFile(file, {
      encode: vi.fn(async () => ({
        imageBase64: 'cG9zdGVy',
        imageMimeType: 'image/png',
      })),
      measure: vi.fn(async () => ({ width: 1200, height: 800 })),
    });

    expect(draft).toEqual({
      image: {
        url: 'data:image/png;base64,cG9zdGVy',
        label: 'poster',
        width: 1200,
        height: 800,
        aspectRatio: 1.5,
      },
      source: {
        source: 'upload',
        imageBase64: 'cG9zdGVy',
        imageMimeType: 'image/png',
      },
    });
  });

  it('normalizes an HTTPS URL and records its natural dimensions', async () => {
    const draft = await createTargetImageDraftFromUrl(' https://cdn.example/poster.webp#hero ', {
      measure: vi.fn(async () => ({ width: 900, height: 1200 })),
    });

    expect(draft.image).toMatchObject({
      url: 'https://cdn.example/poster.webp',
      label: 'poster.webp',
      width: 900,
      height: 1200,
      aspectRatio: 0.75,
    });
    expect(draft.source).toEqual({
      source: 'url',
      sourceUrl: 'https://cdn.example/poster.webp',
    });
  });

  it('rejects invalid files, private URLs, and images without dimensions', async () => {
    await expect(createTargetImageDraftFromFile(
      new File(['x'], 'notes.txt', { type: 'text/plain' }),
    )).rejects.toThrow('PNG, JPEG, or WebP');
    await expect(createTargetImageDraftFromUrl('https://127.0.0.1/poster.png')).rejects.toThrow('public HTTPS');
    await expect(createTargetImageDraftFromUrl('https://cdn.example/poster.png', {
      measure: vi.fn(async () => ({ width: 0, height: 0 })),
    })).rejects.toThrow('dimensions');
  });
});
