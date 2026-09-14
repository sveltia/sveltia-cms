import { describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { createMockDraft, renderWithDraft } from '$lib/test/draft';

import KeyValueEditor from './key-value-editor.svelte';

/**
 * @import { KeyValueField } from '$lib/types/public';
 */

/**
 * Render the editor within a draft.
 * @param {Record<string, string>} pairs Stored pairs.
 * @param {object} [options] Options.
 * @param {Partial<KeyValueField>} [options.config] Field options.
 * @param {boolean} [options.readonly] Whether the field is read-only.
 * @param {string} [options.locale] Locale to edit. Any other locale than `_default` enables i18n.
 * @returns {Promise<{ draft: any }>} Draft.
 */
const renderEditor = async (pairs, { config = {}, readonly = false, locale = '_default' } = {}) => {
  /** @type {KeyValueField} */
  const fieldConfig = { name: 'meta', widget: 'keyvalue', ...config };

  const i18n =
    locale === '_default' ? undefined : { defaultLocale: 'en', allLocales: ['en', 'fr'] };

  const values = Object.fromEntries(
    Object.entries(pairs).map(([key, value]) => [`meta.${key}`, value]),
  );

  const draft = createMockDraft({
    fields: [fieldConfig],
    i18n,
    values: i18n ? { en: { ...values }, fr: { ...values } } : { _default: values },
  });

  await renderWithDraft(KeyValueEditor, {
    draft,
    props: {
      locale,
      keyPath: 'meta',
      typedKeyPath: 'meta',
      fieldId: 'meta',
      fieldLabel: 'Meta',
      fieldConfig,
      currentValue: undefined,
      readonly,
    },
  });

  return { draft };
};

/**
 * Get the stored pairs.
 * @param {any} draft Draft.
 * @returns {Record<string, string>} Pairs.
 */
const getStoredPairs = (draft) =>
  Object.fromEntries(
    Object.entries(draft.currentValues._default)
      .filter(([key]) => key.startsWith('meta.'))
      .map(([key, value]) => [key.replace('meta.', ''), value]),
  );

/**
 * Get the values of the inputs in each row.
 * @returns {string[][]} Rows.
 */
const getRows = () =>
  page
    .getByRole('row')
    .elements()
    .slice(1)
    .map((row) =>
      [...row.querySelectorAll('input')].map(
        (input) => /** @type {HTMLInputElement} */ (input).value,
      ),
    );

describe('KeyValueEditor', () => {
  test('shows the pairs in a table with the default headers', async () => {
    await renderEditor({ color: 'red', size: 'L' });

    await expect.element(page.getByRole('columnheader', { name: 'Key' })).toBeVisible();
    await expect.element(page.getByRole('columnheader', { name: 'Value' })).toBeVisible();
    expect(getRows()).toEqual([
      ['color', 'red'],
      ['size', 'L'],
    ]);
  });

  test('uses the configured headers as input labels', async () => {
    await renderEditor(
      { color: 'red' },
      { config: { key_label: 'Property', value_label: 'Setting' } },
    );

    await expect.element(page.getByRole('textbox', { name: 'Property' })).toHaveValue('color');
    await expect.element(page.getByRole('textbox', { name: 'Setting' })).toHaveValue('red');
  });

  test('saves an edited value', async () => {
    const { draft } = await renderEditor({ color: 'red' });

    await page.getByRole('textbox', { name: 'Value' }).fill('blue');

    await expect.poll(() => getStoredPairs(draft)).toEqual({ color: 'blue' });
  });

  test('adds a pair and saves it once the key is filled in', async () => {
    const { draft } = await renderEditor({ color: 'red' });

    await page.getByRole('button', { name: 'Add' }).click();
    await expect.poll(getRows).toEqual([
      ['color', 'red'],
      ['', ''],
    ]);
    await expect.element(page.getByRole('textbox', { name: 'Key' }).nth(1)).toHaveFocus();

    await userEvent.keyboard('size');
    await userEvent.keyboard('{Enter}');
    await expect.element(page.getByRole('textbox', { name: 'Value' }).nth(1)).toHaveFocus();
    await userEvent.keyboard('L');

    await expect.poll(() => getStoredPairs(draft)).toEqual({ color: 'red', size: 'L' });
  });

  test('flags an empty or duplicate key', async () => {
    const { draft } = await renderEditor({ color: 'red', size: 'L' });
    const keys = page.getByRole('textbox', { name: 'Key' });

    await keys.nth(1).fill('color');
    await expect.element(page.getByRole('alert')).toHaveTextContent('error Key must be unique.');
    await expect.element(keys.nth(1)).toHaveAttribute('aria-invalid', 'true');
    // Nothing is saved while a key is invalid
    expect(getStoredPairs(draft)).toEqual({ color: 'red', size: 'L' });

    await keys.nth(1).fill('');
    await expect.element(page.getByRole('alert')).toHaveTextContent('error Key is required.');
  });

  test('removes a pair', async () => {
    const { draft } = await renderEditor({ color: 'red', size: 'L' });

    await page.getByRole('button', { name: 'Remove' }).nth(0).click();

    await expect.poll(getRows).toEqual([['size', 'L']]);
    await expect.poll(() => getStoredPairs(draft)).toEqual({ size: 'L' });
  });

  test('stores a placeholder for an empty field, so it can be validated', async () => {
    const { draft } = await renderEditor({});

    expect(getRows()).toEqual([]);
    await expect.poll(() => draft.currentValues._default.meta).toBe(null);
  });

  test('does not add a pair beyond the maximum', async () => {
    await renderEditor({ color: 'red' }, { config: { max: 1 } });

    await expect
      .element(page.getByRole('button', { name: 'Add' }))
      .toHaveAttribute('aria-disabled', 'true');
  });

  test('moves on to the next row, or adds one, with the Enter key in a value field', async () => {
    const { draft } = await renderEditor({ color: 'red', size: 'L' });

    await page.getByRole('textbox', { name: 'Value' }).nth(0).click();
    await userEvent.keyboard('{Enter}');
    await expect.element(page.getByRole('textbox', { name: 'Key' }).nth(1)).toHaveFocus();

    await page.getByRole('textbox', { name: 'Value' }).nth(1).click();
    await userEvent.keyboard('{Enter}');
    await expect.poll(getRows).toEqual([
      ['color', 'red'],
      ['size', 'L'],
      ['', ''],
    ]);

    // Nothing happens at the limit
    await renderEditor({ color: 'red' }, { config: { max: 1 } });
    await page.getByRole('textbox', { name: 'Value' }).nth(3).click();
    await userEvent.keyboard('{Enter}');
    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
    expect(page.getByRole('row').elements()).toHaveLength(6);
    expect(getStoredPairs(draft)).toEqual({ color: 'red', size: 'L' });
  });

  test('follows an external change to the pairs', async () => {
    const { draft } = await renderEditor({ color: 'red' });

    draft.currentValues._default['meta.size'] = 'L';
    await expect.poll(getRows).toEqual([
      ['color', 'red'],
      ['size', 'L'],
    ]);
  });

  test('mirrors the keys of the default locale', async () => {
    await renderEditor({ color: 'red' }, { config: { i18n: 'duplicate_keys' }, locale: 'fr' });

    await expect
      .element(page.getByRole('textbox', { name: 'Key' }))
      .toHaveAttribute('aria-readonly', 'true');
    await expect
      .element(page.getByRole('textbox', { name: 'Value' }))
      .not.toHaveAttribute('aria-readonly', 'true');
  });

  test('locks the keys when read-only', async () => {
    await renderEditor({ color: 'red' }, { readonly: true });

    await expect
      .element(page.getByRole('textbox', { name: 'Key' }))
      .toHaveAttribute('aria-readonly', 'true');
    expect(page.getByRole('button', { name: 'Remove' }).elements()).toHaveLength(0);
    await expect
      .element(page.getByRole('button', { name: 'Add' }))
      .toHaveAttribute('aria-disabled', 'true');
  });
});
