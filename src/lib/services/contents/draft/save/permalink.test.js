// @ts-nocheck
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { setPermalink } from '$lib/services/contents/draft/save/permalink';
import { fillPermalink } from '$lib/services/contents/entry/permalink';

vi.mock('$lib/services/contents/entry/permalink', async (importOriginal) => ({
  ...(await importOriginal()),
  fillPermalink: vi.fn(),
}));

/**
 * Create a mock entry draft.
 * @param {object} [collectionOverrides] Collection properties to override the defaults.
 * @returns {object} Mock draft.
 */
const createDraft = (collectionOverrides = {}) => ({
  isIndexFile: false,
  collection: {
    name: 'portfolio',
    _type: 'entry',
    permalink_field: true,
    _i18n: { defaultLocale: 'en' },
    ...collectionOverrides,
  },
  fields: [{ name: 'title' }],
  currentValues: { en: { title: 'Foo', date: 'today' } },
});

describe('Test setPermalink()', () => {
  const baseArgs = { locale: 'fr', slug: 'truc', path: 'content/fr/truc.md' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should fill the permalink with the default locale’s values in the draft', () => {
    const draft = createDraft();
    const content = { title: 'Truc' };

    setPermalink({ ...baseArgs, draft, content });

    expect(fillPermalink).toHaveBeenCalledExactlyOnceWith({
      ...baseArgs,
      collection: draft.collection,
      fields: draft.fields,
      isIndexFile: false,
      content,
      defaultContent: { title: 'Foo', date: 'today' },
    });
  });

  test('should do nothing when the collection doesn’t store permalinks', () => {
    setPermalink({ ...baseArgs, draft: createDraft({ permalink_field: false }), content: {} });

    expect(fillPermalink).not.toHaveBeenCalled();
  });
});
