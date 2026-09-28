import { describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { createMockDraft, renderWithDraft } from '$lib/test/draft';

import SelectMultiple from './select-multiple.svelte';

/**
 * @import { SelectField } from '$lib/types/public';
 */

/**
 * Render the control within a draft.
 * @param {Record<string, any>} config Field options.
 * @param {string[]} values Current values.
 * @param {Record<string, any>} [props] Props to override.
 * @returns {Promise<any>} Draft.
 */
const renderControl = async (config, values, props = {}) => {
  const fieldConfig = { name: 'tags', widget: 'select', multiple: true, options: [], ...config };

  const draft = createMockDraft({
    fields: [fieldConfig],
    values: { _default: Object.fromEntries(values.map((value, i) => [`tags.${i}`, value])) },
  });

  await renderWithDraft(SelectMultiple, {
    draft,
    props: {
      locale: '_default',
      keyPath: 'tags',
      fieldId: 'tags',
      fieldConfig,
      currentValue: values,
      options: fieldConfig.options.map((/** @type {string} */ value) => ({
        label: value,
        value,
        searchValue: value,
      })),
      ...props,
    },
  });

  return draft;
};

describe('SelectMultiple', () => {
  test('offers a few options as checkboxes, updating the list', async () => {
    const draft = await renderControl({ options: ['a', 'b', 'c'] }, ['b']);
    const group = page.getByRole('group');

    await expect.element(group).toHaveAttribute('aria-labelledby', 'tags-label');
    await expect.element(group.getByRole('checkbox', { name: 'b' })).toBeChecked();

    await group.getByRole('checkbox', { name: 'c' }).click();
    expect(draft.currentValues._default).toEqual({ 'tags.0': 'b', 'tags.1': 'c' });

    await group.getByRole('checkbox', { name: 'b' }).click();
    expect(draft.currentValues._default).toEqual({ 'tags.0': 'c' });

    // Nothing is checked without a value
    await renderControl({ options: ['a', 'b'] }, [], { currentValue: undefined });
    expect(page.getByRole('checkbox', { checked: true }).elements()).toHaveLength(1);
  });

  test('offers many options as tags', async () => {
    const draft = await renderControl(
      { options: ['a', 'b', 'c', 'd'], dropdown_threshold: 2, max: 3 },
      ['a', 'b'],
    );

    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: 'd' }).click();
    expect(draft.currentValues._default).toEqual({ 'tags.0': 'a', 'tags.1': 'b', 'tags.2': 'd' });

    // The limit is reached, so the picker is gone
    expect(page.getByRole('combobox').elements()).toHaveLength(0);

    await page.getByRole('button', { name: 'Remove \u2068b\u2069' }).click();
    expect(draft.currentValues._default).toEqual({ 'tags.0': 'a', 'tags.1': 'd' });

    // The tags can be reordered with the keyboard
    /** @type {HTMLElement} */ (document.querySelector('.select-tags .label[tabindex]')).focus();
    await userEvent.keyboard('{End}');
    await expect.poll(() => draft.currentValues._default).toEqual({ 'tags.0': 'd', 'tags.1': 'a' });
  });

  test('removes a value from a duplicated locale only if it’s there', async () => {
    /** @type {SelectField & { options: string[] }} */
    const fieldConfig = {
      name: 'tags',
      widget: 'select',
      multiple: true,
      i18n: 'duplicate',
      options: ['a', 'b', 'c'],
    };

    const draft = createMockDraft({
      fields: [fieldConfig],
      i18n: { defaultLocale: 'en', allLocales: ['en', 'ja'] },
      values: { en: { 'tags.0': 'a', 'tags.1': 'b' }, ja: { 'tags.0': 'a', 'tags.1': 'c' } },
    });

    await renderWithDraft(SelectMultiple, {
      draft,
      props: {
        locale: 'en',
        keyPath: 'tags',
        fieldId: 'tags',
        fieldConfig,
        currentValue: ['a', 'b'],
        options: fieldConfig.options.map((value) => ({ label: value, value, searchValue: value })),
      },
    });

    await page.getByRole('checkbox', { name: 'b' }).click();
    expect(draft.currentValues.en).toEqual({ 'tags.0': 'a' });
    expect(draft.currentValues.ja).toEqual({ 'tags.0': 'a', 'tags.1': 'c' });
  });

  test('can be read-only', async () => {
    const draft = await renderControl({ options: ['a', 'b'] }, ['a'], { readonly: true });

    await expect
      .element(page.getByRole('checkbox', { name: 'a' }))
      .toHaveAttribute('aria-readonly', 'true');
    await page.getByRole('checkbox', { name: 'b' }).click({ force: true });
    expect(draft.currentValues._default).toEqual({ 'tags.0': 'a' });
  });
});
