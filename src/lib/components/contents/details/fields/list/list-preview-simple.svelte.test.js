import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';

import ListPreviewSimple from './list-preview-simple.svelte';

/**
 * @import { SimpleListField } from '$lib/types/public';
 */

/** @type {SimpleListField} */
const fieldConfig = { name: 'tags', widget: 'list' };

/**
 * Render the preview.
 * @param {string[] | undefined} currentValue Field value.
 * @param {string} [locale] Locale code.
 * @returns {Promise<HTMLElement>} Container.
 */
const renderPreview = async (currentValue, locale = 'en') => {
  const { container } = await render(ListPreviewSimple, {
    locale,
    keyPath: 'tags',
    typedKeyPath: 'tags',
    fieldConfig,
    currentValue,
  });

  return container;
};

describe('ListPreviewSimple', () => {
  test('lists the items in order, including duplicates', async () => {
    const items = (await renderPreview(['svelte', 'cms', 'svelte'])).querySelectorAll('li');

    expect([...items].map((item) => item.textContent)).toEqual(['svelte', 'cms', 'svelte']);
  });

  test('marks the list with the language and direction', async () => {
    const list = (await renderPreview(['مرحبا'], 'ar')).querySelector('ul');

    expect(list).toHaveAttribute('lang', 'ar');
    expect(list).toHaveAttribute('dir', 'rtl');
  });

  test('shows nothing when there is no value or the list is empty', async () => {
    expect((await renderPreview(undefined)).children).toHaveLength(0);
    expect((await renderPreview([])).children).toHaveLength(0);
  });
});
