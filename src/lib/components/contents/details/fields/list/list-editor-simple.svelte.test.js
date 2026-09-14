import { describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { createMockDraft, renderWithDraft } from '$lib/test/draft';

import ListEditorSimple from './list-editor-simple.svelte';

/**
 * @import { SimpleListField } from '$lib/types/public';
 */

vi.mock('$lib/services/user/env.svelte', async () => {
  const { createState } = await import('$lib/services/utils/state.svelte');

  return { env: createState({ hasMouse: true }), initUserEnvDetection: vi.fn() };
});

/**
 * Render the editor within a draft.
 * @param {string[]} value Field value.
 * @param {object} [options] Options.
 * @param {Partial<SimpleListField>} [options.config] Field options.
 * @param {boolean} [options.readonly] Whether the field is read-only.
 * @returns {Promise<{ draft: any, props: any, container: HTMLElement }>} Draft, props and
 * container.
 */
const renderEditor = async (value, { config = {}, readonly = false } = {}) => {
  /** @type {SimpleListField} */
  const fieldConfig = { name: 'tags', widget: 'list', ...config };

  const draft = createMockDraft({
    fields: [fieldConfig],
    values: { _default: Object.fromEntries(value.map((item, index) => [`tags.${index}`, item])) },
  });

  const props = $state({
    locale: '_default',
    keyPath: 'tags',
    typedKeyPath: 'tags',
    fieldId: 'tags',
    fieldLabel: 'Tags',
    fieldConfig,
    currentValue: value,
    readonly,
  });

  const { container } = await renderWithDraft(ListEditorSimple, { draft, props });

  return { draft, props, container };
};

/**
 * Get the items stored in the draft. The list itself is stored as an empty placeholder next to the
 * numbered item keys.
 * @param {any} draft Draft.
 * @returns {string[]} Items.
 */
const getStoredItems = (draft) =>
  Object.entries(draft.currentValues._default)
    .filter(([key]) => key.startsWith('tags.'))
    .map(([, value]) => value);

/**
 * Get the values of the item inputs.
 * @returns {string[]} Values.
 */
const getInputValues = () =>
  page
    .getByRole('textbox', { name: 'Item Value' })
    .elements()
    .map((input) => /** @type {HTMLInputElement} */ (input).value);

describe('ListEditorSimple', () => {
  test('shows an input per item', async () => {
    await renderEditor(['a', 'b']);

    expect(getInputValues()).toEqual(['a', 'b']);
  });

  test('shows one empty input for an empty list, without item controls', async () => {
    await renderEditor([]);

    expect(getInputValues()).toEqual(['']);
    await expect
      .element(page.getByRole('button', { name: 'Remove' }))
      .toHaveAttribute('aria-disabled', 'true');
    await expect
      .element(page.getByRole('button', { name: 'Reorder Item' }))
      .toHaveAttribute('aria-disabled', 'true');
    await expect.element(page.getByRole('textbox')).toHaveAttribute('aria-required', 'true');
  });

  test('stores the edited items, skipping blank ones', async () => {
    const { draft } = await renderEditor(['a', 'b']);

    await page.getByRole('textbox').nth(1).fill('  ');
    await expect.poll(() => getStoredItems(draft)).toEqual(['a']);

    await page.getByRole('textbox').nth(1).fill('c');
    await expect.poll(() => getStoredItems(draft)).toEqual(['a', 'c']);
  });

  test('adds an item with the button or the Enter key', async () => {
    await renderEditor(['a']);

    await page.getByRole('button', { name: /Add\W+tags/ }).click();
    await expect.poll(getInputValues).toEqual(['a', '']);
    await expect.element(page.getByRole('textbox').nth(1)).toHaveFocus();

    await page.getByRole('textbox').nth(0).element().focus();
    await userEvent.keyboard('{Enter}');
    await expect.poll(getInputValues).toEqual(['a', '', '']);
    await expect.element(page.getByRole('textbox').nth(1)).toHaveFocus();
  });

  test('does not add an item beyond the maximum', async () => {
    await renderEditor(['a', 'b'], { config: { max: 2 } });

    await expect
      .element(page.getByRole('button', { name: /Add\W+tags/ }))
      .toHaveAttribute('aria-disabled', 'true');
    await page.getByRole('textbox').nth(0).element().focus();
    await userEvent.keyboard('{Enter}');
    expect(getInputValues()).toEqual(['a', 'b']);
  });

  test('removes an item', async () => {
    const { draft } = await renderEditor(['a', 'b', 'c']);

    await page.getByRole('button', { name: 'Remove' }).nth(1).click();

    await expect.poll(getInputValues).toEqual(['a', 'c']);
    await expect.poll(() => getStoredItems(draft)).toEqual(['a', 'c']);
    await expect.element(page.getByRole('textbox').nth(1)).toHaveFocus();
  });

  test('reorders an item with the keyboard', async () => {
    const { draft } = await renderEditor(['a', 'b', 'c']);

    await page.getByRole('button', { name: 'Reorder Item' }).nth(2).element().focus();
    await userEvent.keyboard('{Home}');

    await expect.poll(getInputValues).toEqual(['c', 'a', 'b']);
    await expect.poll(() => getStoredItems(draft)).toEqual(['c', 'a', 'b']);
    await expect.element(page.getByRole('button', { name: 'Reorder Item' }).nth(0)).toHaveFocus();
  });

  test('reorders an item by dragging', async () => {
    const { draft, container } = await renderEditor(['a', 'b']);

    await expect.poll(() => container.querySelectorAll('.item').length).toBe(2);

    const [first, second] = container.querySelectorAll('.item');
    const dataTransfer = new DataTransfer();
    // Grab the item with the handle, then drag it below the other item
    const handle = page.getByRole('button', { name: 'Reorder Item' }).nth(0);

    handle.element().dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    await expect.poll(() => first.getAttribute('draggable')).toBe('true');

    first.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer }));
    expect(dataTransfer.getData('text/plain')).toBe('a');

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

    await expect.poll(() => getStoredItems(draft)).toEqual(['b', 'a']);
    await expect
      .poll(() => container.querySelector('.item')?.getAttribute('draggable'))
      .toBe('false');

    // Releasing the handle without dragging
    handle.element().dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    await expect
      .poll(() => container.querySelector('.item')?.getAttribute('draggable'))
      .toBe('true');
    handle.element().dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
    await expect
      .poll(() => container.querySelector('.item')?.getAttribute('draggable'))
      .toBe('false');
  });

  test('follows an external change to the value', async () => {
    const { props } = await renderEditor(['a']);

    props.currentValue = ['x', 'y'];

    await expect.poll(getInputValues).toEqual(['x', 'y']);

    // A removed value leaves one empty input
    props.currentValue = undefined;

    await expect.poll(getInputValues).toEqual(['']);
  });

  test('hides the controls when read-only', async () => {
    await renderEditor(['a', 'b'], { readonly: true });

    expect(page.getByRole('button').elements()).toHaveLength(0);
    await expect.element(page.getByRole('textbox').nth(0)).toHaveAttribute('aria-readonly', 'true');
  });
});
