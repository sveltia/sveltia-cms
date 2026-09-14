import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { createMockDraft, renderWithDraft } from '$lib/test/draft';

import ListPreviewComplex from './list-preview-complex.svelte';

/**
 * @import { ComplexListField } from '$lib/types/public';
 */

/**
 * Render the preview within a draft.
 * @param {ComplexListField} fieldConfig Field configuration.
 * @param {Record<string, any>} values Flattened values.
 * @returns {Promise<HTMLElement>} Container.
 */
const renderPreview = async (fieldConfig, values) => {
  const { container } = await renderWithDraft(ListPreviewComplex, {
    draft: createMockDraft({ fields: [fieldConfig], values: { _default: values } }),
    props: {
      locale: '_default',
      keyPath: fieldConfig.name,
      typedKeyPath: fieldConfig.name,
      fieldConfig,
      currentValue: undefined,
    },
  });

  return container;
};

describe('ListPreviewComplex', () => {
  test('previews the subfields of each item', async () => {
    const container = await renderPreview(
      {
        name: 'authors',
        widget: 'list',
        fields: [
          { name: 'name', widget: 'string' },
          { name: 'role', widget: 'string' },
        ],
      },
      {
        'authors.0.name': 'Melvin',
        'authors.0.role': 'Editor',
        'authors.1.name': 'Elsie',
        'authors.1.role': 'Writer',
      },
    );

    const groups = container.querySelectorAll('[role="group"].subsection');

    expect(groups).toHaveLength(2);
    expect([...groups[0].querySelectorAll('p')].map((p) => p.textContent)).toEqual([
      'Melvin',
      'Editor',
    ]);
    expect([...groups[1].querySelectorAll('p')].map((p) => p.textContent)).toEqual([
      'Elsie',
      'Writer',
    ]);
    expect(groups[1].querySelector('section')).toHaveAttribute('data-key-path', 'authors.1.name');
    expect(groups[1].querySelector('section')).toHaveAttribute(
      'data-typed-key-path',
      'authors.*.name',
    );
  });

  test('previews a single subfield stored as the item itself', async () => {
    const container = await renderPreview(
      { name: 'links', widget: 'list', field: { name: 'url', widget: 'string', type: 'url' } },
      { 'links.0': 'https://example.com/', 'links.1': 'https://example.org/' },
    );

    const sections = container.querySelectorAll('section');

    expect(sections).toHaveLength(2);
    expect(sections[0]).toHaveAttribute('data-key-path', 'links.0');
    expect(sections[0].querySelector('a')).toHaveAttribute('href', 'https://example.com/');
  });

  test('previews items of variable types under their labels', async () => {
    const container = await renderPreview(
      {
        name: 'sections',
        widget: 'list',
        types: [
          { name: 'hero', label: 'Hero', fields: [{ name: 'heading', widget: 'string' }] },
          { name: 'quote', fields: [{ name: 'text', widget: 'text' }] },
        ],
      },
      {
        'sections.0.type': 'hero',
        'sections.0.heading': 'Welcome',
        'sections.1.type': 'unknown',
        'sections.1.foo': 'bar',
        'sections.2.type': 'quote',
        'sections.2.text': 'Hi',
      },
    );

    await expect
      .element(page.getByRole('group', { name: 'Hero' }).getByText('Welcome'))
      .toBeVisible();
    await expect.element(page.getByRole('group', { name: 'quote' }).getByText('Hi')).toBeVisible();
    // The unknown type is skipped
    expect(container.querySelectorAll('[role="group"].subsection')).toHaveLength(2);
    expect(container.querySelector('section')).toHaveAttribute(
      'data-typed-key-path',
      'sections.*<hero>.heading',
    );
  });

  test('shows nothing when the list is empty', async () => {
    expect(
      (await renderPreview({ name: 'authors', widget: 'list', fields: [] }, {})).children,
    ).toHaveLength(0);
  });
});
