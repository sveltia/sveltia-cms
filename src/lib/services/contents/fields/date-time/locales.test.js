import dayjs from 'dayjs';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
  getDayjsLocaleKey,
  getFormatLocale,
  loadDayjsLocales,
} from '$lib/services/contents/fields/date-time/locales';

/**
 * @import { DateTimeField } from '$lib/types/public';
 */

const { loadLocaleData } = vi.hoisted(() => ({
  loadLocaleData: vi.fn(async (/** @type {string} */ key) => {
    if (key === 'fr') {
      throw new Error('Network error');
    }

    return (await import(`../../../../../../node_modules/dayjs/esm/locale/${key}.js`)).default;
  }),
}));

vi.mock('$lib/services/contents/fields/date-time/locale-loader', () => ({ loadLocaleData }));

/**
 * Create a DateTime field configuration.
 * @param {Partial<DateTimeField>} [props] Properties.
 * @returns {DateTimeField} Field configuration.
 */
const createField = (props = {}) => ({
  name: 'date',
  widget: 'datetime',
  format: 'D MMMM YYYY',
  ...props,
});

describe('getDayjsLocaleKey()', () => {
  test.each([
    ['de', 'de'],
    ['DE', 'de'],
    ['de-AT', 'de-at'],
    ['de-DE', 'de'],
    ['pt-BR', 'pt-br'],
    ['pt', 'pt'],
    ['en-US', 'en'],
    ['en-GB', 'en-gb'],
    ['zh-Hant', 'zh-tw'],
    ['zh-Hans', 'zh-cn'],
    ['zh-Hant-HK', 'zh-hk'],
    ['sr-Cyrl', 'sr-cyrl'],
    ['sr-Cyrl-RS', 'sr-cyrl'],
    ['uz-Latn-UZ', 'uz-latn'],
    ['ja', 'ja'],
  ])('maps %s to %s', (locale, key) => {
    expect(getDayjsLocaleKey(locale)).toBe(key);
  });

  test('returns `undefined` for a locale Day.js doesn’t have', () => {
    expect(getDayjsLocaleKey('xx')).toBeUndefined();
  });

  test('returns `undefined` for an invalid locale code', () => {
    expect(getDayjsLocaleKey('_default')).toBeUndefined();
    expect(getDayjsLocaleKey('')).toBeUndefined();
  });

  test('caches the result', () => {
    const spy = vi.spyOn(Intl, 'Locale');

    getDayjsLocaleKey('nl-BE');
    getDayjsLocaleKey('nl-BE');

    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});

describe('loadDayjsLocales() and getFormatLocale()', () => {
  /** @type {import('vitest').MockInstance} */
  let consoleError;

  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  test('falls back to English before a locale is loaded', () => {
    expect(getFormatLocale(createField({ localize_format: 'ru' }))).toBeUndefined();
  });

  test('loads the locales once, registering them with Day.js', async () => {
    await Promise.all([loadDayjsLocales(['de', 'de-DE', 'xx']), loadDayjsLocales(['de', 'ru'])]);
    await loadDayjsLocales(['de']);

    expect(loadLocaleData).toHaveBeenCalledTimes(2);
    expect(loadLocaleData).toHaveBeenCalledWith('de');
    expect(loadLocaleData).toHaveBeenCalledWith('ru');
    expect(dayjs('2026-03-01').locale('de').format('MMMM')).toBe('März');
    // Registering a locale doesn’t make it the default one
    expect(dayjs('2026-03-01').format('MMMM')).toBe('March');
  });

  test('never loads English, which is built in', async () => {
    await loadDayjsLocales(['en', 'en-US']);

    expect(loadLocaleData).not.toHaveBeenCalled();
  });

  test('logs a locale that fails to load, which falls back to English', async () => {
    await loadDayjsLocales(['fr']);

    expect(consoleError).toHaveBeenCalledWith(
      'Failed to load the Day.js locale “fr”',
      expect.any(Error),
    );
    expect(getFormatLocale(createField({ localize_format: 'fr' }))).toBeUndefined();

    // It’s requested again next time
    await loadDayjsLocales(['fr']);

    expect(loadLocaleData).toHaveBeenCalledTimes(2);
  });

  test('uses the locale given as the option, whatever the content locale', () => {
    const fieldConfig = createField({ localize_format: 'de-DE' });

    expect(getFormatLocale(fieldConfig)).toBe('de');
    expect(getFormatLocale(fieldConfig, '_default')).toBe('de');
    expect(getFormatLocale(fieldConfig, 'ru')).toBe('de');
  });

  test('uses the content locale with `true`', () => {
    const fieldConfig = createField({ localize_format: true });

    expect(getFormatLocale(fieldConfig, 'de')).toBe('de');
    expect(getFormatLocale(fieldConfig, 'ru')).toBe('ru');
    expect(getFormatLocale(fieldConfig, 'en')).toBeUndefined();
    expect(getFormatLocale(fieldConfig, 'xx')).toBeUndefined();
    // No locale without i18n
    expect(getFormatLocale(fieldConfig, '_default')).toBeUndefined();
    expect(getFormatLocale(fieldConfig)).toBeUndefined();
  });

  test('uses English without the option', () => {
    expect(getFormatLocale(createField(), 'de')).toBeUndefined();
    expect(getFormatLocale(createField({ localize_format: false }), 'de')).toBeUndefined();
  });
});
