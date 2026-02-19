import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * @import { ConfigParserCollectors } from '$lib/types/private';
 */

// Mock svelte-i18n
/** @type {Record<string, string>} */
const mockI18nStrings = {
  'config.error.file_format_mismatch': 'File format mismatch',
  'config.error.missing_field_names': 'Missing field name at position {count}',
  'config.error.invalid_field_names': 'Invalid field name: {name}',
  'config.error.duplicate_field_names': 'Duplicate field name: {name}',
  'config.error_locator.collection': 'Collection: {collection}',
  'config.error_locator.file': 'File: {file}',
  'config.error_locator.field': 'Field: {field}',
  'config.error.duplicate_collection_file_names': 'Duplicate file name: {name}',
};

/**
 * Mock translation function.
 * @param {string} key Message key.
 * @param {object & { values?: Record<string, string> }} [options] Options.
 * @returns {string} Translated string.
 */
function mockTranslate(key, options) {
  let message = mockI18nStrings[key] || key;

  if (options?.values) {
    Object.entries(options.values).forEach(([k, v]) => {
      message = message.replace(`{${k}}`, v);
    });
  }

  return message;
}

vi.mock('svelte-i18n', () => ({
  _: {
    subscribe: vi.fn((fn) => {
      fn(mockTranslate);

      return () => {};
    }),
  },
  locale: {
    subscribe: vi.fn((fn) => {
      fn('en-US');

      return () => {};
    }),
  },
}));

const mockGetStore = vi.fn();

vi.mock('svelte/store', () => ({
  get: mockGetStore,
}));

const mockParseFields = vi.fn();

vi.mock('$lib/services/config/parser/fields', () => ({
  parseFields: mockParseFields,
}));

const mockIsFormatMismatch = vi.fn();

vi.mock('$lib/services/config/parser/collections/format', () => ({
  isFormatMismatch: mockIsFormatMismatch,
}));

const mockAddMessage = vi.fn();
const mockCheckName = vi.fn();

vi.mock('$lib/services/config/parser/utils/validator', () => ({
  addMessage: mockAddMessage,
  checkName: mockCheckName,
}));

/**
 * Create a fresh collectors object for testing.
 * @returns {ConfigParserCollectors} Collectors instance.
 */
function createCollectors() {
  return {
    errors: new Set(),
    warnings: new Set(),
    mediaFields: new Set(),
    relationFields: new Set(),
  };
}

