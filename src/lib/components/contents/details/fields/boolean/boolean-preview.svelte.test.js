import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';

import BooleanPreview from './boolean-preview.svelte';

/**
 * @import { BooleanField } from '$lib/types/public';
 */

/** @type {BooleanField} */
const fieldConfig = { name: 'published', widget: 'boolean' };

/**
 * Render the preview.
 * @param {boolean | undefined} currentValue Field value.
 * @returns {Promise<HTMLElement>} Container.
 */
const renderPreview = async (currentValue) => {
  const { container } = await render(BooleanPreview, {
    locale: 'en',
    keyPath: 'published',
    typedKeyPath: 'published',
    fieldConfig,
    currentValue,
  });

  return container;
};

describe('BooleanPreview', () => {
  test('shows “Yes” for `true`', async () => {
    expect(await renderPreview(true)).toHaveTextContent('Yes');
  });

  test('shows “No” for `false`', async () => {
    expect(await renderPreview(false)).toHaveTextContent('No');
  });

  test('shows “No” when there is no value', async () => {
    expect(await renderPreview(undefined)).toHaveTextContent('No');
  });

  test('shows nothing for a value that is not a boolean', async () => {
    // A value of a mixed type, e.g. a string from a hand-edited file
    const container = await renderPreview(/** @type {any} */ ('true'));

    expect(container.children).toHaveLength(0);
  });
});
