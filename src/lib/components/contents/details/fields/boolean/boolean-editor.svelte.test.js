import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import BooleanEditor from './boolean-editor.svelte';

/**
 * @import { BooleanField } from '$lib/types/public';
 */

/** @type {BooleanField} */
const fieldConfig = { name: 'published', widget: 'boolean' };

/**
 * Render the editor with a bindable value.
 * @param {object} [options] Options.
 * @param {boolean | 'mixed' | undefined} [options.currentValue] Field value.
 * @param {boolean} [options.readonly] Whether the field is read-only.
 * @returns {Promise<{ props: { currentValue: boolean | 'mixed' | undefined } }>} Props, whose
 * `currentValue` follows the editor.
 */
const renderEditor = async ({ currentValue = undefined, readonly = false } = {}) => {
  const props = $state({
    locale: 'en',
    keyPath: 'published',
    typedKeyPath: 'published',
    fieldId: 'published',
    fieldLabel: 'Published',
    fieldConfig,
    currentValue,
    readonly,
  });

  await render(BooleanEditor, props);

  return { props };
};

describe('BooleanEditor', () => {
  test('reflects the value', async () => {
    await renderEditor({ currentValue: true });

    await expect.element(page.getByRole('switch')).toBeChecked();
  });

  test('updates the value when toggled', async () => {
    const { props } = await renderEditor({ currentValue: false });
    const toggle = page.getByRole('switch');

    await expect.element(toggle).not.toBeChecked();
    await toggle.click();
    await expect.element(toggle).toBeChecked();
    expect(props.currentValue).toBe(true);

    await toggle.click();
    expect(props.currentValue).toBe(false);
  });

  test('follows an external change to the value', async () => {
    const { props } = await renderEditor({ currentValue: false });

    props.currentValue = true;

    await expect.element(page.getByRole('switch')).toBeChecked();
  });

  test('is labelled by the field label and error message', async () => {
    await renderEditor();

    const toggle = page.getByRole('switch');

    await expect.element(toggle).toHaveAttribute('aria-labelledby', 'published-label');
    await expect.element(toggle).toHaveAttribute('aria-errormessage', 'published-error');
  });

  test('cannot be toggled when read-only', async () => {
    const { props } = await renderEditor({ currentValue: false, readonly: true });
    const toggle = page.getByRole('switch');

    await expect.element(toggle).toHaveAttribute('aria-readonly', 'true');
    // A read-only switch ignores pointer events, so the click has to be forced through
    await toggle.click({ force: true });
    await expect.element(toggle).not.toBeChecked();
    expect(props.currentValue).toBe(false);
  });
});
