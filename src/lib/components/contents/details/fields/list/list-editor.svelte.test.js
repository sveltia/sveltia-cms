import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { createMockDraft, renderWithDraft } from '$lib/test/draft';

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
const renderEditor = async (fieldConfig, values) => {
  const { container } = await renderWithDraft(ListEditor, {
    draft: createMockDraft({ fields: [fieldConfig], values: { _default: values } }),
    props: {
      locale: '_default',
      keyPath: fieldConfig.name,
      typedKeyPath: fieldConfig.name,
      fieldId: fieldConfig.name,
      fieldLabel: fieldConfig.name,
      fieldConfig,
      currentValue: Object.values(values),
    },
  });

  return container;
};

describe('ListEditor', () => {
  test('renders a simple list as text inputs within a group', async () => {
    await renderEditor({ name: 'tags', widget: 'list' }, { 'tags.0': 'a', 'tags.1': 'b' });

    expect(page.getByRole('group').element().getAttribute('aria-labelledby')).toMatch(/-summary$/);
    expect(page.getByRole('textbox', { name: 'Item Value' }).elements()).toHaveLength(2);
  });

  test('renders a list with subfields as expandable items', async () => {
    await renderEditor(
      { name: 'authors', widget: 'list', fields: [{ name: 'name', widget: 'string' }] },
      { 'authors.0.name': 'Melvin' },
    );

    expect(page.getByRole('textbox', { name: 'Item Value' }).elements()).toHaveLength(0);
    // The list itself and the item are both expandable
    expect(page.getByRole('button', { name: 'Collapse' }).elements()).toHaveLength(2);
  });
});
