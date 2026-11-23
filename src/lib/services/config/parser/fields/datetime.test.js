import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createCollectors } from '$lib/test/config-parser';

/**
 * @import { ConfigParserContext } from '$lib/types/private';
 */

vi.mock('@sveltia/i18n', async () =>
  (await import('$lib/test/i18n')).createI18nMock({ locale: 'en-US' }),
);

const mockCheckUnsupportedOptions = vi.fn();
const mockAddMessage = vi.fn();

vi.mock('$lib/services/config/parser/utils/validator', () => ({
  checkUnsupportedOptions: mockCheckUnsupportedOptions,
  addMessage: mockAddMessage,
}));

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

  describe('localize_format option', () => {
    /**
     * Parse a DateTime field with the given options.
     * @param {Record<string, any>} options Field options.
     * @param {object} [contextOverrides] Context overrides.
     * @returns {Promise<ReturnType<typeof createCollectors>>} Collectors.
     */
    const parse = async (options, contextOverrides = {}) => {
      const { parseDateTimeFieldConfig } = await import('./datetime.js');
      const collectors = createCollectors();

      parseDateTimeFieldConfig({
        config: { name: 'date', widget: 'datetime', ...options },
        context: createContext(contextOverrides),
        collectors,
      });

      return collectors;
    };

    const i18nContext = {
      cmsConfig: { i18n: { structure: 'multiple_files', locales: ['en', 'de', 'ja'] } },
      collection: { name: 'posts', label: 'Posts', i18n: true },
    };

    it('does nothing without the option', async () => {
      const collectors = await parse({ format: 'D MMMM YYYY', localize_format: false });

      expect(mockAddMessage).not.toHaveBeenCalled();
      expect([...collectors.formatLocales]).toEqual([]);
    });

    it('collects a locale given as the option', async () => {
      const collectors = await parse({ format: 'D MMMM YYYY', localize_format: 'pt-BR' });

      expect(mockAddMessage).not.toHaveBeenCalled();
      expect([...collectors.formatLocales]).toEqual(['pt-BR']);
    });

    it('also takes the date format', async () => {
      const collectors = await parse({ date_format: 'D MMMM YYYY', localize_format: 'de' });

      expect(mockAddMessage).not.toHaveBeenCalled();
      expect([...collectors.formatLocales]).toEqual(['de']);
    });

    it('warns about a locale Day.js doesn’t support', async () => {
      const collectors = await parse({ format: 'D MMMM YYYY', localize_format: 'xx' });

      expect(mockAddMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'warning',
          strKey: 'localize_format_unsupported_locale',
          values: { locale: 'xx' },
        }),
      );
      expect([...collectors.formatLocales]).toEqual([]);
    });

    it('warns about the option without a custom format', async () => {
      const collectors = await parse({ localize_format: true }, i18nContext);

      expect(mockAddMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'warning', strKey: 'localize_format_without_format' }),
      );
      expect([...collectors.formatLocales]).toEqual([]);
    });

    it('collects the locales of the collection with `true`', async () => {
      const collectors = await parse(
        { format: 'D MMMM YYYY', localize_format: true },
        {
          ...i18nContext,
          collection: { ...i18nContext.collection, i18n: { locales: ['en', 'de'] } },
        },
      );

      expect(mockAddMessage).not.toHaveBeenCalled();
      expect([...collectors.formatLocales]).toEqual(['en', 'de']);
    });

    it('collects the locales of the site for an editor component with `true`', async () => {
      const collectors = await parse(
        { format: 'D MMMM YYYY', localize_format: true },
        { cmsConfig: i18nContext.cmsConfig, collection: undefined, componentName: 'event' },
      );

      expect(mockAddMessage).not.toHaveBeenCalled();
      expect([...collectors.formatLocales]).toEqual(['en', 'de', 'ja']);
    });

    it('warns about `true` in a collection without i18n', async () => {
      const collectors = await parse(
        { format: 'D MMMM YYYY', localize_format: true },
        { cmsConfig: i18nContext.cmsConfig },
      );

      expect(mockAddMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'warning', strKey: 'localize_format_without_i18n' }),
      );
      expect([...collectors.formatLocales]).toEqual([]);
    });

    it('warns about `true` in an editor component on a site without i18n', async () => {
      await parse(
        { format: 'D MMMM YYYY', localize_format: true },
        { collection: undefined, componentName: 'event' },
      );

      expect(mockAddMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'warning', strKey: 'localize_format_without_i18n' }),
      );
    });
  });
});