describe('Collection Files Parser', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetStore.mockImplementation((store) => {
      // Handle the i18n store
      if (store && typeof store.subscribe === 'function') {
        let result;

        store.subscribe((/** @type {any} */ value) => {
          result = value;
        })();

        return result;
      }

      return store;
    });

    mockCheckName.mockReturnValue(true);
  });

  describe('parseCollectionFile', () => {
    it('should parse field configurations in a collection file', async () => {
      const { parseCollectionFile } = await import('./index.js');
      const collectors = createCollectors();

      /** @type {any} */
      const context = {
        cmsConfig: {},
        collection: { name: 'posts', format: 'yaml' },
        collectionFile: {
          name: 'post',
          file: 'content/posts/index.yaml',
          format: 'yaml',
          fields: [
            { name: 'title', widget: 'string' },
            { name: 'body', widget: 'text' },
          ],
        },
      };

      parseCollectionFile(context, collectors);

      expect(mockParseFields).toHaveBeenCalledWith(
        context.collectionFile.fields,
        context,
        collectors,
      );
    });

    it('should use inherited format from collection if file format is not specified', async () => {
      const { parseCollectionFile } = await import('./index.js');
      const collectors = createCollectors();

      /** @type {any} */
      const context = {
        cmsConfig: {},
        collection: { name: 'posts', format: 'json' },
        collectionFile: {
          name: 'post',
          file: 'content/posts/index.json',
          fields: [{ name: 'title', widget: 'string' }],
        },
      };

      parseCollectionFile(context, collectors);

      // isFormatMismatch should be called with extension 'json' and format 'json'
      expect(mockIsFormatMismatch).toHaveBeenCalledWith('json', 'json', [
        { name: 'title', widget: 'string' },
      ]);
    });

    it('should detect format mismatch between file extension and format', async () => {
      const { parseCollectionFile } = await import('./index.js');
      const collectors = createCollectors();

      mockIsFormatMismatch.mockReturnValue(true);

      /** @type {any} */
      const context = {
        cmsConfig: {},
        collection: { name: 'posts', format: 'yaml' },
        collectionFile: {
          name: 'post',
          file: 'content/posts/index.json',
          format: 'yaml',
          fields: [],
        },
      };

      parseCollectionFile(context, collectors);

      expect(mockAddMessage).toHaveBeenCalled();

      const callArgs = mockAddMessage.mock.calls[0][0];

      expect(callArgs.strKey).toBe('file_format_mismatch');
      expect(callArgs.values.extension).toBe('json');
      expect(callArgs.values.format).toBe('yaml');
    });

    it('should always parse fields regardless of format mismatch', async () => {
      const { parseCollectionFile } = await import('./index.js');
      const collectors = createCollectors();

      mockIsFormatMismatch.mockReturnValue(true);

      /** @type {any} */
      const context = {
        cmsConfig: {},
        collection: { name: 'posts', format: 'yaml' },
        collectionFile: {
          name: 'post',
          file: 'content/posts/index.json',
          format: 'yaml',
          fields: [{ name: 'title', widget: 'string' }],
        },
      };

      parseCollectionFile(context, collectors);

      expect(mockParseFields).toHaveBeenCalled();
    });
  });

  describe('parseCollectionFiles', () => {
    it('should parse multiple collection files', async () => {
      const { parseCollectionFiles } = await import('./index.js');
      const collectors = createCollectors();

      /** @type {any} */
      const context = {
        cmsConfig: {},
        collection: {
          name: 'posts',
          format: 'yaml',
          files: [
            {
              name: 'post1',
              file: 'content/posts/index.yaml',
              fields: [],
            },
            {
              name: 'post2',
              file: 'content/pages/about.yaml',
              fields: [],
            },
          ],
        },
      };

      parseCollectionFiles(context, collectors);

      // checkName should be called for each non-divider file
      expect(mockCheckName).toHaveBeenCalledTimes(2);
    });

    it('should skip divider entries', async () => {
      const { parseCollectionFiles } = await import('./index.js');
      const collectors = createCollectors();

      /** @type {any} */
      const context = {
        cmsConfig: {},
        collection: {
          name: 'posts',
          format: 'yaml',
          files: [
            {
              name: 'post1',
              file: 'content/posts/index.yaml',
              fields: [],
            },
            {
              divider: true,
            },
            {
              name: 'post2',
              file: 'content/pages/about.yaml',
              fields: [],
            },
          ],
        },
      };

      parseCollectionFiles(context, collectors);

      // checkName should only be called for non-divider files
      expect(mockCheckName).toHaveBeenCalledTimes(2);

      // Verify divider was skipped (not parsed)
      expect(mockCheckName).not.toHaveBeenCalledWith(
        expect.objectContaining({
          name: undefined,
        }),
      );
    });

    it('should validate file names for duplicates', async () => {
      const { parseCollectionFiles } = await import('./index.js');
      const collectors = createCollectors();

      /** @type {any} */
      const context = {
        cmsConfig: {},
        collection: {
          name: 'posts',
          format: 'yaml',
          files: [
            {
              name: 'post',
              file: 'content/posts/index.yaml',
              fields: [],
            },
            {
              name: 'post',
              file: 'content/posts/duplicate.yaml',
              fields: [],
            },
          ],
        },
      };

      parseCollectionFiles(context, collectors);

      expect(mockCheckName).toHaveBeenCalledTimes(2);

      // The second call should return false due to duplicate
      const secondCall = mockCheckName.mock.calls[1][0];

      expect(secondCall.name).toBe('post');
      expect(secondCall.index).toBe(1);
    });

    it('should skip parsing files when checkName returns false', async () => {
      const { parseCollectionFiles } = await import('./index.js');
      const collectors = createCollectors();

      mockCheckName.mockReturnValueOnce(true).mockReturnValueOnce(false);

      /** @type {any} */
      const context = {
        cmsConfig: {},
        collection: {
          name: 'posts',
          format: 'yaml',
          files: [
            {
              name: 'post1',
              file: 'content/posts/index.yaml',
              fields: [{ name: 'title', widget: 'string' }],
            },
            {
              name: 'post2',
              file: 'content/posts/duplicate.yaml',
              fields: [{ name: 'title', widget: 'string' }],
            },
          ],
        },
      };

      parseCollectionFiles(context, collectors);

      // First file should be parsed, second should not
      // Check that fields were parsed only once
      expect(mockParseFields).toHaveBeenCalledTimes(1);
    });

    it('should pass correct context to checkName including file info', async () => {
      const { parseCollectionFiles } = await import('./index.js');
      const collectors = createCollectors();

      /** @type {any} */
      const context = {
        cmsConfig: {},
        collection: {
          name: 'posts',
          format: 'yaml',
          files: [
            {
              name: 'my-file',
              file: 'content/posts/index.yaml',
              fields: [],
            },
          ],
        },
      };

      parseCollectionFiles(context, collectors);

      const callArgs = mockCheckName.mock.calls[0][0];

      expect(callArgs.name).toBe('my-file');
      expect(callArgs.index).toBe(0);
      expect(callArgs.context.collection.name).toBe('posts');
    });

    it('should handle empty files array', async () => {
      const { parseCollectionFiles } = await import('./index.js');
      const collectors = createCollectors();

      /** @type {any} */
      const context = {
        cmsConfig: {},
        collection: {
          name: 'posts',
          format: 'yaml',
          files: [],
        },
      };

      parseCollectionFiles(context, collectors);

      expect(mockCheckName).not.toHaveBeenCalled();
    });
  });
});
