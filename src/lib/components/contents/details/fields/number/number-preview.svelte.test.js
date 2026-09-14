import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';

import NumberPreview from './number-preview.svelte';

/**
 * @import { NumberField } from '$lib/types/public';
 */

/** @type {NumberField} */
const fieldConfig = { name: 'price', widget: 'number' };

/**
 * Render the preview.
 * @param {string | number | null | undefined} currentValue Field value.
 * @param {string} [locale] Locale code.
 * @returns {Promise<HTMLElement>} Container.
 */
const renderPreview = async (currentValue, locale = 'en') => {
  const { container } = await render(NumberPreview, {
    locale,
    keyPath: 'price',
    typedKeyPath: 'price',
    fieldConfig,
    currentValue,
  });

  return container;
};

describe('NumberPreview', () => {
  test('formats a number for the locale', async () => {
    expect(await renderPreview(1234567.89)).toHaveTextContent('1,234,567.89');
    expect(await renderPreview(1234567.89, 'de')).toHaveTextContent('1.234.567,89');
  });

  test('formats a numeric string', async () => {
    expect(await renderPreview('1000')).toHaveTextContent('1,000');
  });

  test('marks the paragraph with the language and direction', async () => {
    const paragraph = (await renderPreview(1, 'ar')).querySelector('p');

    expect(paragraph).toHaveAttribute('lang', 'ar');
    expect(paragraph).toHaveAttribute('dir', 'rtl');
  });

  test('shows nothing when there is no value', async () => {
    expect((await renderPreview(undefined)).children).toHaveLength(0);
    expect((await renderPreview(null)).children).toHaveLength(0);
    expect((await renderPreview('')).children).toHaveLength(0);
  });
});
