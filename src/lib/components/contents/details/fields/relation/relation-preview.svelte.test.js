import { beforeEach, describe, expect, test, vi } from 'vitest';

import { getOptions, getRefEntries } from '$lib/services/contents/fields/relation/helpers';
import { unpublishedEntries } from '$lib/services/workflow';
import { createMockDraft } from '$lib/test/draft';
import { renderFieldPreview } from '$lib/test/field.svelte';

import RelationPreview from './relation-preview.svelte';

/**
 * @import { Entry, PendingEntry, QuickAddHost } from '$lib/types/private';
 * @import { RelationField } from '$lib/types/public';
 */

vi.mock('$lib/services/contents/fields/relation/helpers', () => ({
  getEntryOptions: vi.fn(),
  getOptions: vi.fn(),
  getReferencedOptionLabel: vi.fn(),
  getRefEntries: vi.fn(),
  optionCacheMap: new Map(),
}));

/** @type {RelationField} */
const fieldConfig = { name: 'author', widget: 'relation', collection: 'members' };
const refEntries = /** @type {Entry[]} */ ([{ id: 'melvin-lucas' }, { id: 'elsie-dean' }]);

/**
 * Render the preview.
 * @param {string | string[] | undefined} currentValue Field value.
 * @param {Partial<RelationField>} [config] Field options.
 * @param {object} [options] Options.
 * @param {string} [options.locale] Locale.
 * @param {PendingEntry[]} [options.pendingEntries] Pending entries on the draft.
 * @param {QuickAddHost} [options.quickAddHost] Entry the draft is saved along with.
 * @returns {Promise<HTMLElement>} Container.
 */
const renderPreview = async (
  currentValue,
  config = {},
  { locale = 'en', pendingEntries = [], quickAddHost = undefined } = {},
) =>
  (
    await renderFieldPreview(RelationPreview, {
      fieldConfig: { ...fieldConfig, ...config },
      locale,
      currentValue,
      draft: createMockDraft({ fields: [fieldConfig], draft: { pendingEntries, quickAddHost } }),
    })
  ).container;

describe('RelationPreview', () => {
  beforeEach(() => {
    unpublishedEntries.current = [];
    vi.mocked(getRefEntries).mockReturnValue(refEntries);
    vi.mocked(getOptions).mockReturnValue([
      { label: 'Melvin Lucas', value: 'melvin-lucas', searchValue: 'Melvin Lucas' },
      { label: 'Elsie Dean', value: 'elsie-dean', searchValue: 'Elsie Dean' },
    ]);
  });

  test('shows the label of the referenced entry', async () => {
    expect(await renderPreview('melvin-lucas')).toHaveTextContent('Melvin Lucas');
    expect(getRefEntries).toHaveBeenCalledWith(fieldConfig);
    expect(getOptions).toHaveBeenCalledWith({
      locale: 'en',
      fieldConfig,
      refEntries,
      pendingEntries: [],
    });
  });

  test('lists the labels of multiple referenced entries in the stored order', async () => {
    expect(
      await renderPreview(['elsie-dean', 'melvin-lucas'], { multiple: true }),
    ).toHaveTextContent('Elsie Dean, Melvin Lucas');
  });

  test('shows a value that is not found in the options as is', async () => {
    expect(await renderPreview('deleted-entry')).toHaveTextContent('deleted-entry');
  });

  test('offers the pending entries of the draft along with the saved ones', async () => {
    const pendingEntry = /** @type {Entry} */ ({ id: 'new-member', slug: 'new-member' });

    await renderPreview(
      'new-member',
      {},
      {
        pendingEntries: [
          {
            collectionName: 'members',
            entry: pendingEntry,
            changes: [],
            savingAssets: [],
            values: ['new-member'],
          },
          // Belongs to another collection, so it’s left out
          {
            collectionName: 'tags',
            entry: /** @type {Entry} */ ({ id: 'tag', slug: 'tag' }),
            changes: [],
            savingAssets: [],
            values: ['tag'],
          },
        ],
      },
    );

    expect(getOptions).toHaveBeenCalledWith({
      locale: 'en',
      fieldConfig,
      refEntries: [...refEntries, pendingEntry],
      // Also passed on their own, so a label referring to another pending entry resolves
      pendingEntries: [
        expect.objectContaining({ entry: pendingEntry }),
        expect.objectContaining({ collectionName: 'tags' }),
      ],
    });
  });

  test('resolves the labels against the entries in the pull request of the host entry', async () => {
    // An earlier save of the host entry has committed a new entry and changed an existing one in
    // its pull request, which a label can refer to through a Relation field of the entry
    const companions = [
      {
        collectionName: 'teams',
        entry: /** @type {Entry} */ ({ id: 'new-team', slug: 'new-team' }),
      },
      {
        collectionName: 'teams',
        entry: /** @type {Entry} */ ({ id: 'old-team', slug: 'old-team' }),
        edited: true,
      },
    ];

    const pendingEntry = {
      collectionName: 'teams',
      entry: /** @type {Entry} */ ({ id: 'old-team', slug: 'old-team' }),
      changes: [],
      savingAssets: [],
      values: ['old-team'],
    };

    unpublishedEntries.current = [
      /** @type {any} */ ({
        id: 'hello',
        workflow: { pullRequest: { branch: 'cms/posts/hello' }, companions },
      }),
    ];

    await renderPreview(
      'melvin-lucas',
      {},
      {
        pendingEntries: [pendingEntry],
        quickAddHost: {
          collectionName: 'posts',
          workflow: true,
          branch: 'cms/posts/hello',
          entryIds: ['hello'],
        },
      },
    );

    // The entries pending on the draft come last, so they take the place of an earlier version
    expect(getOptions).toHaveBeenCalledWith(
      expect.objectContaining({ pendingEntries: [...companions, pendingEntry] }),
    );
  });

  test('marks the paragraph with the language and direction', async () => {
    const container = await renderPreview('melvin-lucas', {}, { locale: 'ar' });
    const paragraph = container.querySelector('p');

    expect(paragraph).toHaveAttribute('lang', 'ar');
    expect(paragraph).toHaveAttribute('dir', 'rtl');
  });

  test('shows nothing when there is no value', async () => {
    expect((await renderPreview(undefined)).children).toHaveLength(0);
    expect((await renderPreview([], { multiple: true })).children).toHaveLength(0);
  });
});
