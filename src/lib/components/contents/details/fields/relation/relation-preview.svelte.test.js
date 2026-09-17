import { beforeEach, describe, expect, test, vi } from 'vitest';

import { getOptions, getRefEntries } from '$lib/services/contents/fields/relation/helpers';
import { createMockDraft, renderWithDraft } from '$lib/test/draft';

import RelationPreview from './relation-preview.svelte';

/**
 * @import { Entry, PendingEntry } from '$lib/types/private';
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
 * @returns {Promise<HTMLElement>} Container.
 */
const renderPreview = async (
  currentValue,
  config = {},
  { locale = 'en', pendingEntries = [] } = {},
) => {
  const { container } = await renderWithDraft(RelationPreview, {
    draft: createMockDraft({ fields: [fieldConfig], draft: { pendingEntries } }),
    props: {
      locale,
      keyPath: 'author',
      typedKeyPath: 'author',
      fieldConfig: { ...fieldConfig, ...config },
      currentValue,
    },
  });

  return container;
};

describe('RelationPreview', () => {
  beforeEach(() => {
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
