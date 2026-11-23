import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import CascadeDeleteNote from './cascade-delete-note.svelte';

/**
 * @import { CascadeDeleteBlocker, CascadeTarget } from '$lib/types/private';
 */

/**
 * Build a cascade target.
 * @param {string} id Entry ID.
 * @returns {CascadeTarget} Target.
 */
const createTarget = (id) =>
  /** @type {any} */ ({ entry: { id, slug: id, locales: {} }, collection: { name: 'posts' } });

/**
 * Build a blocker.
 * @param {string} id Entry ID.
 * @param {Partial<CascadeDeleteBlocker>} [props] Other properties.
 * @returns {CascadeDeleteBlocker} Blocker.
 */
const createBlocker = (id, props = {}) =>
  /** @type {any} */ ({
    collectionName: 'posts',
    collectionLabel: 'Blog Posts',
    fieldLabel: 'Category',
    entry: { id, slug: id, locales: {} },
    summary: `Post ${id.toUpperCase()}`,
    locale: '_default',
    keyPath: 'category',
    messages: ['This field is required.'],
    ...props,
  });

describe('CascadeDeleteNote', () => {
  test('renders nothing when no entry references the deleted ones', async () => {
    const { container } = await render(CascadeDeleteNote, {
      plan: { targets: [], blockers: [] },
      count: 1,
    });

    expect(container.textContent?.trim()).toBe('');
  });

  test('notes the entry that loses its reference', async () => {
    const { container } = await render(CascadeDeleteNote, {
      plan: { targets: [createTarget('a')], blockers: [] },
      count: 1,
    });

    expect(container.textContent?.trim()).toBe(
      'The reference to it in another entry will be removed as well.',
    );
  });

  test('counts the entries that lose their references', async () => {
    const { container } = await render(CascadeDeleteNote, {
      plan: { targets: [createTarget('a'), createTarget('b'), createTarget('c')], blockers: [] },
      count: 2,
    });

    expect(container.textContent?.trim()).toBe(
      'The references to it in 3 other entries will be removed as well.',
    );
  });

  test('lists the fields that stand in the way of one entry’s deletion', async () => {
    await render(CascadeDeleteNote, {
      plan: {
        targets: [createTarget('a'), createTarget('b')],
        blockers: [
          createBlocker('a'),
          createBlocker('b', {
            fieldLabel: 'Tags',
            keyPath: 'tags',
            messages: ['Select at least 2 items.'],
          }),
        ],
      },
      count: 1,
    });

    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent(
        'This entry can’t be deleted, because the following fields in other entries would no ' +
          'longer be valid without it. Update those entries first.',
      );

    const items = page.getByRole('listitem');

    expect(items.elements().map((el) => el.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'Blog Posts › Post A Category: This field is required.',
      'Blog Posts › Post B Tags: Select at least 2 items.',
    ]);
  });

  test('words the explanation for several entries', async () => {
    await render(CascadeDeleteNote, {
      plan: { targets: [createTarget('a')], blockers: [createBlocker('a')] },
      count: 2,
    });

    await expect
      .element(page.getByRole('alert'))
      .toMatchTextContent('These entries can’t be deleted');
  });

  test('words the note and the explanation for assets', async () => {
    const { container } = await render(CascadeDeleteNote, {
      plan: { targets: [createTarget('a')], blockers: [] },
      kind: 'asset',
      count: 1,
    });

    expect(container.textContent?.trim()).toBe(
      'The reference to it in an entry will be removed as well.',
    );

    await render(CascadeDeleteNote, {
      plan: { targets: [createTarget('a'), createTarget('b')], blockers: [] },
      kind: 'asset',
      count: 2,
    });

    await expect
      .element(page.getByText('The references to it in 2 entries will be removed as well.'))
      .toBeVisible();

    await render(CascadeDeleteNote, {
      plan: { targets: [createTarget('a')], blockers: [createBlocker('a')] },
      kind: 'asset',
      count: 1,
    });

    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent(
        'This asset can’t be deleted, because the following fields in the entries using it ' +
          'would no longer be valid without it. Update those entries first.',
      );

    await render(CascadeDeleteNote, {
      plan: { targets: [createTarget('a')], blockers: [createBlocker('a')] },
      kind: 'asset',
      count: 2,
    });

    await expect
      .element(page.getByText('These assets can’t be deleted', { exact: false }))
      .toBeVisible();
  });
});
