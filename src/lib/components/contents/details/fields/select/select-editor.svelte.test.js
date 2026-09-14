import { sleep } from '@sveltia/utils/misc';
import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { createMockDraft, renderWithDraft } from '$lib/test/draft';

import SelectEditor from './select-editor.svelte';

/**
 * @import { SelectField, SelectFieldValue } from '$lib/types/public';
 */

/**
 * Render the editor within a draft.
 * @param {object} args Arguments.
 * @param {Partial<SelectField>} args.config Field options.
 * @param {SelectFieldValue | SelectFieldValue[] | undefined} [args.currentValue] Field value.
 * @param {Record<string, any>} [args.values] Flattened values in the draft.
 * @param {boolean} [args.required] Whether the field is required.
 * @param {boolean} [args.sortOptions] Whether to sort the options.
 * @returns {Promise<{ props: { currentValue: any }, draft: any }>} Props and draft.
 */
const renderEditor = async ({
  config,
  currentValue = undefined,
  values = {},
  required = true,
  sortOptions = false,
}) => {
  /** @type {SelectField} */
  const fieldConfig = { name: 'category', widget: 'select', options: [], ...config };
  const draft = createMockDraft({ fields: [fieldConfig], values: { _default: values } });

  const props = $state({
    locale: '_default',
    keyPath: 'category',
    typedKeyPath: 'category',
    fieldId: 'category',
    fieldLabel: 'Category',
    fieldConfig,
    currentValue,
    required,
    sortOptions,
  });

  await renderWithDraft(SelectEditor, { draft, props });
  // A Sveltia UI group starts handling clicks and keys 100 ms after it’s mounted
  await sleep(150);

  return { props, draft };
};

describe('SelectEditor', () => {
  describe('single', () => {
    test('shows a few options as radio buttons', async () => {
      const { props } = await renderEditor({
        config: { options: ['apple', 'banana'] },
        currentValue: 'apple',
      });

      const group = page.getByRole('radiogroup');

      await expect.element(group).toHaveAttribute('aria-labelledby', 'category-label');
      await expect.element(group.getByRole('radio', { name: 'apple' })).toBeChecked();

      await group.getByRole('radio', { name: 'banana' }).click();
      expect(props.currentValue).toBe('banana');
    });

    test('shows labelled options, sorted when requested', async () => {
      await renderEditor({
        config: {
          options: [
            { label: 'Banana', value: 'banana' },
            { label: 'Apple', value: 'apple' },
          ],
        },
        sortOptions: true,
      });

      const radios = page.getByRole('radio');

      await expect.element(radios.nth(0)).toHaveAccessibleName('Apple');
      await expect.element(radios.nth(1)).toHaveAccessibleName('Banana');
    });

    test('offers an empty option when the field is optional', async () => {
      const { props } = await renderEditor({
        config: { options: ['apple', 'banana'] },
        currentValue: 'apple',
        required: false,
      });

      await page.getByRole('radio', { name: '(None)' }).click();
      expect(props.currentValue).toBe('');
    });

    test('shows many options in a dropdown', async () => {
      const { props } = await renderEditor({
        config: { options: ['a', 'b', 'c', 'd', 'e', 'f'] },
        currentValue: 'b',
      });

      const select = page.getByRole('combobox');

      await expect.element(select).toHaveAttribute('aria-labelledby', 'category-label');
      await expect.element(select).toHaveTextContent('b');
      await select.click();
      await page.getByRole('option', { name: 'e' }).click();
      expect(props.currentValue).toBe('e');
    });
  });

  describe('multiple', () => {
    test('shows a few options as checkboxes and updates the draft', async () => {
      const { draft } = await renderEditor({
        config: { options: ['apple', 'banana', 'cherry'], multiple: true },
        currentValue: ['banana'],
        values: { 'category.0': 'banana' },
      });

      const apple = page.getByRole('checkbox', { name: 'apple' });
      const banana = page.getByRole('checkbox', { name: 'banana' });

      await expect.element(banana).toBeChecked();
      await expect.element(apple).not.toBeChecked();

      await apple.click();
      expect(draft.currentValues._default).toEqual({
        'category.0': 'banana',
        'category.1': 'apple',
      });

      await banana.click();
      expect(draft.currentValues._default).toEqual({ 'category.0': 'apple' });
    });

    test('shows many options as tags', async () => {
      const { draft } = await renderEditor({
        config: { options: ['a', 'b', 'c', 'd', 'e', 'f'], multiple: true },
        currentValue: ['b'],
        values: { 'category.0': 'b' },
      });

      await page.getByRole('combobox').click();
      await page.getByRole('option', { name: 'e' }).click();

      expect(draft.currentValues._default).toEqual({ 'category.0': 'b', 'category.1': 'e' });
    });
  });
});
