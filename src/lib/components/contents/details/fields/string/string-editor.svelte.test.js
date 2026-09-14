import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { createRawState } from '$lib/services/utils/state.svelte';

import CharacterCounter from './character-counter.svelte';
import StringEditor from './string-editor.svelte';

/**
 * @import { StringField } from '$lib/types/public';
 */

/**
 * Render the editor with a bindable value.
 * @param {object} [options] Options.
 * @param {any} [options.currentValue] Field value.
 * @param {Partial<StringField>} [options.config] Field options.
 * @param {Map<string, any>} [options.context] Svelte context.
 * @returns {Promise<{ props: { currentValue: any } }>} Props, whose `currentValue` follows the
 * editor.
 */
const renderEditor = async ({
  currentValue = undefined,
  config = {},
  context = undefined,
} = {}) => {
  const props = $state({
    locale: 'en',
    keyPath: 'handle',
    typedKeyPath: 'handle',
    fieldId: 'handle',
    fieldLabel: 'Handle',
    fieldConfig: /** @type {StringField} */ ({ name: 'handle', widget: 'string', ...config }),
    currentValue,
  });

  await render(StringEditor, context ? { context, props } : props);

  return { props };
};

describe('StringEditor', () => {
  test('reflects the value in a labelled input', async () => {
    await renderEditor({ currentValue: 'hello' });

    const input = page.getByRole('textbox');

    await expect.element(input).toHaveValue('hello');
    await expect.element(input).toHaveAttribute('aria-labelledby', 'handle-label');
    await expect.element(input).toHaveAttribute('aria-errormessage', 'handle-error');
    await expect.element(input).toHaveAttribute('lang', 'en');
    await expect.element(input).toHaveAttribute('dir', 'ltr');
  });

  test('updates the value as the user types', async () => {
    const { props } = await renderEditor({ currentValue: '' });

    await page.getByRole('textbox').fill('world');

    expect(props.currentValue).toBe('world');
  });

  test('hides the affixes from the input and stores them with the value', async () => {
    const { props } = await renderEditor({
      currentValue: '@vitalik.eth',
      config: { prefix: '@', suffix: '.eth' },
    });

    const input = page.getByRole('textbox');

    await expect.element(input).toHaveValue('vitalik');
    await input.fill('satoshi');
    expect(props.currentValue).toBe('@satoshi.eth');
    await input.fill('');
    expect(props.currentValue).toBe('');
  });

  test('follows an external change to the value', async () => {
    const { props } = await renderEditor({ currentValue: 'a' });

    props.currentValue = 'b';

    await expect.element(page.getByRole('textbox')).toHaveValue('b');
  });

  test('uses the configured input type for the on-screen keyboard', async () => {
    await renderEditor({ config: { type: 'email' } });

    await expect.element(page.getByRole('textbox')).toHaveAttribute('inputmode', 'email');
  });

  test('offers the character counter as an extra hint', async () => {
    const extraHint = createRawState();
    const context = new Map([['field-editor', { extraHint }]]);

    await renderEditor({ context });

    expect(extraHint.current).toBe(CharacterCounter);
  });
});
