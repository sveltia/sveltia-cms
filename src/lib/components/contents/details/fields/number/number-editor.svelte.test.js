import { describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { renderFieldEditor } from '$lib/test/field.svelte';

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
const renderEditor = async ({ currentValue = undefined, config = {} } = {}) =>
  renderFieldEditor(NumberEditor, {
    fieldConfig: /** @type {NumberField} */ ({ name: 'count', widget: 'number', ...config }),
    fieldLabel: 'Count',
    currentValue,
  });

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

  test('uses the input mode of the value type and the range', async () => {
    await renderEditor({ config: { value_type: 'float', min: 0 } });

    // The default step of 1 alone would bring up the numeric keypad, without a decimal point
    await expect.element(page.getByRole('spinbutton')).toHaveAttribute('inputmode', 'decimal');
  });

  test('uses the full keyboard when a negative number is allowed', async () => {
    await renderEditor({ config: { value_type: 'float' } });

    // The keypads on iOS have no minus key
    await expect.element(page.getByRole('spinbutton')).toHaveAttribute('inputmode', 'text');
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

  test.each(
    /** @type {[string | number, Partial<NumberField>][]} */ ([
      [4.5, {}],
      ['42', {}],
      ['007', { value_type: 'int/string' }],
      ['4.50', { value_type: 'float/string' }],
    ]),
  )('keeps the stored value %j until the input is edited', async (currentValue, config) => {
    const { props } = await renderEditor({ currentValue, config });

    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });
    expect(props.currentValue).toBe(currentValue);
  });

  test('casts an edit of a stored value the input can’t represent', async () => {
    const { props } = await renderEditor({ currentValue: 4.5 });

    await page.getByRole('spinbutton').fill('5');

    expect(props.currentValue).toBe(5);
  });

  test('stores text that isn’t a number, keeping it in the input, so it can be reported', async () => {
    const { props } = await renderEditor({ currentValue: 42, config: { value_type: 'float' } });
    const input = page.getByRole('spinbutton');

    // Typed one character at a time, like a user would
    await input.clear();
    await userEvent.type(input, '1,5');

    await expect.poll(() => props.currentValue).toBe('1,5');
    await expect.element(input).toHaveValue('1,5');

    // Blurring the input keeps the text, too
    await userEvent.tab();

    await expect.element(input).toHaveValue('1,5');
    expect(props.currentValue).toBe('1,5');

    // A number typed over it is stored as usual
    await input.fill('2.5');

    await expect.poll(() => props.currentValue).toBe(2.5);
  });

  test('stores a number the field can’t hold as a string, so it can be reported', async () => {
    const { props } = await renderEditor({ currentValue: null, config: { value_type: 'float' } });
    const input = page.getByRole('spinbutton');

    await input.fill('1e400');

    await expect.poll(() => props.currentValue).toBe('Infinity');
    await expect.element(input).toHaveValue('1e400');

    await userEvent.tab();

    await expect.element(input).toHaveValue('1e400');
  });

  test('stores a large integer in full or as a string beyond the safe range', async () => {
    const { props } = await renderEditor({ currentValue: null });
    const input = page.getByRole('spinbutton');

    await input.fill('1e15');

    await expect.poll(() => props.currentValue).toBe(1e15);

    await input.fill('1e21');

    await expect.poll(() => props.currentValue).toBe('1e+21');
    await expect.element(input).toHaveValue('1e21');
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

  test('turns stepping off with a step of -1', async () => {
    const { props } = await renderEditor({ currentValue: 4, config: { step: -1, min: 1 } });
    const input = page.getByRole('textbox');

    await expect.element(input).toHaveValue('4');
    // An integer field gets the numeric keypad, even though the step no longer tells it apart
    await expect.element(input).toHaveAttribute('inputmode', 'numeric');
    await expect.element(input).toHaveAccessibleDescription('Minimum 1');
    await expect.element(page.getByRole('button', { name: 'Increase' })).not.toBeInTheDocument();
    await expect.element(page.getByRole('button', { name: 'Decrease' })).not.toBeInTheDocument();
    await input.click();
    await userEvent.keyboard('{ArrowUp}');
    await expect.element(input).toHaveValue('4');
    expect(props.currentValue).toBe(4);
    await input.fill('12345');
    await expect.poll(() => props.currentValue).toBe(12345);
  });
});
