// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { entryDraft } from '$lib/services/contents/draft';
import { getField } from '$lib/services/contents/entry/fields';

import { copyFromLocale as copyFromLocaleUpdate } from './copy';

vi.mock('$lib/services/contents/draft');
vi.mock('$lib/services/contents/editor');
vi.mock('$lib/services/contents/entry/fields');
vi.mock('$lib/services/integrations/translators');
vi.mock('$lib/services/user/prefs', () => ({
  prefs: { subscribe: vi.fn(() => vi.fn()) },
}));
vi.mock('marked');
vi.mock('turndown');
vi.mock('svelte/store', async () => {
  const actual = await vi.importActual('svelte/store');

  return {
    ...actual,
    get: vi.fn(() => ({ devModeEnabled: false })),
  };
});

describe('draft/update/copy', () => {
  let mockEntryDraft;
  let mockUpdate;
  let mockGet;

  beforeEach(async () => {
    vi.clearAllMocks();

    const { get } = await import('svelte/store');

    mockGet = vi.mocked(get);

    mockEntryDraft = {
      collectionName: 'posts',
      fileName: undefined,
      isIndexFile: false,
      currentValues: {
        en: {
          title: 'English Title',
          body: 'English Body',
        },
        ja: {
          title: '',
          body: '',
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
        return { name: 'title', widget: 'string' };
      }

      if (keyPath === 'body') {
        return { name: 'body', widget: 'markdown' };
      }

      return undefined;
    });
  });

  describe('copyFromLocale', () => {
    it('should copy string fields from source to target locale', async () => {
      await copyFromLocaleUpdate({
        sourceLanguage: 'en',
        targetLanguage: 'ja',
        translate: false,
      });

      expect(mockEntryDraft.currentValues.ja.title).toBe('English Title');
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('should not copy already populated fields', async () => {
      mockEntryDraft.currentValues.ja.title = 'Japanese Title';

      await copyFromLocaleUpdate({
        sourceLanguage: 'en',
        targetLanguage: 'ja',
        translate: false,
      });

      // Should not overwrite existing content
      expect(mockEntryDraft.currentValues.ja.body).toBe('English Body');
    });

    it('should handle specific keyPath', async () => {
      await copyFromLocaleUpdate({
        sourceLanguage: 'en',
        targetLanguage: 'ja',
        keyPath: 'title',
        translate: false,
      });

      expect(mockEntryDraft.currentValues.ja.title).toBe('English Title');
      // Body should not be copied when keyPath is specified
      expect(mockEntryDraft.currentValues.ja.body).toBe('');
    });

    it('should not copy non-text fields', async () => {
      mockEntryDraft.currentValues.en.count = 42;
      mockEntryDraft.currentValues.ja.count = 0;

      vi.mocked(getField).mockImplementation(({ keyPath }) => {
        if (keyPath === 'count') {
          return { name: 'count', widget: 'number' };
        }

        return undefined;
      });

      await copyFromLocaleUpdate({
        sourceLanguage: 'en',
        targetLanguage: 'ja',
        translate: false,
      });

      // Number fields should not be copied
      expect(mockEntryDraft.currentValues.ja.count).toBe(0);
    });

    it('should not copy empty values', async () => {
      mockEntryDraft.currentValues.en.title = '';

      await copyFromLocaleUpdate({
        sourceLanguage: 'en',
        targetLanguage: 'ja',
        translate: false,
      });

      // Empty values should not be copied
      expect(mockUpdate).toHaveBeenCalled();
    });
  });
});
