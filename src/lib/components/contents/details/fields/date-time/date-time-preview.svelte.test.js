import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';

import DateTimePreview from './date-time-preview.svelte';

/**
 * @import { DateTimeField } from '$lib/types/public';
 */

/**
 * Render the preview.
 * @param {string | undefined} currentValue Field value.
 * @param {Partial<DateTimeField>} [config] Field options.
 * @param {string} [locale] Locale code.
 * @returns {Promise<HTMLElement>} Container.
 */
const renderPreview = async (currentValue, config = {}, locale = 'en') => {
  const { container } = await render(DateTimePreview, {
    locale,
    keyPath: 'date',
    typedKeyPath: 'date',
    fieldConfig: { name: 'date', widget: 'datetime', ...config },
    currentValue,
  });

  return container;
};

describe('DateTimePreview', () => {
  test('shows a date-only value for the locale', async () => {
    expect(await renderPreview('2024-01-15', { time_format: false })).toHaveTextContent(
      'Jan 15, 2024',
    );
    expect(await renderPreview('2024-01-15', { time_format: false }, 'ja')).toHaveTextContent(
      '2024年1月15日',
    );
  });

  test('marks a UTC value', async () => {
    const container = await renderPreview('2024-01-15T10:30:00.000Z', { picker_utc: true });

    expect(container).toHaveTextContent('Jan 15, 2024, 10:30 AM — UTC');
  });

  test('marks a value in a custom time zone', async () => {
    const container = await renderPreview('2024-01-15T10:30:00.000+09:00', {
      input_timezone: 'Asia/Tokyo',
    });

    expect(container).toHaveTextContent('Jan 15, 2024, 10:30 AM — (+09:00) Tokyo');
  });

  test('marks the paragraph with the language and direction', async () => {
    const paragraph = (await renderPreview('2024-01-15', {}, 'ar')).querySelector('p');

    expect(paragraph).toHaveAttribute('lang', 'ar');
    expect(paragraph).toHaveAttribute('dir', 'rtl');
  });

  test('shows nothing when there is no value', async () => {
    expect((await renderPreview(undefined)).children).toHaveLength(0);
    expect((await renderPreview('')).children).toHaveLength(0);
  });
});
