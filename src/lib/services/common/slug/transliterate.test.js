import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadModule } from '$lib/services/app/dependencies';
import {
  _resetTransliterator,
  loadTransliterator,
  transliterateString,
} from '$lib/services/common/slug/transliterate';

vi.mock('$lib/services/app/dependencies', () => ({
  loadModule: vi.fn(() => import('@sindresorhus/transliterate')),
}));

describe('transliterate', () => {
  afterEach(() => {
    _resetTransliterator();
  });

  it('only strips the accents until the library has loaded', () => {
    expect(transliterateString('Café Straße')).toBe('Cafe Straße');
  });

  it('transliterates with the library once loaded, in the given locale', async () => {
    await loadTransliterator();

    expect(loadModule).toHaveBeenCalledWith('@sindresorhus/transliterate', 'index.js');
    expect(transliterateString('Café Straße')).toBe('Cafe Strasse');
    expect(transliterateString('Übung', 'de')).toBe('Uebung');
    expect(transliterateString('Übung', 'de_DE')).toBe('Uebung');
  });

  it('loads the library only once', async () => {
    await loadTransliterator();
    await loadTransliterator();

    expect(loadModule).toHaveBeenCalledOnce();
  });

  it('logs a failure to load the library and keeps stripping the accents', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.mocked(loadModule).mockRejectedValueOnce(new Error('Offline'));

    await expect(loadTransliterator()).resolves.toBeUndefined();

    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to load the transliterate library',
      expect.any(Error),
    );
    expect(transliterateString('Straße')).toBe('Straße');

    consoleSpy.mockRestore();
  });
});
