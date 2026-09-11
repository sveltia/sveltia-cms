// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getField } from '$lib/services/contents/entry/fields';

import {
  revertChanges as _revertChanges,
  resolveOriginalKeyPath,
  revertFields,
  revertLocale,
} from './revert';

vi.mock('$lib/services/contents/entry/fields');

describe('draft/update/revert', () => {
  let mockEntryDraft;
  /**
   * Revert changes made to the mock entry draft.
   * @param {any} [args] Arguments other than the draft.
   * @returns {void} Nothing.
   */
  const revertChanges = (args = {}) => _revertChanges({ draft: mockEntryDraft, ...args });

  beforeEach(async () => {
    vi.clearAllMocks();

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
    it('restores the folder the entry is filed in', () => {
      // Moving an entry with the path editor is a change of its own, so a full revert undoes it
      mockEntryDraft.originalPath = 'company';
      mockEntryDraft.currentPath = 'archive';

      revertChanges();

      expect(mockEntryDraft.currentPath).toBe('company');
    });

    it('restores the slugs', () => {
      // A slug edited with the slug editor names the file, or the folder in a nested collection, so
      // a full revert undoes the rename too
      mockEntryDraft.originalSlugs = { en: 'company', ja: 'kaisha' };
      mockEntryDraft.currentSlugs = { en: 'company', ja: 'kigyou' };

      revertChanges();

      const { currentSlugs } = mockEntryDraft;

      expect(currentSlugs).toEqual({ en: 'company', ja: 'kaisha' });
      // A copy, so that editing the slug again doesn’t alter the original
      expect(currentSlugs).not.toBe(mockEntryDraft.originalSlugs);
    });

    it('leaves the slugs alone when only one locale is reverted', () => {
      mockEntryDraft.originalSlugs = { en: 'company', ja: 'kaisha' };
      mockEntryDraft.currentSlugs = { en: 'company', ja: 'kigyou' };

      revertChanges({ locale: 'ja' });

      expect(mockEntryDraft.currentSlugs).toEqual({ en: 'company', ja: 'kigyou' });
    });

    it('leaves the folder alone when only one locale is reverted', () => {
      mockEntryDraft.originalPath = 'company';
      mockEntryDraft.currentPath = 'archive';

      revertChanges({ locale: 'en' });

      expect(mockEntryDraft.currentPath).toBe('archive');
    });

    it('leaves the folder alone when only one field is reverted', () => {
      mockEntryDraft.originalPath = 'company';
      mockEntryDraft.currentPath = 'archive';

      revertChanges({ keyPath: 'title' });

      expect(mockEntryDraft.currentPath).toBe('archive');
    });

    it('should revert all fields in all locales', () => {
      revertChanges();

      expect(mockEntryDraft.currentValues.en.title).toBe('Original Title');
      expect(mockEntryDraft.currentValues.en.body).toBe('Original Body');
      expect(mockEntryDraft.currentValues.ja.title).toBe('Original Japanese Title');
    });

    it('should revert all fields in specific locale', () => {
      revertChanges({ locale: 'en' });

      expect(mockEntryDraft.currentValues.en.title).toBe('Original Title');
      expect(mockEntryDraft.currentValues.en.body).toBe('Original Body');
    });

    it('should revert specific field in all locales', () => {
      revertChanges({ keyPath: 'title' });

      expect(mockEntryDraft.currentValues.en.title).toBe('Original Title');
      expect(mockEntryDraft.currentValues.ja.title).toBe('Original Japanese Title');
    });

    it('should revert specific field in specific locale', () => {
      revertChanges({ locale: 'en', keyPath: 'title' });

      expect(mockEntryDraft.currentValues.en.title).toBe('Original Title');
      // Other values should remain modified
      expect(mockEntryDraft.currentValues.en.body).toBe('Modified Body');
    });

    it('should only revert translatable fields in non-default locale', () => {
      revertChanges({ locale: 'ja' });

      expect(mockEntryDraft.currentValues.ja.title).toBe('Original Japanese Title');
      expect(mockEntryDraft.currentValues.ja.body).toBe('Original Japanese Body');
    });

    it('should revert all fields including i18n-duplicate in default locale', () => {
      revertChanges({ locale: 'en' });

      expect(mockEntryDraft.currentValues.en.title).toBe('Original Title');
      expect(mockEntryDraft.currentValues.en.date).toBe('2024-01-01');
    });

    it('should handle empty keyPath as reverting all fields', () => {
      revertChanges({ locale: 'en', keyPath: '' });

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

      expect(mockEntryDraft.currentValues.en['metadata.author']).toBe('Original Author');
    });

    describe('with KeyValue fields', () => {
      beforeEach(() => {
        vi.mocked(getField).mockImplementation(({ keyPath }) => {
          if (keyPath === 'labels') {
            return { name: 'labels', widget: 'keyvalue', i18n: true };
          }

          if (keyPath === 'metadata') {
            return { name: 'metadata', widget: 'keyvalue', i18n: 'duplicate_keys' };
          }

          return undefined;
        });

        mockEntryDraft.currentValues = {
          en: { 'labels.x': 'X2', 'metadata.a': '1', 'metadata.bee': '2', 'metadata.c': '3' },
          ja: { 'labels.y': 'Y2', 'metadata.a': 'いち', 'metadata.bee': 'に', 'metadata.c': '' },
        };

        mockEntryDraft.originalValues = {
          en: { 'labels.x': 'X', 'metadata.a': '1', 'metadata.b': '2' },
          ja: { 'labels.y': 'Y', 'metadata.a': 'イチ', 'metadata.b': 'ニ' },
        };
      });

      it('should revert the pairs of a translatable field in any locale', () => {
        revertChanges({ keyPath: 'labels' });

        expect(mockEntryDraft.currentValues.en['labels.x']).toBe('X');
        expect(mockEntryDraft.currentValues.ja['labels.y']).toBe('Y');
      });

      it('should mirror the keys reverted in the default locale to the other locales', () => {
        revertChanges({ locale: 'en', keyPath: 'metadata' });

        expect(mockEntryDraft.currentValues.en).toEqual({
          'labels.x': 'X2',
          'metadata.a': '1',
          'metadata.b': '2',
        });
        // The values are kept: `bee` is renamed back to `b`, and the added `c` is dropped
        expect(mockEntryDraft.currentValues.ja).toEqual({
          'labels.y': 'Y2',
          'metadata.a': 'いち',
          'metadata.b': 'に',
        });
      });

      it('should line up the pairs reverted in another locale with the default locale', () => {
        revertChanges({ locale: 'ja', keyPath: 'metadata' });

        expect(mockEntryDraft.currentValues.en).toEqual({
          'labels.x': 'X2',
          'metadata.a': '1',
          'metadata.bee': '2',
          'metadata.c': '3',
        });
        expect(mockEntryDraft.currentValues.ja).toEqual({
          'labels.y': 'Y2',
          'metadata.a': 'イチ',
          'metadata.bee': 'ニ',
          'metadata.c': '',
        });
      });

      it('should revert everything consistently', () => {
        revertChanges();

        expect(mockEntryDraft.currentValues).toEqual(mockEntryDraft.originalValues);
      });
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

    it('should not revert non-translatable fields in non-default locale', () => {
      const currentValues = {
        ja: {
          title: 'Modified Title',
          status: 'Modified Status',
        },
      };

      vi.mocked(getField).mockImplementation(({ keyPath }) => {
        if (keyPath === 'title') {
          return { name: 'title', widget: 'string', i18n: 'translate' };
        }

        if (keyPath === 'status') {
          return { name: 'status', widget: 'select', i18n: false };
        }

        return undefined;
      });

      revertFields({
        locale: 'ja',
        isDefaultLocale: false,
        keyPath: '',
        getFieldArgs: {
          valueMap: {
            title: 'Original Title',
            status: 'Original Status',
          },
          collectionName: 'posts',
          fileName: undefined,
          keyPath: '',
          isIndexFile: false,
        },
        currentValues,
        reset: false,
      });

      expect(currentValues.ja.title).toBe('Original Title');
      expect(currentValues.ja.status).toBe('Modified Status');
    });

    it('should not revert field with undefined i18n config in non-default locale', () => {
      const currentValues = {
        ja: {
          title: 'Modified Title',
          custom: 'Modified Custom',
        },
      };

      vi.mocked(getField).mockImplementation(({ keyPath }) => {
        if (keyPath === 'title') {
          return { name: 'title', widget: 'string', i18n: 'translate' };
        }

        if (keyPath === 'custom') {
          return { name: 'custom', widget: 'string' };
        }

        return undefined;
      });

      revertFields({
        locale: 'ja',
        isDefaultLocale: false,
        keyPath: '',
        getFieldArgs: {
          valueMap: {
            title: 'Original Title',
            custom: 'Original Custom',
          },
          collectionName: 'posts',
          fileName: undefined,
          keyPath: '',
          isIndexFile: false,
        },
        currentValues,
        reset: false,
      });

      expect(currentValues.ja.title).toBe('Original Title');
      expect(currentValues.ja.custom).toBe('Modified Custom');
    });

    it('should not revert field when getField returns undefined in non-default locale', () => {
      const currentValues = {
        ja: {
          title: 'Modified Title',
          unknown: 'Modified Unknown',
        },
      };

      vi.mocked(getField).mockImplementation(({ keyPath }) => {
        if (keyPath === 'title') {
          return { name: 'title', widget: 'string', i18n: 'translate' };
        }

        return undefined;
      });

      revertFields({
        locale: 'ja',
        isDefaultLocale: false,
        keyPath: '',
        getFieldArgs: {
          valueMap: {
            title: 'Original Title',
            unknown: 'Original Unknown',
          },
          collectionName: 'posts',
          fileName: undefined,
          keyPath: '',
          isIndexFile: false,
        },
        currentValues,
        reset: false,
      });

      expect(currentValues.ja.title).toBe('Original Title');
      expect(currentValues.ja.unknown).toBe('Modified Unknown');
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

  describe('resolveOriginalKeyPath', () => {
    it('should return undefined when no __sc_item_original_key_path exists', () => {
      const valueMap = {
        'checklist.0.label': 'Item 1',
        'checklist.1.label': 'Item 2',
      };

      expect(resolveOriginalKeyPath(valueMap, 'checklist.0.label')).toBeUndefined();
    });

    it('should return undefined for non-list key paths', () => {
      const valueMap = { title: 'Hello' };

      expect(resolveOriginalKeyPath(valueMap, 'title')).toBeUndefined();
    });

    it('should resolve original key path for reordered items', () => {
      const valueMap = {
        'checklist.0.label': 'Item 2',
        'checklist.0.__sc_item_original_key_path': 'checklist.1',
        'checklist.1.label': 'Item 1',
        'checklist.1.__sc_item_original_key_path': 'checklist.0',
      };

      expect(resolveOriginalKeyPath(valueMap, 'checklist.0.label')).toEqual({
        originalKeyPath: 'checklist.1.label',
        currentPrefix: 'checklist.0',
        originalPrefix: 'checklist.1',
      });

      expect(resolveOriginalKeyPath(valueMap, 'checklist.1.label')).toEqual({
        originalKeyPath: 'checklist.0.label',
        currentPrefix: 'checklist.1',
        originalPrefix: 'checklist.0',
      });
    });

    it('should resolve original key path for list item itself', () => {
      const valueMap = {
        'checklist.0.__sc_item_original_key_path': 'checklist.2',
      };

      expect(resolveOriginalKeyPath(valueMap, 'checklist.0')).toEqual({
        originalKeyPath: 'checklist.2',
        currentPrefix: 'checklist.0',
        originalPrefix: 'checklist.2',
      });
    });

    it('should resolve deeply nested key path', () => {
      const valueMap = {
        'sections.0.items.1.__sc_item_original_key_path': 'sections.0.items.0',
      };

      expect(resolveOriginalKeyPath(valueMap, 'sections.0.items.1.title')).toEqual({
        originalKeyPath: 'sections.0.items.0.title',
        currentPrefix: 'sections.0.items.1',
        originalPrefix: 'sections.0.items.0',
      });
    });
  });

  describe('revertLocale with reordered list items', () => {
    it('should revert a field inside a reordered list item using the original key path', () => {
      vi.mocked(getField).mockReturnValue({ name: 'label', widget: 'string', i18n: true });

      const draft = {
        collection: {
          _i18n: {
            defaultLocale: 'en',
            allLocales: ['en'],
          },
        },
        collectionFile: undefined,
        collectionName: 'posts',
        fileName: undefined,
        isIndexFile: false,
        currentValues: {
          en: {
            'checklist.0.label': 'Modified Item 2',
            'checklist.0.__sc_item_original_key_path': 'checklist.1',
            'checklist.0.__sc_item_id': 'uuid-b',
            'checklist.1.label': 'Item 1',
            'checklist.1.__sc_item_original_key_path': 'checklist.0',
            'checklist.1.__sc_item_id': 'uuid-a',
          },
        },
        originalValues: {
          en: {
            'checklist.0.label': 'Original Item 1',
            'checklist.1.label': 'Original Item 2',
          },
        },
      };

      revertLocale({ draft, keyPath: 'checklist.0.label', locale: 'en' });

      // Should restore from checklist.1 (original position) to checklist.0 (current position)
      expect(draft.currentValues.en['checklist.0.label']).toBe('Original Item 2');
      // Other values should remain unchanged
      expect(draft.currentValues.en['checklist.1.label']).toBe('Item 1');
    });

    it('should revert the whole list field regardless of reordering', () => {
      vi.mocked(getField).mockReturnValue({ name: 'label', widget: 'string', i18n: true });

      const draft = {
        collection: {
          _i18n: {
            defaultLocale: 'en',
            allLocales: ['en'],
          },
        },
        collectionFile: undefined,
        collectionName: 'posts',
        fileName: undefined,
        isIndexFile: false,
        currentValues: {
          en: {
            'checklist.0.label': 'Item 2',
            'checklist.0.__sc_item_original_key_path': 'checklist.1',
            'checklist.0.__sc_item_id': 'uuid-b',
            'checklist.1.label': 'Item 1',
            'checklist.1.__sc_item_original_key_path': 'checklist.0',
            'checklist.1.__sc_item_id': 'uuid-a',
          },
        },
        originalValues: {
          en: {
            'checklist.0.label': 'Original Item 1',
            'checklist.1.label': 'Original Item 2',
          },
        },
      };

      revertLocale({ draft, keyPath: 'checklist', locale: 'en' });

      // Should restore all original values
      expect(draft.currentValues.en['checklist.0.label']).toBe('Original Item 1');
      expect(draft.currentValues.en['checklist.1.label']).toBe('Original Item 2');
      // Internal tracking properties should be removed
      expect(draft.currentValues.en['checklist.0.__sc_item_original_key_path']).toBeUndefined();
      expect(draft.currentValues.en['checklist.1.__sc_item_original_key_path']).toBeUndefined();
    });

    it('should revert after item deletion', () => {
      vi.mocked(getField).mockReturnValue({ name: 'label', widget: 'string', i18n: true });

      const draft = {
        collection: {
          _i18n: {
            defaultLocale: 'en',
            allLocales: ['en'],
          },
        },
        collectionFile: undefined,
        collectionName: 'posts',
        fileName: undefined,
        isIndexFile: false,
        currentValues: {
          en: {
            // Item at index 0 was deleted; original item at index 1 shifted to index 0
            'checklist.0.label': 'Item 2',
            'checklist.0.__sc_item_original_key_path': 'checklist.1',
            'checklist.0.__sc_item_id': 'uuid-b',
          },
        },
        originalValues: {
          en: {
            'checklist.0.label': 'Original Item 1',
            'checklist.1.label': 'Original Item 2',
          },
        },
      };

      revertLocale({ draft, keyPath: 'checklist', locale: 'en' });

      // Should restore all original values
      expect(draft.currentValues.en['checklist.0.label']).toBe('Original Item 1');
      expect(draft.currentValues.en['checklist.1.label']).toBe('Original Item 2');
    });
  });
});
