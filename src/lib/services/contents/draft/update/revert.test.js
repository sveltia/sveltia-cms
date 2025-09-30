// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { entryDraft } from '$lib/services/contents/draft';
import { getField } from '$lib/services/contents/entry/fields';

import { revertChanges } from './revert';

vi.mock('$lib/services/contents/draft');
vi.mock('$lib/services/contents/entry/fields');
vi.mock('$lib/services/user/prefs', () => ({
  prefs: { subscribe: vi.fn(() => vi.fn()) },
}));
vi.mock('svelte/store', async () => {
  const actual = await vi.importActual('svelte/store');

  return {
    ...actual,
    get: vi.fn(() => ({ devModeEnabled: false })),
  };
});

describe('draft/update/revert', () => {
  let mockEntryDraft;
  let mockUpdate;
  let mockGet;

  beforeEach(async () => {
    vi.clearAllMocks();

    const { get } = await import('svelte/store');

    mockGet = vi.mocked(get);

    mockEntryDraft = {
      collection: {
        _i18n: {
          defaultLocale: 'en',
          allLocales: ['en', 'ja'],
        },
      },
      collectionFile: undefined,
      collectionName: 'posts',
      fileName: undefined,
      isIndexFile: false,
      currentValues: {
        en: {
          title: 'Modified Title',
          body: 'Modified Body',
          date: '2024-01-02',
        },
        ja: {
          title: 'Modified Japanese Title',
          body: 'Modified Japanese Body',
        },
      },
      originalValues: {
        en: {
          title: 'Original Title',
          body: 'Original Body',
          date: '2024-01-01',
        },
        ja: {
          title: 'Original Japanese Title',
          body: 'Original Japanese Body',
        },
      },
    };

    mockUpdate = vi.fn((fn) => {
      if (typeof fn === 'function') {
        return fn(mockEntryDraft);
      }

      return mockEntryDraft;
    });

    mockGet.mockImplementation((store) => {
      if (store === entryDraft) {
        return mockEntryDraft;
      }

      return undefined;
    });

    vi.mocked(entryDraft).update = mockUpdate;

    vi.mocked(getField).mockImplementation(({ keyPath }) => {
      if (keyPath === 'title') {
        return { name: 'title', widget: 'string', i18n: 'translate' };
      }

      if (keyPath === 'body') {
        return { name: 'body', widget: 'markdown', i18n: true };
      }

      if (keyPath === 'date') {
        return { name: 'date', widget: 'datetime', i18n: 'duplicate' };
      }

      return undefined;
    });
  });

  describe('revertChanges', () => {
    it('should revert all fields in all locales', () => {
      revertChanges();

      expect(mockUpdate).toHaveBeenCalled();
      expect(mockEntryDraft.currentValues.en.title).toBe('Original Title');
      expect(mockEntryDraft.currentValues.en.body).toBe('Original Body');
      expect(mockEntryDraft.currentValues.ja.title).toBe('Original Japanese Title');
    });

    it('should revert all fields in specific locale', () => {
      revertChanges({ locale: 'en' });

      expect(mockUpdate).toHaveBeenCalled();
      expect(mockEntryDraft.currentValues.en.title).toBe('Original Title');
      expect(mockEntryDraft.currentValues.en.body).toBe('Original Body');
    });

    it('should revert specific field in all locales', () => {
      revertChanges({ keyPath: 'title' });

      expect(mockUpdate).toHaveBeenCalled();
      expect(mockEntryDraft.currentValues.en.title).toBe('Original Title');
      expect(mockEntryDraft.currentValues.ja.title).toBe('Original Japanese Title');
    });

    it('should revert specific field in specific locale', () => {
      revertChanges({ locale: 'en', keyPath: 'title' });

      expect(mockUpdate).toHaveBeenCalled();
      expect(mockEntryDraft.currentValues.en.title).toBe('Original Title');
      // Other values should remain modified
      expect(mockEntryDraft.currentValues.en.body).toBe('Modified Body');
    });

    it('should only revert translatable fields in non-default locale', () => {
      revertChanges({ locale: 'ja' });

      expect(mockUpdate).toHaveBeenCalled();
      expect(mockEntryDraft.currentValues.ja.title).toBe('Original Japanese Title');
      expect(mockEntryDraft.currentValues.ja.body).toBe('Original Japanese Body');
    });

    it('should revert all fields including i18n-duplicate in default locale', () => {
      revertChanges({ locale: 'en' });

      expect(mockUpdate).toHaveBeenCalled();
      expect(mockEntryDraft.currentValues.en.title).toBe('Original Title');
      expect(mockEntryDraft.currentValues.en.date).toBe('2024-01-01');
    });

    it('should handle empty keyPath as reverting all fields', () => {
      revertChanges({ locale: 'en', keyPath: '' });

      expect(mockUpdate).toHaveBeenCalled();
      expect(mockEntryDraft.currentValues.en.title).toBe('Original Title');
      expect(mockEntryDraft.currentValues.en.body).toBe('Original Body');
    });

    it('should handle nested field keyPaths', () => {
      mockEntryDraft.currentValues.en['metadata.author'] = 'Modified Author';
      mockEntryDraft.originalValues.en['metadata.author'] = 'Original Author';

      vi.mocked(getField).mockImplementation(({ keyPath }) => {
        if (keyPath === 'metadata.author') {
          return { name: 'author', widget: 'string', i18n: true };
        }

        return undefined;
      });

      revertChanges({ locale: 'en', keyPath: 'metadata.author' });

      expect(mockUpdate).toHaveBeenCalled();
      expect(mockEntryDraft.currentValues.en['metadata.author']).toBe('Original Author');
    });
  });
});
