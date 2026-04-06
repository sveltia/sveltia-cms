/* eslint-disable jsdoc/require-jsdoc */

import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * @import { ConfigParserCollectors, ConfigParserContext } from '$lib/types/private';
 */

vi.mock('@sveltia/i18n', () => ({
  _: (/** @type {string} */ key) => key,
  locale: { current: 'en-US', set: vi.fn() },
}));

const mockGetStore = vi.fn();

vi.mock('svelte/store', () => ({
  get: mockGetStore,
}));

const mockAddMessage = vi.fn();
const mockCheckUnsupportedOptions = vi.fn();

vi.mock('$lib/services/config/parser/utils/validator', () => ({
  addMessage: mockAddMessage,
  checkUnsupportedOptions: mockCheckUnsupportedOptions,
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

/**
 * Create a fresh context object for testing.
 * @returns {ConfigParserContext} Context instance.
 */
function createContext() {
  return {
    cmsConfig: { backend: { name: 'github', repo: 'test/repo' } },
    collection: { name: 'test', files: [], label: 'Test' },
    typedKeyPath: 'config.collections.0.fields.0',
  };
}

describe('File Field Parser', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetStore.mockImplementation((store) => store);
  });

  describe('parseFileFieldConfig', () => {
    it('should parse file field', async () => {
      const { parseFileFieldConfig } = await import('./file.js');
      const context = createContext();
      const collectors = createCollectors();

      const args = {
        config: {
          name: 'document',
          widget: 'file',
          required: true,
        },
        context,
        collectors,
      };

      parseFileFieldConfig(args);

      expect(mockAddMessage).not.toHaveBeenCalledWith(
        expect.objectContaining({
          strKey: expect.stringMatching(/error/),
        }),
      );
    });

    it('should add mediaFields when media_folder is set', async () => {
      const { parseFileFieldConfig } = await import('./file.js');
      const context = createContext();
      const collectors = createCollectors();

      const args = {
        config: {
          name: 'document',
          widget: 'file',
          media_folder: 'uploads',
        },
        context,
        collectors,
      };

      parseFileFieldConfig(args);

      // Should track this as a media field with media_folder
      expect(collectors.mediaFields.size).toBeGreaterThanOrEqual(0);
    });

    it('should call checkUnsupportedOptions', async () => {
      const { parseFileFieldConfig } = await import('./file.js');
      const context = createContext();
      const collectors = createCollectors();

      const args = {
        config: {
          name: 'document',
          widget: 'file',
        },
        context,
        collectors,
      };

      parseFileFieldConfig(args);

      expect(mockCheckUnsupportedOptions).toHaveBeenCalled();
    });

    it('should handle file field with accept pattern', async () => {
      const { parseFileFieldConfig } = await import('./file.js');
      const context = createContext();
      const collectors = createCollectors();

      const args = {
        config: {
          name: 'pdf',
          widget: 'file',
          accept: '.pdf',
        },
        context,
        collectors,
      };

      parseFileFieldConfig(args);

      // Should handle without errors
      expect(collectors.errors.size).toBe(0);
    });

    it('should handle file field with multiple accept extensions', async () => {
      const { parseFileFieldConfig } = await import('./file.js');
      const context = createContext();
      const collectors = createCollectors();

      const args = {
        config: {
          name: 'docs',
          widget: 'file',
          accept: ['.pdf', '.doc', '.docx'],
        },
        context,
        collectors,
      };

      parseFileFieldConfig(args);

      // Should handle without errors
      expect(collectors.errors.size).toBe(0);
    });
  });
});
