import { beforeAll, describe, expect, test, vi } from 'vitest';

import { applyDateTransformation } from '$lib/services/common/transformations';
import {
  matchesConditions,
  prepareConditions,
} from '$lib/services/contents/collection/view/conditions';
import { getDateTimeFieldDisplayValue } from '$lib/services/contents/fields/date-time/display';
import { loadDayjsLocales } from '$lib/services/contents/fields/date-time/locales';
import { getDate } from '$lib/services/contents/fields/date-time/parse';
import {
  getCurrentStorableValue,
  getCurrentValue,
  getInputValue,
  getLocalizedDateTimeValue,
  shouldUpdateValue,
} from '$lib/services/contents/fields/date-time/value';
import { getLocalizedFieldValue } from '$lib/services/contents/fields/locale';

/**
 * @import { DateTimeField } from '$lib/types/public';
 */

const { loadLocaleData } = vi.hoisted(() => ({
  /**
   * Load the installed locale file rather than the one on UNPKG.
   * @param {string} key Day.js locale key.
   * @returns {Promise<ILocale>} Locale data.
   */
  loadLocaleData: async (key) =>
    (await import(`../../../../../../node_modules/dayjs/esm/locale/${key}.js`)).default,
}));

vi.mock('$lib/services/contents/fields/date-time/locale-loader', () => ({ loadLocaleData }));

/**
 * Create a DateTime field configuration.
 * @param {Partial<DateTimeField>} [props] Properties.
 * @returns {DateTimeField} Field configuration.
 */
const createField = (props = {}) => ({ name: 'date', widget: 'datetime', ...props });

beforeAll(async () => {
  await loadDayjsLocales(['de', 'ru']);
});

describe('a date in a fixed locale', () => {
  const fieldConfig = createField({
    type: 'date',
    format: 'D. MMMM YYYY',
    localize_format: 'de',
  });

  test('is written in the locale, whatever the content locale', () => {
    expect(getCurrentValue({ inputValue: '2026-03-01', currentValue: '', fieldConfig })).toBe(
      '1. März 2026',
    );
    expect(
      getCurrentValue({ inputValue: '2026-03-01', currentValue: '', fieldConfig, locale: 'ru' }),
    ).toBe('1. März 2026');
  });

  test('is read in the locale', () => {
    const currentValue = '1. März 2026';

    expect(getInputValue({ currentValue, fieldConfig })).toBe('2026-03-01');
    expect(getDate(currentValue, fieldConfig)).toEqual(new Date('2026-03-01T00:00:00'));
    expect(getDateTimeFieldDisplayValue({ locale: '_default', fieldConfig, currentValue })).toBe(
      currentValue,
    );
  });

  test('falls back to the default parsing for an ISO 8601 value', () => {
    expect(getInputValue({ currentValue: '2026-03-01', fieldConfig })).toBe('2026-03-01');
  });

  test('is written as the current date in the locale', () => {
    expect(getCurrentStorableValue(fieldConfig, { date: new Date('2026-03-01T12:00:00Z') })).toBe(
      '1. März 2026',
    );
  });
});

describe('a date and time in the content locale', () => {
  const fieldConfig = createField({ format: 'D MMMM YYYY, HH:mm', localize_format: true });

  test('is written in the content locale', () => {
    const args = { inputValue: '2026-03-01T10:30', currentValue: '', fieldConfig };

    expect(getCurrentValue({ ...args, locale: 'de' })).toBe('1 März 2026, 10:30');
    // Russian has a form of the month name for a date, which differs from the name on its own
    expect(getCurrentValue({ ...args, locale: 'ru' })).toBe('1 марта 2026, 10:30');
    expect(getCurrentValue({ ...args, locale: 'en' })).toBe('1 March 2026, 10:30');
    // Without i18n, the content has no locale
    expect(getCurrentValue({ ...args, locale: '_default' })).toBe('1 March 2026, 10:30');
  });

  test('is read in the content locale', () => {
    expect(getInputValue({ currentValue: '1 марта 2026, 10:30', fieldConfig, locale: 'ru' })).toBe(
      '2026-03-01T10:30',
    );
    expect(getDate('1 März 2026, 10:30', fieldConfig, 'de')).toEqual(
      new Date('2026-03-01T10:30:00'),
    );
    // A value in another locale can’t be read
    expect(getInputValue({ currentValue: '1 März 2026, 10:30', fieldConfig, locale: 'ru' })).toBe(
      '',
    );
  });

  test('is shown in the content locale', () => {
    expect(
      getDateTimeFieldDisplayValue({
        locale: 'de',
        fieldConfig,
        currentValue: '1 März 2026, 10:30',
      }),
    ).toBe('1 März 2026, 10:30');
  });

  test('isn’t updated with the same time written again', () => {
    expect(
      shouldUpdateValue({
        newValue: '1 März 2026, 10:30',
        currentValue: '2026-03-01T10:30',
        fieldConfig,
        locale: 'de',
      }),
    ).toBe(false);
  });

  test('is transformed in the content locale', () => {
    const value = '1 März 2026, 10:30';
    const args = { format: 'MMMM' };

    expect(applyDateTransformation(value, args, fieldConfig, 'de')).toBe('März');
    expect(applyDateTransformation(value, args, fieldConfig, 'en')).toBe('');
    expect(applyDateTransformation(new Date('2026-03-01'), args, fieldConfig, 'de')).toBe('März');
  });
});

