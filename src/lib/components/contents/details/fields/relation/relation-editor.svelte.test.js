import { sleep } from '@sveltia/utils/misc';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { getOptions, getRefEntries } from '$lib/services/contents/fields/relation/helpers';
import { createMockDraft, renderWithDraft } from '$lib/test/draft';

import RelationEditor from './relation-editor.svelte';

/**
 * @import { Entry } from '$lib/types/private';
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

describe('RelationEditor', () => {
  beforeEach(() => {
    vi.mocked(getRefEntries).mockReturnValue(refEntries);
    vi.mocked(getOptions).mockReturnValue([
      { label: 'Melvin Lucas', value: 'melvin-lucas', searchValue: 'Melvin Lucas' },
      { label: 'Elsie Dean', value: 'elsie-dean', searchValue: 'Elsie Dean' },
    ]);
  });

  test('offers the referenced entries as sorted options', async () => {
    const props = $state({
      locale: '_default',
      keyPath: 'author',
      typedKeyPath: 'author',
      fieldId: 'author',
      fieldLabel: 'Author',
      fieldConfig,
      currentValue: 'melvin-lucas',
    });

    await renderWithDraft(RelationEditor, {
      draft: createMockDraft({
        fields: [fieldConfig],
        values: { _default: { author: 'melvin-lucas', title: 'Hello' } },
        draft: { currentSlugs: { _default: 'hello' } },
      }),
      props,
    });
    // A Sveltia UI group starts handling clicks 100 ms after it’s mounted
    await sleep(150);

    expect(getRefEntries).toHaveBeenCalledWith(fieldConfig);
    expect(getOptions).toHaveBeenCalledWith({
      locale: '_default',
      fieldConfig,
      refEntries,
      currentLocaleValues: { author: 'melvin-lucas', title: 'Hello' },
      currentSlug: 'hello',
    });

    const radios = page.getByRole('radio');

    await expect.element(radios.nth(0)).toHaveAccessibleName('Elsie Dean');
    await expect.element(radios.nth(1)).toHaveAccessibleName('Melvin Lucas');
    await expect.element(radios.nth(1)).toBeChecked();

    await radios.nth(0).click();
    expect(props.currentValue).toBe('elsie-dean');

    // The slug is shared by the locales unless localized
    await renderWithDraft(RelationEditor, {
      draft: createMockDraft({
        fields: [fieldConfig],
        values: { _default: { author: 'melvin-lucas', title: 'Hello' } },
        draft: { currentSlugs: { _: 'shared' } },
      }),
      props: { ...props },
    });
    await sleep(150);
    expect(getOptions).toHaveBeenLastCalledWith(expect.objectContaining({ currentSlug: 'shared' }));
  });
});
