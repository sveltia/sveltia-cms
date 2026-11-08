import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { createMockDraft, renderWithDraft } from '$lib/test/draft';

import SubfieldPreviews from './subfield-previews.svelte';

/**
 * @import { Field, VariableFieldType } from '$lib/types/public';
 */

/** @type {Field[]} */
const fields = [
  { name: 'name', widget: 'string' },
  { name: 'role', widget: 'string' },
];

/** @type {VariableFieldType[]} */
const types = [{ name: 'hero', label: 'Hero', fields: [{ name: 'heading', widget: 'string' }] }];

/**
 * Render the previews within a draft.
 * @param {Record<string, any>} values Flattened values.
 * @param {Record<string, any>} props Props other than the locale and the key paths.
 * @returns {Promise<HTMLElement>} Container.
 */
const renderPreviews = async (values, props) =>
  (
    await renderWithDraft(SubfieldPreviews, {
      draft: createMockDraft({
        fields: [{ name: 'author', widget: 'object', fields, types }],
        values: { _default: values },
      }),
      props: { locale: '_default', keyPath: 'author', typedKeyPath: 'posts.*.author', ...props },
    })
  ).container;

describe('SubfieldPreviews', () => {
  test('groups the subfield previews without a label', async () => {
    const container = await renderPreviews(
      { 'author.name': 'Melvin', 'author.role': 'Editor' },
      { fields },
    );

    const group = /** @type {Element} */ (container.querySelector('[role="group"].subsection'));
    const sections = group.querySelectorAll('section');

    expect(group).not.toHaveAttribute('aria-labelledby');
    expect(container.querySelector('.header')).toBeNull();
    expect(sections).toHaveLength(2);
    expect(sections[1]).toHaveAttribute('data-key-path', 'author.role');
    expect(sections[1]).toHaveAttribute('data-typed-key-path', 'posts.*.author.role');
    // Each subfield is marked outside its lazily rendered preview
    expect(sections[1].parentElement).toHaveAttribute('data-lazy-key-path', 'author.role');
  });

  test('groups the subfields of a variable type under its label', async () => {
    await renderPreviews({ 'author.heading': 'Welcome' }, { types, type: 'hero' });

    const group = page.getByRole('group', { name: 'Hero' });

    await expect.element(group.getByText('Welcome')).toBeVisible();
    expect(group.element().querySelector('section')).toHaveAttribute(
      'data-typed-key-path',
      'posts.*.author<hero>.heading',
    );
  });

  test('gives a single subfield the key path of the value itself', async () => {
    const container = await renderPreviews(
      { author: 'Melvin' },
      { fields: [{ name: 'name', widget: 'string' }], single: true },
    );

    expect(container.querySelector('section')).toHaveAttribute('data-key-path', 'author');
  });

  test('renders nothing for an unknown type', async () => {
    const container = await renderPreviews({ 'author.url': 'x' }, { types, type: 'video' });

    expect(container.querySelector('[role="group"]')).toBeNull();
  });

  test('hides the items when no subfield is shown', async () => {
    const container = await renderPreviews(
      {},
      { fields: [{ name: 'secret', widget: 'string', preview: false }] },
    );

    expect(container.querySelector('[data-lazy-key-path]')).not.toBeNull();
    expect(
      getComputedStyle(/** @type {Element} */ (container.querySelector('.items'))).display,
    ).toBe('none');
  });

  test('shows the items while a subfield is waiting to be rendered', async () => {
    const container = await renderPreviews({ 'author.name': 'Melvin' }, { fields });

    expect(
      getComputedStyle(/** @type {Element} */ (container.querySelector('.items'))).display,
    ).not.toBe('none');
  });
});
