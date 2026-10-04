import { sleep } from '@sveltia/utils/misc';
import { beforeAll, describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { createProxy } from '$lib/services/contents/draft/create/proxy.svelte';
import { initTestConfig } from '$lib/test/config';
import { createMockDraft, renderWithDraft } from '$lib/test/draft';

import KeyValueEditor from './key-value-editor.svelte';

/**
 * @import { KeyValueField } from '$lib/types/public';
 */

vi.mock('$lib/services/user/env.svelte', async () => {
  const { createState } = await import('$lib/services/utils/state.svelte');

  return { env: createState({ hasMouse: true }), initUserEnvDetection: vi.fn() };
});

beforeAll(async () => {
  await initTestConfig({
    collections: [
      {
        name: 'posts',
        folder: 'content/posts',
        fields: [{ name: 'meta', widget: 'keyvalue' }],
      },
    ],
  });
});

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

  // Wrap the value map like the app does, which keeps track of the order the pairs are stored in:
  // a `$state` proxy keeps a key deleted and written again in its old position
  if (!i18n) {
    draft.currentValues._default = createProxy({ draft, locale: '_default', target: values });
  }

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
 * Get the stored keys in the order they are stored in, which is the order they are saved in.
 * @param {any} draft Draft.
 * @returns {string[]} Keys.
 */
const getStoredKeys = (draft) => Object.keys(getStoredPairs(draft));

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

    await page.getByRole('button', { name: /Add\W+meta/ }).click();
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

  test('offers a blank row for an empty field, storing a placeholder so it can be validated', async () => {
    const { draft } = await renderEditor({});

    // Like a simple List field, there’s always somewhere to type
    expect(getRows()).toEqual([['', '']]);
    await expect
      .element(page.getByRole('button', { name: 'Remove' }))
      .toHaveAttribute('aria-disabled', 'true');
    await expect.poll(() => draft.currentValues._default.meta).toBe(null);
    expect(getStoredPairs(draft)).toEqual({});

    // The blank row is stored once its key is filled in
    await page.getByRole('textbox', { name: 'Key' }).fill('color');
    await expect.poll(() => getStoredPairs(draft)).toEqual({ color: '' });
    expect(draft.currentValues._default.meta).toBeUndefined();
  });

  test('leaves the blank pair of a required field’s default value alone', async () => {
    const { draft } = await renderEditor({ '': '' });

    expect(getRows()).toEqual([['', '']]);
    // Give the editor time to write to the draft, which it mustn’t, or opening an entry would
    // count as a change
    await sleep(100);
    expect(draft.currentValues._default).toEqual({ 'meta.': '' });
  });

  test('leaves a blank row once the last pair is removed', async () => {
    const { draft } = await renderEditor({ color: 'red' });

    await page.getByRole('button', { name: 'Remove' }).click();

    await expect.poll(getRows).toEqual([['', '']]);
    await expect.poll(() => getStoredPairs(draft)).toEqual({});
    await expect.poll(() => draft.currentValues._default.meta).toBe(null);
  });

  test('offers no blank row where the keys follow the default locale', async () => {
    await renderEditor({}, { config: { i18n: 'duplicate_keys' }, locale: 'fr' });

    await expect.element(page.getByRole('button', { name: /Add\W+meta/ })).toBeVisible();
    expect(getRows()).toEqual([]);
  });

  test('names the Add button after the singular label', async () => {
    await renderEditor({}, { config: { label: 'Settings', label_singular: 'Setting' } });

    await page.getByRole('button', { name: /Add\W+Setting\W*$/ }).click();
    await expect.element(page.getByRole('textbox', { name: 'Key' }).nth(1)).toHaveFocus();
  });

  test('hides the Add button at the maximum, showing it again once a pair is removed', async () => {
    await renderEditor({ color: 'red', size: 'L' }, { config: { max: 2 } });

    await expect.element(page.getByRole('textbox', { name: 'Key' }).nth(1)).toBeVisible();
    expect(page.getByRole('button', { name: /Add\W+meta/ }).elements()).toHaveLength(0);

    await page.getByRole('button', { name: 'Remove' }).nth(1).click();
    await expect.element(page.getByRole('button', { name: /Add\W+meta/ })).toBeVisible();
  });

  test('keeps the blank row of a field limited to one pair without an Add button', async () => {
    await renderEditor({ color: 'red' }, { config: { max: 1 } });

    await page.getByRole('button', { name: 'Remove' }).click();

    // The blank row takes the place of the removed pair, like the row of a simple List field
    await expect.poll(getRows).toEqual([['', '']]);
    expect(page.getByRole('button', { name: /Add\W+meta/ }).elements()).toHaveLength(0);
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

  test('reorders a pair with the keyboard', async () => {
    const { draft } = await renderEditor({ color: 'red', size: 'L', shape: 'round' });

    await page.getByRole('button', { name: 'Reorder Item' }).nth(2).element().focus();
    await userEvent.keyboard('{Home}');

    await expect.poll(getRows).toEqual([
      ['shape', 'round'],
      ['color', 'red'],
      ['size', 'L'],
    ]);
    await expect.poll(() => getStoredKeys(draft)).toEqual(['shape', 'color', 'size']);
    await expect.element(page.getByRole('button', { name: 'Reorder Item' }).nth(0)).toHaveFocus();
  });

  test('reorders a pair by dragging', async () => {
    const { draft } = await renderEditor({ color: 'red', size: 'L' });
    const [first, second] = page.getByRole('row').elements().slice(1);
    const dataTransfer = new DataTransfer();
    // Grab the row with the handle, then drag it below the other row
    const handle = page.getByRole('button', { name: 'Reorder Item' }).nth(0);

    handle.element().dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    await expect.poll(() => first.getAttribute('draggable')).toBe('true');

    first.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer }));
    expect(dataTransfer.getData('text/plain')).toBe('color');
    await expect.poll(() => first.classList.contains('dragging')).toBe(true);

    const { bottom } = second.getBoundingClientRect();

    second.dispatchEvent(
      new DragEvent('dragover', {
        bubbles: true,
        cancelable: true,
        dataTransfer,
        clientY: bottom - 1,
      }),
    );
    second.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }));
    first.dispatchEvent(new DragEvent('dragend', { bubbles: true }));

    await expect.poll(() => getStoredKeys(draft)).toEqual(['size', 'color']);
    await expect.poll(() => first.getAttribute('draggable')).toBe('false');

    // Releasing the handle without dragging
    handle.element().dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    await expect.poll(() => second.getAttribute('draggable')).toBe('true');
    handle.element().dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
    await expect.poll(() => second.getAttribute('draggable')).toBe('false');
  });

  test('disables reordering with a single pair', async () => {
    await renderEditor({ color: 'red' });

    await expect
      .element(page.getByRole('button', { name: 'Reorder Item' }))
      .toHaveAttribute('aria-disabled', 'true');
  });

  test('keeps the focus in a key while typing', async () => {
    const { draft } = await renderEditor({ color: 'red', size: 'L' });
    const key = page.getByRole('textbox', { name: 'Key' }).nth(0);
    const element = key.element();

    await key.click();
    await userEvent.keyboard('{End}s');
    // Each keystroke is saved, and the saved pairs come back from the draft
    await expect.poll(() => getStoredKeys(draft)).toEqual(['colors', 'size']);
    await userEvent.keyboard('!');
    await expect.poll(() => getStoredKeys(draft)).toEqual(['colors!', 'size']);
    expect(key.element()).toBe(element);
    await expect.element(key).toHaveFocus();
  });

  test('keeps each row and its error with its pair as the pairs are reordered or removed', async () => {
    await renderEditor({ color: 'red', size: 'L', shape: 'round' });

    const [color, size, shape] = page.getByRole('row').elements().slice(1);
    const keys = page.getByRole('textbox', { name: 'Key' });

    await keys.nth(2).fill('');
    await expect.element(keys.nth(2)).toHaveAttribute('aria-invalid', 'true');

    await page.getByRole('button', { name: 'Reorder Item' }).nth(2).element().focus();
    await userEvent.keyboard('{Home}');
    await expect.poll(getRows).toEqual([
      ['', 'round'],
      ['color', 'red'],
      ['size', 'L'],
    ]);
    expect(page.getByRole('row').elements().slice(1)).toEqual([shape, color, size]);
    await expect.element(keys.nth(0)).toHaveAttribute('aria-invalid', 'true');
    await expect.element(keys.nth(1)).not.toHaveAttribute('aria-invalid', 'true');

    await page.getByRole('button', { name: 'Remove' }).nth(1).click();
    await expect.poll(getRows).toEqual([
      ['', 'round'],
      ['size', 'L'],
    ]);
    expect(page.getByRole('row').elements().slice(1)).toEqual([shape, size]);
    await expect.element(keys.nth(0)).toHaveAttribute('aria-invalid', 'true');
    await expect.element(keys.nth(1)).not.toHaveAttribute('aria-invalid', 'true');

    await page.getByRole('button', { name: 'Remove' }).nth(0).click();
    await expect.poll(getRows).toEqual([['size', 'L']]);
    expect(page.getByRole('row').elements().slice(1)).toEqual([size]);
    expect(page.getByRole('alert').elements()).toHaveLength(0);
    await expect.element(keys.nth(0)).not.toHaveAttribute('aria-invalid', 'true');

    // A new pair gets a row of its own, which isn’t flagged until its key is edited
    await page.getByRole('button', { name: /Add\W+meta/ }).click();
    await expect.poll(getRows).toEqual([
      ['size', 'L'],
      ['', ''],
    ]);
    expect([color, size, shape]).not.toContain(page.getByRole('row').elements()[2]);
    expect(page.getByRole('alert').elements()).toHaveLength(0);
  });

  test('keeps the rows by position for an external change, clearing the errors', async () => {
    const { draft } = await renderEditor({ color: 'red', size: 'L' });
    const [color, size] = page.getByRole('row').elements().slice(1);
    const keys = page.getByRole('textbox', { name: 'Key' });

    await keys.nth(1).fill('');
    await expect.element(keys.nth(1)).toHaveAttribute('aria-invalid', 'true');

    draft.currentValues._default['meta.shape'] = 'round';
    await expect.poll(getRows).toEqual([
      ['color', 'red'],
      ['size', 'L'],
      ['shape', 'round'],
    ]);

    const rows = page.getByRole('row').elements().slice(1);

    expect(rows.slice(0, 2)).toEqual([color, size]);
    expect([color, size]).not.toContain(rows[2]);
    expect(page.getByRole('alert').elements()).toHaveLength(0);
    await expect.element(keys.nth(1)).not.toHaveAttribute('aria-invalid', 'true');
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
    // The order is mirrored from the default locale as well
    expect(page.getByRole('button', { name: 'Reorder Item' }).elements()).toHaveLength(0);
  });

  test('moves on to the next value with the Enter key where the keys follow the default locale', async () => {
    await renderEditor(
      { color: 'red', size: 'L' },
      { config: { i18n: 'duplicate_keys' }, locale: 'fr' },
    );

    await page.getByRole('textbox', { name: 'Value' }).nth(0).click();
    await userEvent.keyboard('{Enter}');
    // The key is read-only, so the focus skips it
    await expect.element(page.getByRole('textbox', { name: 'Value' }).nth(1)).toHaveFocus();
  });

  test('locks the keys when read-only', async () => {
    await renderEditor({ color: 'red' }, { readonly: true });

    await expect
      .element(page.getByRole('textbox', { name: 'Key' }))
      .toHaveAttribute('aria-readonly', 'true');
    expect(page.getByRole('button', { name: 'Remove' }).elements()).toHaveLength(0);
    await expect
      .element(page.getByRole('button', { name: /Add\W+meta/ }))
      .toHaveAttribute('aria-disabled', 'true');
  });
});
