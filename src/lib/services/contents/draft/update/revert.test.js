// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { entryDraft } from '$lib/services/contents/draft';
import { getField } from '$lib/services/contents/entry/fields';

import { revertChanges, revertFields, revertLocale } from './revert';

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

  describe('revertFields (internal)', () => {
    it('should reset fields when reset=true', () => {
      const currentValues = {
        en: {
          title: 'Modified Title',
          body: 'Modified Body',
        },
      };

      revertFields({
        locale: 'en',
        isDefaultLocale: true,
        keyPath: '',
        getFieldArgs: {
          valueMap: { title: 'Current Title', body: 'Current Body' },
          collectionName: 'posts',
          fileName: undefined,
          keyPath: '',
          isIndexFile: false,
        },
        currentValues,
        reset: true,
      });

      expect(currentValues.en.title).toBeUndefined();
      expect(currentValues.en.body).toBeUndefined();
    });

    it('should restore values when reset=false', () => {
      const currentValues = {
        en: {
          title: 'Modified Title',
        },
      };

      revertFields({
        locale: 'en',
        isDefaultLocale: true,
        keyPath: '',
        getFieldArgs: {
          valueMap: { title: 'Original Title', body: 'Original Body' },
          collectionName: 'posts',
          fileName: undefined,
          keyPath: '',
          isIndexFile: false,
        },
        currentValues,
        reset: false,
      });

      expect(currentValues.en.title).toBe('Original Title');
      expect(currentValues.en.body).toBe('Original Body');
    });

    it('should only revert fields matching keyPath', () => {
      const currentValues = {
        en: {
          title: 'Modified Title',
          body: 'Modified Body',
          'metadata.author': 'Modified Author',
        },
      };

      revertFields({
        locale: 'en',
        isDefaultLocale: true,
        keyPath: 'metadata',
        getFieldArgs: {
          valueMap: {
            title: 'Original Title',
            body: 'Original Body',
            'metadata.author': 'Original Author',
          },
          collectionName: 'posts',
          fileName: undefined,
          keyPath: '',
          isIndexFile: false,
        },
        currentValues,
        reset: false,
      });

      expect(currentValues.en.title).toBe('Modified Title');
      expect(currentValues.en.body).toBe('Modified Body');
      expect(currentValues.en['metadata.author']).toBe('Original Author');
    });

    it('should only revert translatable fields in non-default locale', () => {
      const currentValues = {
        ja: {
          title: 'Modified Japanese Title',
          date: 'Modified Date',
        },
      };

      vi.mocked(getField).mockImplementation(({ keyPath }) => {
        if (keyPath === 'title') {
          return { name: 'title', widget: 'string', i18n: 'translate' };
        }

        if (keyPath === 'date') {
          return { name: 'date', widget: 'datetime', i18n: 'duplicate' };
        }

        return undefined;
      });

      revertFields({
        locale: 'ja',
        isDefaultLocale: false,
        keyPath: '',
        getFieldArgs: {
          valueMap: {
            title: 'Original Japanese Title',
            date: 'Original Date',
          },
          collectionName: 'posts',
          fileName: undefined,
          keyPath: '',
          isIndexFile: false,
        },
        currentValues,
        reset: false,
      });

      expect(currentValues.ja.title).toBe('Original Japanese Title');
      expect(currentValues.ja.date).toBe('Modified Date');
    });

    it('should revert all fields in default locale', () => {
      const currentValues = {
        en: {
          title: 'Modified Title',
          date: 'Modified Date',
        },
      };

      vi.mocked(getField).mockImplementation(({ keyPath }) => {
        if (keyPath === 'title') {
          return { name: 'title', widget: 'string', i18n: 'translate' };
        }

        if (keyPath === 'date') {
          return { name: 'date', widget: 'datetime', i18n: 'duplicate' };
        }

        return undefined;
      });

      revertFields({
        locale: 'en',
        isDefaultLocale: true,
        keyPath: '',
        getFieldArgs: {
          valueMap: {
            title: 'Original Title',
            date: 'Original Date',
          },
          collectionName: 'posts',
          fileName: undefined,
          keyPath: '',
          isIndexFile: false,
        },
        currentValues,
        reset: false,
      });

      expect(currentValues.en.title).toBe('Original Title');
      expect(currentValues.en.date).toBe('Original Date');
    });

    it('should handle i18n=true fields', () => {
      const currentValues = {
        ja: {
          body: 'Modified Body',
        },
      };

      vi.mocked(getField).mockImplementation(({ keyPath }) => {
        if (keyPath === 'body') {
          return { name: 'body', widget: 'markdown', i18n: true };
        }

        return undefined;
      });

      revertFields({
        locale: 'ja',
        isDefaultLocale: false,
        keyPath: '',
        getFieldArgs: {
          valueMap: { body: 'Original Body' },
          collectionName: 'posts',
          fileName: undefined,
          keyPath: '',
          isIndexFile: false,
        },
        currentValues,
        reset: false,
      });

      expect(currentValues.ja.body).toBe('Original Body');
    });
  });

  describe('revertLocale (internal)', () => {
    it('should reset and restore values for a locale', () => {
      const draft = {
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
          },
        },
        originalValues: {
          en: {
            title: 'Original Title',
            body: 'Original Body',
            date: '2024-01-01',
          },
        },
      };

      revertLocale({ draft, keyPath: '', locale: 'en' });

      expect(draft.currentValues.en.title).toBe('Original Title');
      expect(draft.currentValues.en.body).toBe('Original Body');
      expect(draft.currentValues.en.date).toBe('2024-01-01');
    });

    it('should handle specific keyPath', () => {
      const draft = {
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
          },
        },
        originalValues: {
          en: {
            title: 'Original Title',
            body: 'Original Body',
          },
        },
      };

      revertLocale({ draft, keyPath: 'title', locale: 'en' });

      expect(draft.currentValues.en.title).toBe('Original Title');
      expect(draft.currentValues.en.body).toBe('Modified Body');
    });

    it('should use collectionFile i18n config when available', () => {
      const draft = {
        collection: {
          _i18n: {
            defaultLocale: 'en',
            allLocales: ['en', 'ja'],
          },
        },
        collectionFile: {
          _i18n: {
            defaultLocale: 'fr',
            allLocales: ['fr', 'de'],
          },
        },
        collectionName: 'pages',
        fileName: 'about',
        isIndexFile: false,
        currentValues: {
          fr: {
            title: 'Modified French Title',
          },
        },
        originalValues: {
          fr: {
            title: 'Original French Title',
          },
        },
      };

      revertLocale({ draft, keyPath: '', locale: 'fr' });

      expect(draft.currentValues.fr.title).toBe('Original French Title');
    });

    it('should handle non-default locale correctly', () => {
      const draft = {
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
          ja: {
            title: 'Modified Japanese Title',
            date: 'Modified Date',
          },
        },
        originalValues: {
          ja: {
            title: 'Original Japanese Title',
            date: 'Original Date',
          },
        },
      };

      vi.mocked(getField).mockImplementation(({ keyPath }) => {
        if (keyPath === 'title') {
          return { name: 'title', widget: 'string', i18n: 'translate' };
        }

        if (keyPath === 'date') {
          return { name: 'date', widget: 'datetime', i18n: 'duplicate' };
        }

        return undefined;
      });

      revertLocale({ draft, keyPath: '', locale: 'ja' });

      expect(draft.currentValues.ja.title).toBe('Original Japanese Title');
      expect(draft.currentValues.ja.date).toBe('Modified Date');
    });
  });
});
