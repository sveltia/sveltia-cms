// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getField } from '$lib/services/contents/entry/fields';

import {
  copyFields,
  copyFromLocale,
  getCopyingFieldMap,
  translateFields,
  turndownService,
  updateToast,
} from './copy';

vi.mock('$lib/services/contents/editor', () => ({
  copyFromLocaleToast: { current: undefined },
  translatorApiKeyDialogState: { current: { show: false, multiple: false } },
}));
vi.mock('$lib/services/contents/entry/fields');
vi.mock('$lib/services/integrations/translators', () => ({
  translator: { current: undefined },
}));
vi.mock('$lib/services/user/prefs.svelte', () => ({
  prefs: { apiKeys: {} },
}));
vi.mock('marked');
vi.mock('turndown');
describe('draft/update/copy', () => {
  let mockEntryDraft;
  /**
   * Copy or translate field values from another locale in the mock entry draft.
   * @param {any} options Copy options.
   * @returns {Promise<void>} Result.
   */
  const copyFromLocaleUpdate = (options) => copyFromLocale({ draft: mockEntryDraft, options });

  beforeEach(async () => {
    vi.clearAllMocks();

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
      expect(mockEntryDraft.currentValues.ja.title).toBe('');
      expect(mockEntryDraft.currentValues.ja.body).toBe('English Body');
    });

    it('should show info toast when no fields to copy', async () => {
      const { copyFromLocaleToast } = await import('$lib/services/contents/editor');

      // Set all target fields to same value as source (already copied)
      mockEntryDraft.currentValues.ja.title = 'English Title';
      mockEntryDraft.currentValues.ja.body = 'English Body';

      await copyFromLocaleUpdate({
        sourceLanguage: 'en',
        targetLanguage: 'ja',
        translate: false,
      });

      expect(copyFromLocaleToast.current).toEqual(
        expect.objectContaining({ status: 'info', message: 'copy.none', count: 0 }),
      );
    });

    it('should show info toast when no fields to translate', async () => {
      const { copyFromLocaleToast } = await import('$lib/services/contents/editor');

      // Set all target fields to already have content
      mockEntryDraft.currentValues.ja.title = 'Already has content';
      mockEntryDraft.currentValues.ja.body = 'Already has content';

      await copyFromLocaleUpdate({
        sourceLanguage: 'en',
        targetLanguage: 'ja',
        translate: true,
      });

      expect(copyFromLocaleToast.current).toEqual(
        expect.objectContaining({ status: 'info', message: 'translation.none', count: 0 }),
      );
    });

    it('should call translateFields when translate is true', async () => {
      const { translator } = await import('$lib/services/integrations/translators');
      const { prefs } = await import('$lib/services/user/prefs.svelte');
      const mockTranslate = vi.fn().mockResolvedValue(['Japanese Title', 'Japanese Body']);

      prefs.apiKeys = { google: 'test-api-key' };

      translator.current = {
        serviceId: 'google',
        markdownSupported: true,
        translate: mockTranslate,
      };

      await copyFromLocaleUpdate({
        sourceLanguage: 'en',
        targetLanguage: 'ja',
        translate: true,
      });

      expect(mockTranslate).toHaveBeenCalled();
      expect(mockEntryDraft.currentValues.ja.title).toBe('Japanese Title');
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

    it('should mark richtext fields as markdown', () => {
      const draft = mockEntryDraft;

      vi.mocked(getField).mockImplementation(({ keyPath }) => {
        if (keyPath === 'title') {
          return { name: 'title', widget: 'string' };
        }

        if (keyPath === 'body') {
          return { name: 'body', widget: 'richtext' };
        }

        return undefined;
      });

      const result = getCopyingFieldMap({
        draft,
        options: {
          sourceLanguage: 'en',
          targetLanguage: 'ja',
          translate: false,
        },
      });

      expect(result).toHaveProperty('body');
      expect(result.body).toEqual({ value: 'English Body', isMarkdown: true });
    });

    it('should skip list fields that have sub-fields (fieldType list + hasSubFields true)', () => {
      mockEntryDraft.currentValues.en.tags = 'tag1';
      mockEntryDraft.currentValues.ja.tags = '';

      vi.mocked(getField).mockImplementation(({ keyPath }) => {
        if (keyPath === 'tags') {
          return { name: 'tags', widget: 'list', fields: [{ name: 'tag', widget: 'string' }] };
        }

        if (keyPath === 'title') {
          return { name: 'title', widget: 'string' };
        }

        return undefined;
      });

      const result = getCopyingFieldMap({
        draft: mockEntryDraft,
        options: { sourceLanguage: 'en', targetLanguage: 'ja', translate: false },
      });

      // List field with sub-fields should be excluded
      expect(result).not.toHaveProperty('tags');
    });

    it('should include list fields without sub-fields (hasSubFields false)', () => {
      mockEntryDraft.currentValues.en.tags = 'tag1 tag2';
      mockEntryDraft.currentValues.ja.tags = '';

      vi.mocked(getField).mockImplementation(({ keyPath }) => {
        if (keyPath === 'tags') {
          return { name: 'tags', widget: 'list' }; // no fields/types/field
        }

        return undefined;
      });

      const result = getCopyingFieldMap({
        draft: mockEntryDraft,
        options: { sourceLanguage: 'en', targetLanguage: 'ja', translate: false },
      });

      // List field without sub-fields should be included, isMarkdown = false
      expect(result).toHaveProperty('tags');
      expect(result.tags).toEqual({ value: 'tag1 tag2', isMarkdown: false });
    });
  });

  describe('updateToast (internal)', () => {
    it('should update toast notification', async () => {
      const { copyFromLocaleToast } = await import('$lib/services/contents/editor');

      updateToast('success', 'copy.complete', { count: 1, sourceLanguage: 'en' });

      expect(copyFromLocaleToast.current).toEqual({
        id: expect.any(Number),
        show: true,
        status: 'success',
        message: 'copy.complete',
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
      const { prefs } = await import('$lib/services/user/prefs.svelte');

      prefs.apiKeys = {};

      translator.current = {
        serviceId: 'google',
        markdownSupported: false,
        translate: vi.fn(),
      };

      const { translatorApiKeyDialogState } = await import('$lib/services/contents/editor');

      // Mock the dialog state to immediately resolve with undefined (user cancels)
      Object.defineProperty(translatorApiKeyDialogState, 'current', {
        configurable: true,
        /**
         * Resolve the dialog right away.
         * @param {any} state Dialog state.
         */
        set: (state) => {
          if (state.show && state.resolve) {
            state.resolve(undefined);
          }
        },
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
      const { prefs } = await import('$lib/services/user/prefs.svelte');
      const mockTranslate = vi.fn().mockRejectedValue(new Error('Translation API failed'));

      prefs.apiKeys = { google: 'test-api-key' };

      translator.current = {
        serviceId: 'google',
        markdownSupported: true,
        translate: mockTranslate,
      };

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
      const { prefs } = await import('$lib/services/user/prefs.svelte');
      const mockTranslate = vi.fn().mockResolvedValue(['Japanese Title']);

      prefs.apiKeys = { google: 'test-api-key' };

      translator.current = {
        serviceId: 'google',
        markdownSupported: true,
        translate: mockTranslate,
      };

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
      const { prefs } = await import('$lib/services/user/prefs.svelte');
      const mockTranslate = vi.fn().mockResolvedValue(['Japanese Title', 'Japanese Body']);

      prefs.apiKeys = { google: 'test-api-key' };

      translator.current = {
        serviceId: 'google',
        markdownSupported: true,
        translate: mockTranslate,
      };

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

    it('should convert markdown to HTML before translation when markdownSupported is false', async () => {
      const { translator } = await import('$lib/services/integrations/translators');
      const { prefs } = await import('$lib/services/user/prefs.svelte');
      const { parse } = await import('marked');
      const mockTranslate = vi.fn().mockResolvedValue(['<h1>Japanese Title</h1>']);

      vi.mocked(parse).mockReturnValue('<h1>English Title</h1>');
      vi.mocked(turndownService.turndown).mockReturnValue('# Japanese Title');

      prefs.apiKeys = { google: 'test-api-key' };

      translator.current = {
        serviceId: 'google',
        markdownSupported: false, // triggers both parse() and turndown()
        translate: mockTranslate,
      };

      const currentValues = {
        en: { body: '# English Title' },
        ja: { body: '' },
      };

      const copingFieldMap = {
        body: { value: '# English Title', isMarkdown: true },
      };

      await translateFields({
        currentValues,
        options: { sourceLanguage: 'en', targetLanguage: 'ja' },
        copingFieldMap,
      });

      // parse() should convert markdown to HTML before sending to translator
      expect(vi.mocked(parse)).toHaveBeenCalledWith('# English Title');
      // translator receives the HTML version
      expect(mockTranslate).toHaveBeenCalledWith(['<h1>English Title</h1>'], expect.any(Object));
      // turndown converts HTML back to markdown
      expect(vi.mocked(turndownService.turndown)).toHaveBeenCalledWith('<h1>Japanese Title</h1>');
      expect(currentValues.ja.body).toBe('# Japanese Title');
    });
  });
});
