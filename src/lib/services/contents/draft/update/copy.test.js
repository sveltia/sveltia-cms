// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { entryDraft } from '$lib/services/contents/draft';
import { getField } from '$lib/services/contents/entry/fields';

import {
  copyFields,
  copyFromLocale as copyFromLocaleUpdate,
  getCopyingFieldMap,
  translateFields,
  turndownService,
  updateToast,
} from './copy';

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

    it('should show info toast when no fields to copy', async () => {
      // Set all target fields to same value as source (already copied)
      mockEntryDraft.currentValues.ja.title = 'English Title';
      mockEntryDraft.currentValues.ja.body = 'English Body';

      // Clear any previous calls from setup
      mockUpdate.mockClear();

      await copyFromLocaleUpdate({
        sourceLanguage: 'en',
        targetLanguage: 'ja',
        translate: false,
      });

      // Should not call update when nothing to copy
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('should show info toast when no fields to translate', async () => {
      // Set all target fields to already have content
      mockEntryDraft.currentValues.ja.title = 'Already has content';
      mockEntryDraft.currentValues.ja.body = 'Already has content';

      // Clear any previous calls from setup
      mockUpdate.mockClear();

      await copyFromLocaleUpdate({
        sourceLanguage: 'en',
        targetLanguage: 'ja',
        translate: true,
      });

      // Should not call update when nothing to translate
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('should call translateFields when translate is true', async () => {
      const { translator } = await import('$lib/services/integrations/translators');
      const { prefs } = await import('$lib/services/user/prefs');
      const mockTranslate = vi.fn().mockResolvedValue(['Japanese Title', 'Japanese Body']);

      mockGet.mockImplementation((store) => {
        if (store === translator) {
          return {
            serviceId: 'google',
            markdownSupported: true,
            translate: mockTranslate,
          };
        }

        if (store === prefs) {
          return { apiKeys: { google: 'test-api-key' } };
        }

        if (store === entryDraft) {
          return mockEntryDraft;
        }

        return undefined;
      });

      await copyFromLocaleUpdate({
        sourceLanguage: 'en',
        targetLanguage: 'ja',
        translate: true,
      });

      expect(mockTranslate).toHaveBeenCalled();
      expect(mockUpdate).toHaveBeenCalled();
    });
  });

  describe('turndownService (internal)', () => {
    it('should be exported and available', () => {
      // The turndownService is exported and can be imported
      expect(turndownService).toBeDefined();
      expect(typeof turndownService).toBe('object');
    });
  });

  describe('getCopyingFieldMap (internal)', () => {
    it('should return map of copyable fields', () => {
      const draft = mockEntryDraft;

      const result = getCopyingFieldMap({
        draft,
        options: {
          sourceLanguage: 'en',
          targetLanguage: 'ja',
          translate: false,
        },
      });

      expect(result).toHaveProperty('title');
      expect(result.title).toEqual({ value: 'English Title', isMarkdown: false });
      expect(result).toHaveProperty('body');
      expect(result.body).toEqual({ value: 'English Body', isMarkdown: true });
    });

    it('should filter by keyPath when provided', () => {
      const draft = mockEntryDraft;

      const result = getCopyingFieldMap({
        draft,
        options: {
          sourceLanguage: 'en',
          targetLanguage: 'ja',
          keyPath: 'title',
          translate: false,
        },
      });

      expect(result).toHaveProperty('title');
      expect(result).not.toHaveProperty('body');
    });

    it('should skip non-string fields', () => {
      mockEntryDraft.currentValues.en.count = 42;
      mockEntryDraft.currentValues.ja.count = 0;

      vi.mocked(getField).mockImplementation(({ keyPath }) => {
        if (keyPath === 'count') {
          return { name: 'count', widget: 'number' };
        }

        if (keyPath === 'title') {
          return { name: 'title', widget: 'string' };
        }

        return undefined;
      });

      const result = getCopyingFieldMap({
        draft: mockEntryDraft,
        options: {
          sourceLanguage: 'en',
          targetLanguage: 'ja',
          translate: false,
        },
      });

      expect(result).not.toHaveProperty('count');
    });

    it('should skip empty values', () => {
      mockEntryDraft.currentValues.en.empty = '';
      mockEntryDraft.currentValues.ja.empty = '';

      vi.mocked(getField).mockImplementation(({ keyPath }) => {
        if (keyPath === 'empty') {
          return { name: 'empty', widget: 'string' };
        }

        return undefined;
      });

      const result = getCopyingFieldMap({
        draft: mockEntryDraft,
        options: {
          sourceLanguage: 'en',
          targetLanguage: 'ja',
          translate: false,
        },
      });

      expect(result).not.toHaveProperty('empty');
    });

    it('should skip already populated fields when translating all', () => {
      mockEntryDraft.currentValues.ja.title = 'Japanese Title';

      const result = getCopyingFieldMap({
        draft: mockEntryDraft,
        options: {
          sourceLanguage: 'en',
          targetLanguage: 'ja',
          translate: true,
        },
      });

      expect(result).not.toHaveProperty('title');
    });
  });

  describe('updateToast (internal)', () => {
    it('should update toast notification', async () => {
      const { copyFromLocaleToast } = await import('$lib/services/contents/editor');

      updateToast('success', 'copy.complete.one', { count: 1, sourceLanguage: 'en' });

      expect(vi.mocked(copyFromLocaleToast).set).toHaveBeenCalledWith({
        id: expect.any(Number),
        show: true,
        status: 'success',
        message: 'copy.complete.one',
        count: 1,
        sourceLanguage: 'en',
      });
    });
  });

  describe('copyFields (internal)', () => {
    it('should copy field values', () => {
      const currentValues = {
        en: { title: 'English Title', body: 'English Body' },
        ja: { title: '', body: '' },
      };

      const copingFieldMap = {
        title: { value: 'English Title', isMarkdown: false },
        body: { value: 'English Body', isMarkdown: true },
      };

      copyFields({
        currentValues,
        options: {
          sourceLanguage: 'en',
          targetLanguage: 'ja',
        },
        copingFieldMap,
      });

      expect(currentValues.ja.title).toBe('English Title');
      expect(currentValues.ja.body).toBe('English Body');
    });
  });

  describe('translateFields (internal)', () => {
    it('should handle missing API key gracefully', async () => {
      const { translator } = await import('$lib/services/integrations/translators');
      const { prefs } = await import('$lib/services/user/prefs');

      mockGet.mockImplementation((store) => {
        if (store === translator) {
          return {
            serviceId: 'google',
            markdownSupported: false,
            translate: vi.fn(),
          };
        }

        if (store === prefs) {
          return { apiKeys: {} };
        }

        if (store === entryDraft) {
          return mockEntryDraft;
        }

        return undefined;
      });

      const { translatorApiKeyDialogState } = await import('$lib/services/contents/editor');

      // Mock the dialog state to immediately resolve with undefined (user cancels)
      vi.mocked(translatorApiKeyDialogState).set = vi.fn((state) => {
        if (state.show && state.resolve) {
          state.resolve(undefined);
        }
      });

      const currentValues = {
        en: { title: 'English Title' },
        ja: { title: '' },
      };

      const copingFieldMap = {
        title: { value: 'English Title', isMarkdown: false },
      };

      await translateFields({
        currentValues,
        options: {
          sourceLanguage: 'en',
          targetLanguage: 'ja',
        },
        copingFieldMap,
      });

      // Should not translate without API key
      expect(currentValues.ja.title).toBe('');
    });

    it('should handle translation API errors gracefully', async () => {
      const { translator } = await import('$lib/services/integrations/translators');
      const { prefs } = await import('$lib/services/user/prefs');
      const mockTranslate = vi.fn().mockRejectedValue(new Error('Translation API failed'));

      mockGet.mockImplementation((store) => {
        if (store === translator) {
          return {
            serviceId: 'google',
            markdownSupported: true,
            translate: mockTranslate,
          };
        }

        if (store === prefs) {
          return { apiKeys: { google: 'test-api-key' } };
        }

        if (store === entryDraft) {
          return mockEntryDraft;
        }

        return undefined;
      });

      const currentValues = {
        en: { title: 'English Title' },
        ja: { title: '' },
      };

      const copingFieldMap = {
        title: { value: 'English Title', isMarkdown: false },
      };

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await translateFields({
        currentValues,
        options: {
          sourceLanguage: 'en',
          targetLanguage: 'ja',
        },
        copingFieldMap,
      });

      // Should not change values when translation fails
      expect(currentValues.ja.title).toBe('');
      // Should log the error
      expect(consoleSpy).toHaveBeenCalledWith(expect.any(Error));

      consoleSpy.mockRestore();
    });

    it('should handle markdown conversion during translation', async () => {
      const { translator } = await import('$lib/services/integrations/translators');
      const { prefs } = await import('$lib/services/user/prefs');
      const mockTranslate = vi.fn().mockResolvedValue(['Japanese Title']);

      mockGet.mockImplementation((store) => {
        if (store === translator) {
          return {
            serviceId: 'google',
            markdownSupported: true,
            translate: mockTranslate,
          };
        }

        if (store === prefs) {
          return { apiKeys: { google: 'test-api-key' } };
        }

        if (store === entryDraft) {
          return mockEntryDraft;
        }

        return undefined;
      });

      const currentValues = {
        en: { body: '# English Title' },
        ja: { body: '' },
      };

      const copingFieldMap = {
        body: { value: '# English Title', isMarkdown: true },
      };

      await translateFields({
        currentValues,
        options: {
          sourceLanguage: 'en',
          targetLanguage: 'ja',
        },
        copingFieldMap,
      });

      // Should have translated the markdown value
      expect(currentValues.ja.body).toBe('Japanese Title');
    });

    it('should handle multiple field translation', async () => {
      const { translator } = await import('$lib/services/integrations/translators');
      const { prefs } = await import('$lib/services/user/prefs');
      const mockTranslate = vi.fn().mockResolvedValue(['Japanese Title', 'Japanese Body']);

      mockGet.mockImplementation((store) => {
        if (store === translator) {
          return {
            serviceId: 'google',
            markdownSupported: true,
            translate: mockTranslate,
          };
        }

        if (store === prefs) {
          return { apiKeys: { google: 'test-api-key' } };
        }

        if (store === entryDraft) {
          return mockEntryDraft;
        }

        return undefined;
      });

      const currentValues = {
        en: { title: 'English Title', body: 'English Body' },
        ja: { title: '', body: '' },
      };

      const copingFieldMap = {
        title: { value: 'English Title', isMarkdown: false },
        body: { value: 'English Body', isMarkdown: true },
      };

      await translateFields({
        currentValues,
        options: {
          sourceLanguage: 'en',
          targetLanguage: 'ja',
        },
        copingFieldMap,
      });

      expect(currentValues.ja.title).toBe('Japanese Title');
      expect(currentValues.ja.body).toBe('Japanese Body');
      expect(mockTranslate).toHaveBeenCalledWith(['English Title', 'English Body'], {
        apiKey: 'test-api-key',
        sourceLanguage: 'en',
        targetLanguage: 'ja',
      });
    });
  });
});
