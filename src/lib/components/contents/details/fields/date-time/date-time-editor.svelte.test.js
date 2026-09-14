import { describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import DateTimeEditor from './date-time-editor.svelte';

/**
 * @import { DateTimeField } from '$lib/types/public';
 */

/**
 * Render the editor with a bindable value.
 * @param {object} [options] Options.
 * @param {string | undefined} [options.currentValue] Field value.
 * @param {Partial<DateTimeField>} [options.config] Field options.
 * @param {boolean} [options.required] Whether the field is required.
 * @param {boolean} [options.readonly] Whether the field is read-only.
 * @returns {Promise<{ props: { currentValue: string | undefined }, container: HTMLElement }>}
 * Props, whose `currentValue` follows the editor, and the container.
 */
const renderEditor = async ({
  currentValue = undefined,
  config = {},
  required = true,
  readonly = false,
} = {}) => {
  const props = $state({
    locale: 'en',
    keyPath: 'date',
    typedKeyPath: 'date',
    fieldId: 'date',
    fieldLabel: 'Date',
    fieldConfig: /** @type {DateTimeField} */ ({ name: 'date', widget: 'datetime', ...config }),
    currentValue,
    required,
    readonly,
  });

  const { container } = await render(DateTimeEditor, props);

  return { props, container };
};

/**
 * Get the native input.
 * @param {HTMLElement} container Container.
 * @returns {HTMLInputElement} Input.
 */
const getInput = (container) => /** @type {HTMLInputElement} */ (container.querySelector('input'));

describe('DateTimeEditor', () => {
  test('shows a date-time value in a labelled native input', async () => {
    const { container } = await renderEditor({ currentValue: '2024-01-15T10:30:00.000Z' });
    const input = getInput(container);

    expect(input.type).toBe('datetime-local');
    expect(input.value).toBe('2024-01-15T10:30');
    expect(input).toHaveAttribute('aria-labelledby', 'date-label');
    expect(input).toHaveAttribute('aria-errormessage', 'date-error');
    expect(input).toHaveAttribute('aria-required', 'true');
  });

  test('shows a date-only value in a date input', async () => {
    const { container } = await renderEditor({
      currentValue: '2024-01-15',
      config: { time_format: false },
    });

    const input = getInput(container);

    expect(input.type).toBe('date');
    expect(input.value).toBe('2024-01-15');
  });

  test('updates the value when the input changes', async () => {
    const { props, container } = await renderEditor({ config: { time_format: false } });
    const input = getInput(container);

    input.value = '2024-03-01';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    await expect.poll(() => props.currentValue).toBe('2024-03-01');
  });

  test('leaves the input alone while it’s being edited', async () => {
    const { props, container } = await renderEditor({
      config: { time_format: false },
      currentValue: '2024-01-15',
    });

    const input = getInput(container);

    input.focus();
    // An external change doesn’t interfere with typing
    props.currentValue = '2024-02-01';
    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });
    expect(input.value).toBe('2024-01-15');

    // The change is picked up once the editing is done
    input.blur();
    await expect.poll(() => input.value).toBe('2024-02-01');
  });

  test('fills in the current date', async () => {
    vi.setSystemTime(new Date('2024-06-01T12:00:00Z'));

    try {
      const { props } = await renderEditor({ config: { time_format: false } });

      await page.getByRole('button', { name: 'Today' }).click();
      await expect.poll(() => props.currentValue).toBe('2024-06-01');
    } finally {
      vi.useRealTimers();
    }
  });

  test('can be cleared when optional', async () => {
    const { props, container } = await renderEditor({
      currentValue: '2024-01-15',
      config: { time_format: false },
      required: false,
    });

    await page.getByRole('button', { name: 'Clear' }).click();

    expect(props.currentValue).toBe('');
    await expect.poll(() => getInput(container).value).toBe('');
  });

  test('hides the buttons when read-only', async () => {
    await renderEditor({ currentValue: '2024-01-15', readonly: true });

    expect(page.getByRole('button').elements()).toHaveLength(0);
  });

  test('notes the time zone', async () => {
    const utc = await renderEditor({ config: { picker_utc: true } });

    expect(utc.container.querySelector('.timezone')).toHaveTextContent('UTC');

    const tokyo = await renderEditor({
      currentValue: '2024-01-15T10:30:00.000+09:00',
      config: { input_timezone: 'Asia/Tokyo' },
    });

    expect(tokyo.container.querySelector('.timezone')).toHaveTextContent('(+09:00) Tokyo');
  });
});
