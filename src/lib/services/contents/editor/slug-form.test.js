import { beforeEach, describe, expect, test, vi } from 'vitest';

import { validateNewFolderName } from '$lib/services/common/slug';
import { getSlugOptions } from '$lib/services/contents/collection/slug';
import { hasLocalizedSlugs } from '$lib/services/contents/draft/slugs';
import { validateSlug } from '$lib/services/contents/draft/validate/slugs';

import { getSlugEditError, getSlugEditRows } from './slug-form';

/**
 * @import { EntryDraft } from '$lib/types/private';
 */

vi.mock('@sveltia/i18n', () => ({
  _: vi.fn((key) => key),
}));
vi.mock('$lib/services/common/slug', () => ({
  validateNewFolderName: vi.fn(),
}));
vi.mock('$lib/services/contents/collection/slug', () => ({
  getSlugOptions: vi.fn(() => ({ pattern: undefined })),
}));
vi.mock('$lib/services/contents/draft/slugs', () => ({
  hasLocalizedSlugs: vi.fn(() => false),
}));
vi.mock('$lib/services/contents/draft/validate/slugs', () => ({
  getSlugValidationMessage: vi.fn(({ error }) => `slug error: ${error}`),
  validateSlug: vi.fn(),
}));
vi.mock('$lib/services/contents/i18n', () => ({
  getLocaleLabel: vi.fn((locale) => (locale === 'xx' ? undefined : `Label ${locale}`)),
}));

/**
 * Create a draft.
 * @param {Record<string, string | undefined>} [currentSlugs] Current slugs.
 * @returns {EntryDraft} Draft.
 */
const createDraft = (currentSlugs = {}) =>
  /** @type {EntryDraft} */ (/** @type {unknown} */ ({ collection: {}, currentSlugs }));

describe('getSlugEditRows()', () => {
  beforeEach(() => {
    vi.mocked(hasLocalizedSlugs).mockReturnValue(false);
  });

  test('lists a slug shared by every locale without a heading', () => {
    expect(
      getSlugEditRows({ draft: createDraft({ _default: 'hello' }), ownFolderPaths: undefined }),
    ).toEqual([{ locale: '_default', label: 'slug', showLabel: false, value: 'hello' }]);
  });

  test('lists the localized slugs, skipping a locale without a file', () => {
    expect(
      getSlugEditRows({
        draft: createDraft({ en: 'hello', fr: undefined, xx: 'bonjour' }),
        ownFolderPaths: undefined,
      }),
    ).toEqual([
      { locale: 'en', label: 'Label en', showLabel: true, value: 'hello' },
      { locale: 'xx', label: 'xx', showLabel: true, value: 'bonjour' },
    ]);
  });

  test('lists a folder shared by every locale', () => {
    expect(
      getSlugEditRows({
        draft: createDraft(),
        ownFolderPaths: { en: 'content/posts/hello', fr: 'content/posts/hello' },
      }),
    ).toEqual([
      { locale: 'en', label: 'folder', showLabel: false, value: 'hello' },
      { locale: 'fr', label: 'folder', showLabel: false, value: 'hello' },
    ]);
  });

  test('lists the folder of each locale when the slugs are localized', () => {
    vi.mocked(hasLocalizedSlugs).mockReturnValue(true);

    expect(
      getSlugEditRows({
        draft: createDraft(),
        ownFolderPaths: { en: 'content/posts/hello', fr: 'content/posts/bonjour' },
      }),
    ).toEqual([
      { locale: 'en', label: 'Label en', showLabel: true, value: 'hello' },
      { locale: 'fr', label: 'Label fr', showLabel: true, value: 'bonjour' },
    ]);
  });
});

describe('getSlugEditError()', () => {
  const args = {
    draft: createDraft(),
    takenFolderNames: { en: ['taken'] },
    takenSlugs: { en: ['taken-slug'] },
    locale: 'en',
  };

  test('checks a folder name', () => {
    const ownFolderPaths = { en: 'content/posts/hello' };

    vi.mocked(validateNewFolderName).mockReturnValue('duplicate');
    expect(getSlugEditError({ ...args, ownFolderPaths, text: 'Taken' })).toBe(
      'new_parent_folder_error.duplicate',
    );
    expect(validateNewFolderName).toHaveBeenCalledWith({ takenNames: ['taken'], name: 'Taken' });

    vi.mocked(validateNewFolderName).mockReturnValue(undefined);
    expect(getSlugEditError({ ...args, ownFolderPaths, text: 'new' })).toBeUndefined();
    expect(validateSlug).not.toHaveBeenCalled();
  });

  test('checks a slug against the collection’s pattern', () => {
    const pattern = /** @type {[string, string]} */ (['^[a-z]+$', 'Lowercase only']);

    vi.mocked(getSlugOptions).mockReturnValue(/** @type {any} */ ({ pattern }));
    vi.mocked(validateSlug).mockReturnValue('pattern');
    expect(getSlugEditError({ ...args, ownFolderPaths: undefined, text: 'X' })).toBe(
      'slug error: pattern',
    );
    expect(validateSlug).toHaveBeenCalledWith({
      slug: 'X',
      pattern,
      takenSlugs: ['taken-slug'],
      locale: 'en',
    });

    vi.mocked(validateSlug).mockReturnValue(undefined);
    expect(getSlugEditError({ ...args, ownFolderPaths: undefined, text: 'x' })).toBeUndefined();
  });
});
