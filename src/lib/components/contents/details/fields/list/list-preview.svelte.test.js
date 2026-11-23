import { describe, expect, test } from 'vitest';

import { createMockDraft } from '$lib/test/draft';
import { renderFieldPreview } from '$lib/test/field.svelte';

import ListPreview from './list-preview.svelte';

/**
 * @import { ListField } from '$lib/types/public';
 */

/**
 * Render the preview within a draft.
 * @param {ListField} fieldConfig Field configuration.
 * @param {Record<string, any>} values Flattened values.
 * @returns {Promise<HTMLElement>} Container.
 */
const renderPreview = async (fieldConfig, values) =>
  (
    await renderFieldPreview(ListPreview, {
      fieldConfig,
      locale: '_default',
      currentValue: Object.values(values),
      draft: createMockDraft({ fields: [fieldConfig], values: { _default: values } }),
    })
  ).container;

describe('ListPreview', () => {
  test('renders a simple list as a bulleted list', async () => {
    const container = await renderPreview(
      { name: 'tags', widget: 'list' },
      { 'tags.0': 'a', 'tags.1': 'b' },
    );

    expect([...container.querySelectorAll('li')].map((li) => li.textContent)).toEqual(['a', 'b']);
  });

  test('renders a list with subfields as subsections', async () => {
    const container = await renderPreview(
      { name: 'authors', widget: 'list', fields: [{ name: 'name', widget: 'string' }] },
      { 'authors.0.name': 'Melvin' },
    );

    expect(container.querySelector('ul')).toBeNull();
    expect(container.querySelector('.subsection')).toHaveTextContent('name Melvin');
  });
});
