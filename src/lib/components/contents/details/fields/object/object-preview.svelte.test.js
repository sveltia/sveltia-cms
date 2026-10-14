import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { createMockDraft, renderWithDraft } from '$lib/test/draft';
import { renderFieldPreview } from '$lib/test/field.svelte';

import ObjectPreview from './object-preview.svelte';

/**
 * @import { ObjectField } from '$lib/types/public';
 */

/** @type {ObjectField} */
const authorField = {
  name: 'author',
  widget: 'object',
  fields: [
    { name: 'name', widget: 'string' },
    { name: 'email', widget: 'string', type: 'email' },
  ],
};

/** @type {ObjectField} */
const blockField = {
  name: 'block',
  widget: 'object',
  types: [
    { name: 'hero', label: 'Hero', fields: [{ name: 'heading', widget: 'string' }] },
    { name: 'quote', fields: [{ name: 'text', widget: 'text' }] },
  ],
};

/**
 * Render the preview within a draft.
 * @param {ObjectField} fieldConfig Field configuration.
 * @param {Record<string, any>} values Flattened values.
 * @returns {Promise<HTMLElement>} Container.
 */
const renderPreview = async (fieldConfig, values) =>
  (
    await renderFieldPreview(ObjectPreview, {
      fieldConfig,
      locale: '_default',
      draft: createMockDraft({ fields: [fieldConfig], values: { _default: values } }),
    })
  ).container;

describe('ObjectPreview', () => {
  test('previews each subfield', async () => {
    const container = await renderPreview(authorField, {
      'author.name': 'Melvin Lucas',
      'author.email': 'melvin@example.com',
    });

    const sections = container.querySelectorAll('section');

    expect(sections).toHaveLength(2);
    expect(sections[0]).toHaveAttribute('data-key-path', 'author.name');
    // Each subfield is marked outside its lazily rendered preview, for the Edit Pane to scroll to
    expect(sections[1].parentElement).toHaveAttribute('data-lazy-key-path', 'author.email');
    expect(sections[0]).toHaveTextContent('name Melvin Lucas');
    expect(sections[1].querySelector('a')).toHaveAttribute('href', 'mailto:melvin@example.com');
    // No type label
    expect(container.querySelector('[role="group"]')).not.toHaveAttribute('aria-labelledby');
  });

  test('passes the typed key path on to the subfields', async () => {
    const { container } = await renderWithDraft(ObjectPreview, {
      draft: createMockDraft({
        fields: [authorField],
        values: { _default: { 'author.name': 'M' } },
      }),
      props: {
        locale: '_default',
        keyPath: 'author',
        typedKeyPath: 'posts.*.author',
        fieldConfig: authorField,
        currentValue: undefined,
      },
    });

    expect(container.querySelector('section')).toHaveAttribute(
      'data-typed-key-path',
      'posts.*.author.name',
    );
  });

  test('previews the subfields of the selected type under its label', async () => {
    await renderPreview(blockField, { 'block.type': 'hero', 'block.heading': 'Welcome' });

    const group = page.getByRole('group', { name: 'Hero' });

    await expect.element(group).toBeVisible();
    await expect.element(group.getByText('Welcome')).toBeVisible();
    expect(group.element().querySelector('section')).toHaveAttribute(
      'data-typed-key-path',
      'block<hero>.heading',
    );
  });

  test('falls back to the type name as the label', async () => {
    await renderPreview(blockField, { 'block.type': 'quote', 'block.text': 'Hi' });
    await expect.element(page.getByRole('group', { name: 'quote' })).toBeVisible();
  });

  test('shows nothing for an unknown type', async () => {
    expect(
      (await renderPreview(blockField, { 'block.type': 'video', 'block.url': 'x' })).children,
    ).toHaveLength(0);
  });

  test('shows nothing when the object has no values', async () => {
    expect((await renderPreview(authorField, {})).children).toHaveLength(0);
    expect((await renderPreview(authorField, { 'author.name': '' })).children).toHaveLength(0);
  });
});
