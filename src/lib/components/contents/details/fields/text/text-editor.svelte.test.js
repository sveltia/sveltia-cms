import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { createRawState } from '$lib/services/utils/state.svelte';

import CharacterCounter from '../string/character-counter.svelte';

import TextEditor from './text-editor.svelte';

/**
 * @import { TextField } from '$lib/types/public';
 */

/** @type {TextField} */
const fieldConfig = { name: 'body', widget: 'text' };

/**
 * Render the editor with a bindable value.
 * @param {any} currentValue Field value.
 * @param {Map<string, any>} [context] Svelte context.
 * @returns {Promise<{ props: { currentValue: any } }>} Props, whose `currentValue` follows the
 * editor.
 */
const renderEditor = async (currentValue, context = undefined) => {
  const props = $state({
    locale: 'ar',
    keyPath: 'body',
    typedKeyPath: 'body',
    fieldId: 'body',
    fieldLabel: 'Body',
    fieldConfig,
    currentValue,
  });

  await render(TextEditor, context ? { context, props } : props);

  return { props };
};

describe('TextEditor', () => {
  test('reflects the value in a labelled text area', async () => {
    await renderEditor('Hello,\nworld!');

    const textarea = page.getByRole('textbox');

    await expect.element(textarea).toHaveValue('Hello,\nworld!');
    await expect.element(textarea).toHaveAttribute('aria-labelledby', 'body-label');
    await expect.element(textarea).toHaveAttribute('aria-errormessage', 'body-error');
    await expect.element(textarea).toHaveAttribute('lang', 'ar');
    await expect.element(textarea).toHaveAttribute('dir', 'rtl');
  });

  test('shows a non-string value as empty', async () => {
    await renderEditor(42);

    await expect.element(page.getByRole('textbox')).toHaveValue('');
  });

  test('updates the value as the user types', async () => {
    const { props } = await renderEditor('');

    await page.getByRole('textbox').fill('Hi');

    expect(props.currentValue).toBe('Hi');
  });

  test('follows an external change to the value', async () => {
    const { props } = await renderEditor('a');

    props.currentValue = 'b';

    await expect.element(page.getByRole('textbox')).toHaveValue('b');
  });

  test('offers the character counter as an extra hint', async () => {
    const extraHint = createRawState();
    const context = new Map([['field-editor', { extraHint }]]);

    await renderEditor('', context);

    expect(extraHint.current).toBe(CharacterCounter);
  });
});
