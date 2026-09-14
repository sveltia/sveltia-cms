import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { createMockDraft, renderWithDraft } from '$lib/test/draft';

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
const renderPreview = async (fieldConfig, values) => {
  const { container } = await renderWithDraft(ObjectPreview, {
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

describe('ObjectPreview', () => {
  test('previews each subfield', async () => {
    const container = await renderPreview(authorField, {
      'author.name': 'Melvin Lucas',
      'author.email': 'melvin@example.com',
    });

    const sections = container.querySelectorAll('section');

    expect(sections).toHaveLength(2);
    expect(sections[0]).toHaveAttribute('data-key-path', 'author.name');
    expect(sections[0]).toHaveTextContent('name Melvin Lucas');
    expect(sections[1].querySelector('a')).toHaveAttribute('href', 'mailto:melvin@example.com');
    // No type label
    expect(container.querySelector('[role="group"]')).not.toHaveAttribute('aria-labelledby');
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
