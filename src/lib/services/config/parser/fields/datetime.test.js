/* eslint-disable jsdoc/require-jsdoc */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * @import { ConfigParserCollectors, ConfigParserContext } from '$lib/types/private';
 */

vi.mock('@sveltia/i18n', () => ({
  _: (/** @type {string} */ key) => key,
  locale: { current: 'en-US', set: vi.fn() },
}));

const mockCheckUnsupportedOptions = vi.fn();
const mockAddMessage = vi.fn();

vi.mock('$lib/services/config/parser/utils/validator', () => ({
  checkUnsupportedOptions: mockCheckUnsupportedOptions,
  addMessage: mockAddMessage,
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
 * @param {object} [overrides] Optional overrides for context properties.
 * @returns {ConfigParserContext} Context instance.
 */
function createContext(overrides = {}) {
  return {
    cmsConfig: { backend: { name: 'github', repo: 'test/repo' } },
    collection: { name: 'posts', files: [], label: 'Posts' },
    typedKeyPath: 'config.collections.0.fields.0',
    ...overrides,
  };
}

describe('DateTime Field Parser', () => {
  /** @type {any} */
  let consoleErrorSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('parseDateTimeFieldConfig', () => {
    it('should check unsupported options', async () => {
      const { parseDateTimeFieldConfig } = await import('./datetime.js');
      const context = createContext();
      const collectors = createCollectors();

      const args = {
        config: {
          name: 'published_date',
          widget: 'datetime',
        },
        context,
        collectors,
      };

      parseDateTimeFieldConfig(args);

      expect(mockCheckUnsupportedOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          config: args.config,
          context,
          collectors,
          UNSUPPORTED_OPTIONS: expect.any(Array),
        }),
      );
    });

    it('should pass with valid IANA timezone identifier', async () => {
      const { parseDateTimeFieldConfig } = await import('./datetime.js');
      const context = createContext();
      const collectors = createCollectors();

      const args = {
        config: {
          name: 'published_date',
          widget: 'datetime',
          input_timezone: 'America/New_York',
        },
        context,
        collectors,
      };

      parseDateTimeFieldConfig(args);

      expect(mockAddMessage).not.toHaveBeenCalled();
    });

    it('should log error for invalid timezone identifier', async () => {
      const { parseDateTimeFieldConfig } = await import('./datetime.js');
      const context = createContext();
      const collectors = createCollectors();

      const args = {
        config: {
          name: 'published_date',
          widget: 'datetime',
          input_timezone: 'Invalid/Timezone',
        },
        context,
        collectors,
      };

      parseDateTimeFieldConfig(args);

      expect(mockAddMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          strKey: 'invalid_timezone',
          values: { timeZone: 'Invalid/Timezone' },
        }),
      );
    });

    it('should include collection name in error message', async () => {
      const { parseDateTimeFieldConfig } = await import('./datetime.js');

      const context = createContext({
        collection: { name: 'blog_posts', files: [], label: 'Blog Posts' },
      });

      const collectors = createCollectors();

      const args = {
        config: {
          name: 'published_date',
          widget: 'datetime',
          input_timezone: 'Invalid/Timezone',
        },
        context,
        collectors,
      };

      parseDateTimeFieldConfig(args);

      expect(mockAddMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          strKey: 'invalid_timezone',
        }),
      );
    });

    it('should include collection file name in error message', async () => {
      const { parseDateTimeFieldConfig } = await import('./datetime.js');

      const context = createContext({
        collection: { name: 'pages', files: [], label: 'Pages' },
        collectionFile: { name: 'about', label: 'About Page' },
      });

      const collectors = createCollectors();

      const args = {
        config: {
          name: 'updated_date',
          widget: 'datetime',
          input_timezone: 'Invalid/Timezone',
        },
        context,
        collectors,
      };

      parseDateTimeFieldConfig(args);

      expect(mockAddMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          strKey: 'invalid_timezone',
        }),
      );
    });

    it('should use "config" as location when no collection info available', async () => {
      const { parseDateTimeFieldConfig } = await import('./datetime.js');

      const context = createContext({
        collection: undefined,
      });

      const collectors = createCollectors();

      const args = {
        config: {
          name: 'date',
          widget: 'datetime',
          input_timezone: 'Invalid/Timezone',
        },
        context,
        collectors,
      };

      parseDateTimeFieldConfig(args);

      expect(mockAddMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          strKey: 'invalid_timezone',
        }),
      );
    });

    it('should handle timezone validation with various IANA identifiers', async () => {
      const { parseDateTimeFieldConfig } = await import('./datetime.js');
      const context = createContext();
      const collectors = createCollectors();

      const validTimezones = [
        'UTC',
        'GMT',
        'America/Los_Angeles',
        'Europe/Paris',
        'Asia/Kolkata',
        'Pacific/Auckland',
        'Africa/Cairo',
      ];

      validTimezones.forEach((timezone) => {
        const args = {
          config: {
            name: 'date',
            widget: 'datetime',
            input_timezone: timezone,
          },
          context,
          collectors,
        };

        parseDateTimeFieldConfig(args);
      });

      expect(mockAddMessage).not.toHaveBeenCalled();
    });

    it('should warn when both picker_utc and input_timezone are set', async () => {
      const { parseDateTimeFieldConfig } = await import('./datetime.js');
      const context = createContext();
      const collectors = createCollectors();

      const args = {
        config: {
          name: 'date',
          widget: 'datetime',
          picker_utc: true,
          input_timezone: 'America/New_York',
        },
        context,
        collectors,
      };

      parseDateTimeFieldConfig(args);

      expect(mockAddMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'warning',
          strKey: 'conflicting_timezone_options',
        }),
      );
    });

    it('should warn when both picker_utc and output_utc are set', async () => {
      const { parseDateTimeFieldConfig } = await import('./datetime.js');
      const context = createContext();
      const collectors = createCollectors();

      const args = {
        config: {
          name: 'date',
          widget: 'datetime',
          picker_utc: true,
          output_utc: true,
        },
        context,
        collectors,
      };

      parseDateTimeFieldConfig(args);

      expect(mockAddMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'warning',
          strKey: 'conflicting_timezone_options',
        }),
      );
    });
  });
});
