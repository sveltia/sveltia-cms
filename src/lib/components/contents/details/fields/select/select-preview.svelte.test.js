import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';

import SelectPreview from './select-preview.svelte';

/**
 * @import { SelectField, SelectFieldValue } from '$lib/types/public';
 */

/** @type {SelectField} */
const fieldConfig = {
  name: 'category',
  widget: 'select',
  options: [
    { label: 'Apple', value: 'apple' },
    { label: 'Banana', value: 'banana' },
  ],
};

/**
 * Render the preview.
 * @param {SelectFieldValue | SelectFieldValue[] | undefined} currentValue Field value.
 * @param {Partial<SelectField>} [config] Field options.
 * @returns {Promise<HTMLElement>} Container.
 */
const renderPreview = async (currentValue, config = {}) => {
  const { container } = await render(SelectPreview, {
    locale: 'en',
    keyPath: 'category',
    typedKeyPath: 'category',
    fieldConfig: { ...fieldConfig, ...config },
    currentValue,
  });

  return container;
};

describe('SelectPreview', () => {
  test('shows the label of the selected option', async () => {
    expect(await renderPreview('banana')).toHaveTextContent('Banana');
  });

  test('lists the labels of multiple selected options', async () => {
    expect(await renderPreview(['banana', 'apple'], { multiple: true })).toHaveTextContent(
      'Apple, Banana',
    );
  });

  test('marks the paragraph with the language and direction', async () => {
    const { container } = await render(SelectPreview, {
      locale: 'ar',
      keyPath: 'category',
      typedKeyPath: 'category',
      fieldConfig,
      currentValue: 'apple',
    });

    const paragraph = container.querySelector('p');

    expect(paragraph).toHaveAttribute('lang', 'ar');
    expect(paragraph).toHaveAttribute('dir', 'rtl');
  });

  test('shows nothing when there is no value', async () => {
    expect((await renderPreview(undefined)).children).toHaveLength(0);
    expect((await renderPreview([], { multiple: true })).children).toHaveLength(0);
  });
});
