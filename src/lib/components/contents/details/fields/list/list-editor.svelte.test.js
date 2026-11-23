import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { createMockDraft } from '$lib/test/draft';
import { renderFieldEditor } from '$lib/test/field.svelte';

import ListEditor from './list-editor.svelte';

/**
 * @import { ListField } from '$lib/types/public';
 */

/**
 * Render the editor within a draft.
 * @param {ListField} fieldConfig Field configuration.
 * @param {Record<string, any>} values Flattened values.
 * @returns {Promise<HTMLElement>} Container.
 */
const renderEditor = async (fieldConfig, values) =>
  (
    await renderFieldEditor(ListEditor, {
      fieldConfig,
      fieldLabel: fieldConfig.name,
      locale: '_default',
      currentValue: Object.values(values),
      draft: createMockDraft({ fields: [fieldConfig], values: { _default: values } }),
    })
  ).container;

describe('ListEditor', () => {
  test('renders a simple list as text inputs within a group', async () => {
    await renderEditor({ name: 'tags', widget: 'list' }, { 'tags.0': 'a', 'tags.1': 'b' });

    // There is no item count to label the list with
    expect(page.getByRole('group').element()).not.toHaveAttribute('aria-labelledby');
    expect(page.getByRole('textbox', { name: 'Item Value' }).elements()).toHaveLength(2);
  });

  test('renders a list with subfields as expandable items', async () => {
    await renderEditor(
      { name: 'authors', widget: 'list', fields: [{ name: 'name', widget: 'string' }] },
      { 'authors.0.name': 'Melvin' },
    );

    expect(page.getByRole('textbox', { name: 'Item Value' }).elements()).toHaveLength(0);
    // The list is labelled with the item count
    await expect.element(page.getByRole('group', { name: '1 authors' })).toBeVisible();
    // The list itself and the item are both expandable
    expect(page.getByRole('button', { name: 'Collapse' }).elements()).toHaveLength(2);
  });
});