describe('a date in the content locale in a view filter', () => {
  const dateFieldConfig = createField({
    type: 'date',
    format: 'D. MMMM YYYY',
    localize_format: true,
  });

  test('is compared in the content locale', () => {
    const conditions = prepareConditions(
      { field: 'date', gte: '1. März 2026' },
      { dateFieldConfig, locale: 'de' },
    );

    expect(matchesConditions({ rawValue: '2. März 2026', conditions })).toBe(true);
    expect(matchesConditions({ rawValue: '28. Februar 2026', conditions })).toBe(false);
  });
});

describe('a date and time in a custom time zone', () => {
  const fieldConfig = createField({
    format: 'D. MMMM YYYY HH:mm',
    localize_format: true,
    input_timezone: 'Asia/Tokyo',
  });

  test('is written and read in the content locale', () => {
    const currentValue = getCurrentValue({
      inputValue: '2026-03-01T10:30',
      currentValue: '',
      fieldConfig,
      timeZone: 'Asia/Tokyo',
      locale: 'de',
    });

    expect(currentValue).toBe('1. März 2026 10:30');
    expect(getDate(currentValue, fieldConfig, 'de')).toEqual(new Date('2026-03-01T01:30:00Z'));
  });
});

describe('getLocalizedDateTimeValue()', () => {
  const fieldConfig = createField({ format: 'D MMMM YYYY', localize_format: true });

  test('writes a value copied from another locale in the target locale', () => {
    expect(
      getLocalizedDateTimeValue({
        fieldConfig,
        value: '1 March 2026',
        sourceLocale: 'en',
        targetLocale: 'de',
      }),
    ).toBe('1 März 2026');
    expect(
      getLocalizedDateTimeValue({
        fieldConfig,
        value: '1 März 2026',
        sourceLocale: 'de',
        targetLocale: 'ru',
      }),
    ).toBe('1 марта 2026');
    expect(
      getLocalizedDateTimeValue({
        fieldConfig,
        value: '1 März 2026',
        sourceLocale: 'de',
        targetLocale: 'en',
      }),
    ).toBe('1 March 2026');
  });

  test('keeps the date and time whatever the time zone', () => {
    expect(
      getLocalizedDateTimeValue({
        fieldConfig: createField({
          format: 'D MMMM YYYY HH:mm',
          localize_format: true,
          input_timezone: 'America/New_York',
        }),
        value: '1 March 2026 23:30',
        sourceLocale: 'en',
        targetLocale: 'de',
      }),
    ).toBe('1 März 2026 23:30');
  });

  test('returns a value it can’t parse as is', () => {
    expect(
      getLocalizedDateTimeValue({
        fieldConfig,
        value: 'soon',
        sourceLocale: 'en',
        targetLocale: 'de',
      }),
    ).toBe('soon');
  });

  test.each([
    ['a field of another type', { name: 'date', widget: 'string' }, '1 March 2026'],
    ['a fixed locale', createField({ format: 'D MMMM YYYY', localize_format: 'de' }), '1 März'],
    ['no option', createField({ format: 'D MMMM YYYY' }), '1 March 2026'],
    ['no format', createField({ localize_format: true }), '2026-03-01'],
    ['an empty value', fieldConfig, ''],
    ['a value other than a string', fieldConfig, 20260301],
  ])('returns the value as is for %s', (_label, config, value) => {
    expect(
      getLocalizedDateTimeValue({
        fieldConfig: /** @type {any} */ (config),
        value,
        sourceLocale: 'en',
        targetLocale: 'de',
      }),
    ).toBe(value);
  });

  test('returns the value as is between locales written the same way', () => {
    expect(
      getLocalizedDateTimeValue({
        fieldConfig,
        value: '1 March 2026',
        sourceLocale: 'en',
        targetLocale: 'en-US',
      }),
    ).toBe('1 March 2026');
  });
});

describe('getLocalizedFieldValue()', () => {
  test('localizes a DateTime field value', () => {
    expect(
      getLocalizedFieldValue({
        fieldConfig: createField({ format: 'D MMMM YYYY', localize_format: true }),
        value: '1 March 2026',
        sourceLocale: 'en',
        targetLocale: 'de',
      }),
    ).toBe('1 März 2026');
  });

  test('localizes a Relation field value', () => {
    expect(
      getLocalizedFieldValue({
        fieldConfig: /** @type {any} */ ({
          name: 'tags',
          widget: 'relation',
          collection: 'tags',
          value_field: '{{locale}}/{{slug}}',
        }),
        value: 'en/food',
        sourceLocale: 'en',
        targetLocale: 'de',
      }),
    ).toBe('de/food');
  });
});
