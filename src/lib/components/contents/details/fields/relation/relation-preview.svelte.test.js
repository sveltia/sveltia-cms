import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';

import { getOptions, getRefEntries } from '$lib/services/contents/fields/relation/helpers';

import RelationPreview from './relation-preview.svelte';

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

/**
 * Render the preview.
 * @param {string | string[] | undefined} currentValue Field value.
 * @param {Partial<RelationField>} [config] Field options.
 * @returns {Promise<HTMLElement>} Container.
 */
const renderPreview = async (currentValue, config = {}) => {
  const { container } = await render(RelationPreview, {
    locale: 'en',
    keyPath: 'author',
    typedKeyPath: 'author',
    fieldConfig: { ...fieldConfig, ...config },
    currentValue,
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
    expect(getOptions).toHaveBeenCalledWith({ locale: 'en', fieldConfig, refEntries });
  });

  test('lists the labels of multiple referenced entries in the stored order', async () => {
    expect(
      await renderPreview(['elsie-dean', 'melvin-lucas'], { multiple: true }),
    ).toHaveTextContent('Elsie Dean, Melvin Lucas');
  });

  test('shows a value that is not found in the options as is', async () => {
    expect(await renderPreview('deleted-entry')).toHaveTextContent('deleted-entry');
  });

  test('marks the paragraph with the language and direction', async () => {
    const { container } = await render(RelationPreview, {
      locale: 'ar',
      keyPath: 'author',
      typedKeyPath: 'author',
      fieldConfig,
      currentValue: 'melvin-lucas',
    });

    const paragraph = container.querySelector('p');

    expect(paragraph).toHaveAttribute('lang', 'ar');
    expect(paragraph).toHaveAttribute('dir', 'rtl');
  });

  test('shows nothing when there is no value', async () => {
    expect((await renderPreview(undefined)).children).toHaveLength(0);
    expect((await renderPreview([], { multiple: true })).children).toHaveLength(0);
  });
});
