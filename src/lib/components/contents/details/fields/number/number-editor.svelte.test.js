import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import NumberEditor from './number-editor.svelte';

/**
 * @import { NumberField } from '$lib/types/public';
 */

/**
 * Render the editor with a bindable value.
 * @param {object} [options] Options.
 * @param {string | number | null | undefined} [options.currentValue] Field value.
 * @param {Partial<NumberField>} [options.config] Field options.
 * @returns {Promise<{ props: { currentValue: string | number | null | undefined } }>} Props, whose
 * `currentValue` follows the editor.
 */
const renderEditor = async ({ currentValue = undefined, config = {} } = {}) => {
  const props = $state({
    locale: 'en',
    keyPath: 'count',
    typedKeyPath: 'count',
    fieldId: 'count',
    fieldLabel: 'Count',
    fieldConfig: /** @type {NumberField} */ ({ name: 'count', widget: 'number', ...config }),
    currentValue,
  });

  await render(NumberEditor, props);

  return { props };
};

describe('NumberEditor', () => {
  test('reflects the value', async () => {
    await renderEditor({ currentValue: 42 });

    await expect.element(page.getByRole('spinbutton')).toHaveValue('42');
  });

  test('reflects a string value', async () => {
    await renderEditor({ currentValue: '42', config: { value_type: 'int/string' } });

    await expect.element(page.getByRole('spinbutton')).toHaveValue('42');
  });

  test('stores an integer by default', async () => {
    const { props } = await renderEditor({ currentValue: null });

    await page.getByRole('spinbutton').fill('42');

    expect(props.currentValue).toBe(42);
  });

  test('stores a float for the `float` type', async () => {
    const { props } = await renderEditor({ currentValue: null, config: { value_type: 'float' } });

    await page.getByRole('spinbutton').fill('4.2');

    expect(props.currentValue).toBe(4.2);
  });

  test('stores a string for the string types', async () => {
    const { props } = await renderEditor({
      currentValue: '',
      config: { value_type: 'float/string' },
    });

    await page.getByRole('spinbutton').fill('4.2');

    expect(props.currentValue).toBe('4.2');
  });

  test('stores `null` when the input is cleared', async () => {
    const { props } = await renderEditor({ currentValue: 42 });

    await page.getByRole('spinbutton').fill('');

    expect(props.currentValue).toBe(null);
  });

  test('follows an external change to the value', async () => {
    const { props } = await renderEditor({ currentValue: 1 });

    props.currentValue = 2;

    await expect.element(page.getByRole('spinbutton')).toHaveValue('2');
  });

  test('passes the range and step to the input', async () => {
    await renderEditor({ currentValue: 4, config: { min: 0, max: 10, step: 2 } });

    const input = page.getByRole('spinbutton');

    await expect.element(input).toHaveAttribute('aria-valuemin', '0');
    await expect.element(input).toHaveAttribute('aria-valuemax', '10');

    // The step is applied by the spin buttons
    await page.getByRole('button', { name: 'Increase' }).click();
    await expect.element(input).toHaveValue('6');
  });
});
