import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getCollection } from '$lib/services/contents/collection';
import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
import { getReferencedPendingEntries } from '$lib/services/contents/draft/pending-entries';
import { createSavingEntryData } from '$lib/services/contents/draft/save/changes';
import { assignManualSortOrder } from '$lib/services/contents/draft/save/sort-order';
import { getCanonicalSlug, getFillSlugOptions, getSlugs } from '$lib/services/contents/draft/slugs';
import { getEntryOptions } from '$lib/services/contents/fields/relation/helpers';
import { isWorkflowDraft, isWorkflowEnabled } from '$lib/services/workflow';

import {
  createPendingEntry,
  getCreatableCollection,
  getNestedPendingEntries,
  getPendingEntrySlugs,
  getPendingRefEntries,
  hasCreationRoom,
  selectPendingEntry,
} from './quick-add';

/**
 * @import { Entry, EntryDraft, PendingEntry } from '$lib/types/private';
 * @import { RelationField } from '$lib/types/public';
 */

vi.mock('$lib/services/contents/collection', () => ({
  getCollection: vi.fn(),
}));

vi.mock('$lib/services/contents/collection/entries', () => ({
  getEntriesByCollection: vi.fn(() => []),
}));

vi.mock('$lib/services/contents/draft/pending-entries', () => ({
  getReferencedPendingEntries: vi.fn(),
}));

vi.mock('$lib/services/contents/draft/save/changes', () => ({
  createSavingEntryData: vi.fn(),
}));

vi.mock('$lib/services/contents/draft/save/sort-order', () => ({
  assignManualSortOrder: vi.fn(),
}));

vi.mock('$lib/services/contents/draft/slugs', () => ({
  getCanonicalSlug: vi.fn(),
  getFillSlugOptions: vi.fn(() => ({ content: {} })),
  getSlugs: vi.fn(),
}));

vi.mock('$lib/services/contents/fields/relation/helpers', () => ({
  getEntryOptions: vi.fn(),
}));

vi.mock('$lib/services/workflow', () => ({
  isWorkflowDraft: vi.fn(() => false),
  isWorkflowEnabled: vi.fn(() => false),
}));

/** @type {RelationField} */
const fieldConfig = { name: 'tags', widget: 'relation', collection: 'tags' };
const tagCollection = /** @type {any} */ ({ name: 'tags', _type: 'entry' });

/**
 * Build a pending entry.
 * @param {string} slug Slug.
 * @param {string} [collectionName] Collection name.
 * @returns {PendingEntry} Pending entry.
 */
const createPending = (slug, collectionName = 'tags') => ({
  collectionName,
  entry: /** @type {Entry} */ ({ id: `id-${slug}`, slug, subPath: slug, locales: {} }),
  changes: [],
  savingAssets: [],
  values: [slug],
});

/**
 * Build a parent draft.
 * @param {object} [options] Options.
 * @param {PendingEntry[]} [options.pendingEntries] Pending entries.
 * @param {Record<string, Record<string, any>>} [options.currentValues] Values keyed by locale.
 * @returns {EntryDraft} Draft.
 */
const createParentDraft = ({ pendingEntries = [], currentValues = { en: {} } } = {}) =>
  /** @type {any} */ ({
    collection: { name: 'posts', _type: 'entry', _i18n: { defaultLocale: 'en' } },
    collectionName: 'posts',
    currentValues,
    expanderStates: { _: {} },
    pendingEntries,
  });

describe('getCreatableCollection', () => {
  const draft = createParentDraft();

  beforeEach(() => {
    vi.mocked(getCollection).mockReturnValue(tagCollection);
    vi.mocked(isWorkflowDraft).mockReturnValue(false);
    vi.mocked(isWorkflowEnabled).mockReturnValue(false);
  });

  it('returns the referenced entry collection', () => {
    expect(getCreatableCollection({ fieldConfig, draft })).toBe(tagCollection);
    expect(getCollection).toHaveBeenCalledWith('tags');
    expect(isWorkflowDraft).toHaveBeenCalledWith(draft);
    expect(isWorkflowEnabled).toHaveBeenCalledWith(tagCollection);
  });

  it('returns nothing when the referenced collection is under Editorial Workflow', () => {
    vi.mocked(isWorkflowEnabled).mockReturnValue(true);
    expect(getCreatableCollection({ fieldConfig, draft })).toBeUndefined();
  });

  it('returns nothing for a reference to a file', () => {
    expect(
      getCreatableCollection({ fieldConfig: { ...fieldConfig, file: 'cities' }, draft }),
    ).toBeUndefined();
    expect(getCollection).not.toHaveBeenCalled();
  });

  it('returns nothing while the entry is saved through Editorial Workflow', () => {
    vi.mocked(isWorkflowDraft).mockReturnValue(true);
    expect(getCreatableCollection({ fieldConfig, draft })).toBeUndefined();
    expect(getCollection).not.toHaveBeenCalled();
  });

  it('returns nothing when the collection is missing or is not an entry collection', () => {
    vi.mocked(getCollection).mockReturnValue(undefined);
    expect(getCreatableCollection({ fieldConfig, draft })).toBeUndefined();

    vi.mocked(getCollection).mockReturnValue(/** @type {any} */ ({ name: 'tags', _type: 'file' }));
    expect(getCreatableCollection({ fieldConfig, draft })).toBeUndefined();
  });

  it('returns nothing when entries can’t be created in the collection', () => {
    vi.mocked(getCollection).mockReturnValue({ ...tagCollection, create: false });
    expect(getCreatableCollection({ fieldConfig, draft })).toBeUndefined();
  });
});

describe('hasCreationRoom', () => {
  beforeEach(() => {
    vi.mocked(getEntriesByCollection).mockReturnValue([]);
  });

  it('is always true without a limit', () => {
    vi.mocked(getEntriesByCollection).mockReturnValue(/** @type {any} */ ([{}, {}]));

    expect(hasCreationRoom({ collection: tagCollection, draft: createParentDraft() })).toBe(true);
  });

  it('counts the pending entries in the collection against the limit', () => {
    const collection = { ...tagCollection, limit: 3 };

    vi.mocked(getEntriesByCollection).mockReturnValue(/** @type {any} */ ([{}]));

    expect(
      hasCreationRoom({
        collection,
        draft: createParentDraft({ pendingEntries: [createPending('a'), createPending('b', 'x')] }),
      }),
    ).toBe(true);

    expect(
      hasCreationRoom({
        collection,
        draft: createParentDraft({ pendingEntries: [createPending('a'), createPending('b')] }),
      }),
    ).toBe(false);
  });
});

describe('getPendingRefEntries', () => {
  it('returns the entries pending in the referenced collection', () => {
    const svelte = createPending('svelte');
    const react = createPending('react');
    const author = createPending('jane', 'authors');
    const draft = createParentDraft({ pendingEntries: [svelte, author, react] });

    expect(getPendingRefEntries({ draft, fieldConfig, refEntries: [] })).toEqual([
      svelte.entry,
      react.entry,
    ]);
  });

  it('leaves out an entry that has made it to the collection', () => {
    const svelte = createPending('svelte');
    const react = createPending('react');
    const draft = createParentDraft({ pendingEntries: [svelte, react] });

    expect(
      getPendingRefEntries({
        draft,
        fieldConfig,
        refEntries: [{ ...svelte.entry, commitDate: new Date() }],
      }),
    ).toEqual([react.entry]);
  });

  it('returns nothing without a draft', () => {
    expect(getPendingRefEntries({ draft: null, fieldConfig, refEntries: [] })).toEqual([]);
    expect(getPendingRefEntries({ draft: undefined, fieldConfig, refEntries: [] })).toEqual([]);
  });
});

describe('getPendingEntrySlugs', () => {
  const draft = /** @type {EntryDraft} */ (
    /** @type {any} */ ({ collectionName: 'tags', defaultLocale: 'en' })
  );

  it('returns the slugs as they are when nothing pending takes them', () => {
    const slugs = {
      defaultLocaleSlug: 'svelte',
      localizedSlugs: undefined,
      canonicalSlug: undefined,
    };

    vi.mocked(getSlugs).mockReturnValue(slugs);

    expect(
      getPendingEntrySlugs({ draft, parentDraft: createParentDraft({ pendingEntries: [] }) }),
    ).toBe(slugs);
    expect(
      getPendingEntrySlugs({
        draft,
        parentDraft: createParentDraft({ pendingEntries: [createPending('react')] }),
      }),
    ).toBe(slugs);
    expect(getCanonicalSlug).not.toHaveBeenCalled();
  });

  it('renames the slug taken by a pending entry', () => {
    vi.mocked(getSlugs).mockReturnValue({
      defaultLocaleSlug: 'svelte',
      localizedSlugs: undefined,
      canonicalSlug: undefined,
    });
    vi.mocked(getCanonicalSlug).mockReturnValue(undefined);

    expect(
      getPendingEntrySlugs({
        draft,
        parentDraft: createParentDraft({
          pendingEntries: [createPending('svelte'), createPending('svelte-1')],
        }),
      }),
    ).toEqual({
      defaultLocaleSlug: 'svelte-2',
      localizedSlugs: undefined,
      canonicalSlug: undefined,
    });
  });

  it('renames the localized and canonical slugs along with the default one', () => {
    vi.mocked(getSlugs).mockReturnValue({
      defaultLocaleSlug: 'svelte',
      localizedSlugs: { en: 'svelte', fr: 'svelte-fr' },
      canonicalSlug: 'svelte',
    });
    vi.mocked(getCanonicalSlug).mockReturnValue('svelte-1');

    const result = getPendingEntrySlugs({
      draft,
      parentDraft: createParentDraft({ pendingEntries: [createPending('svelte')] }),
    });

    expect(result).toEqual({
      defaultLocaleSlug: 'svelte-1',
      localizedSlugs: { en: 'svelte-1', fr: 'svelte-fr' },
      canonicalSlug: 'svelte-1',
    });
    expect(getCanonicalSlug).toHaveBeenCalledWith({
      draft,
      defaultLocaleSlug: 'svelte-1',
      localizedSlugs: { en: 'svelte-1', fr: 'svelte-fr' },
      fillSlugOptions: { content: {} },
    });
    expect(getFillSlugOptions).toHaveBeenCalledWith({ draft });
  });
});

describe('createPendingEntry', () => {
  const draft = /** @type {EntryDraft} */ (
    /** @type {any} */ ({ collectionName: 'tags', defaultLocale: 'en' })
  );

  const savingEntry = /** @type {Entry} */ ({
    id: 'new',
    slug: 'svelte',
    subPath: 'svelte',
    locales: { en: { slug: 'svelte', path: 'tags/svelte.md', content: { title: 'Svelte' } } },
  });

  const changes = [{ action: 'create', path: 'tags/svelte.md', data: 'title: Svelte' }];
  const savingAssets = [{ path: 'uploads/image.png' }];

  const slugs = {
    defaultLocaleSlug: 'svelte',
    localizedSlugs: undefined,
    canonicalSlug: undefined,
  };

  beforeEach(() => {
    vi.mocked(getSlugs).mockReturnValue(slugs);
    vi.mocked(createSavingEntryData).mockResolvedValue(
      /** @type {any} */ ({ savingEntry, changes, savingAssets }),
    );
    vi.mocked(getEntryOptions).mockImplementation(({ locale }) => [
      { label: 'Svelte', value: `${locale}/svelte`, searchValue: 'Svelte' },
      { label: 'Svelte', value: 'svelte', searchValue: 'Svelte' },
    ]);
  });

  it('prepares the entry for saving and collects the values it goes by', async () => {
    const parentDraft = createParentDraft({
      pendingEntries: [createPending('react')],
      currentValues: { en: {}, fr: {} },
    });

    const result = await createPendingEntry({ draft, parentDraft, fieldConfig });

    expect(assignManualSortOrder).toHaveBeenCalledWith(draft, 1);
    expect(createSavingEntryData).toHaveBeenCalledWith({ draft, slugs });
    expect(getEntryOptions).toHaveBeenCalledWith({
      locale: 'en',
      fieldConfig,
      refEntry: savingEntry,
      pendingEntries: parentDraft.pendingEntries,
    });
    expect(getEntryOptions).toHaveBeenCalledWith({
      locale: 'fr',
      fieldConfig,
      refEntry: savingEntry,
      pendingEntries: parentDraft.pendingEntries,
    });
    expect(result).toEqual({
      collectionName: 'tags',
      entry: savingEntry,
      changes,
      savingAssets,
      values: ['en/svelte', 'svelte', 'fr/svelte'],
    });
  });
});

describe('getNestedPendingEntries', () => {
  it('returns the entries the draft added on its own, as long as they are referenced', () => {
    const inherited = createPending('react');
    const own = createPending('svelte');
    const draft = createParentDraft({ pendingEntries: [inherited, own] });
    const parentDraft = createParentDraft({ pendingEntries: [inherited] });

    vi.mocked(getReferencedPendingEntries).mockReturnValue([inherited, own]);
    expect(getNestedPendingEntries({ draft, parentDraft })).toEqual([own]);
    expect(getReferencedPendingEntries).toHaveBeenCalledWith(draft);

    // Deselected in the draft
    vi.mocked(getReferencedPendingEntries).mockReturnValue([inherited]);
    expect(getNestedPendingEntries({ draft, parentDraft })).toEqual([]);
  });
});

describe('selectPendingEntry', () => {
  const pendingEntry = createPending('svelte');

  beforeEach(() => {
    vi.mocked(getEntryOptions).mockReturnValue([
      { label: 'Svelte', value: 'svelte', searchValue: 'Svelte' },
    ]);
  });

  it('sets the value of a single-value field in the locale being edited', () => {
    const draft = createParentDraft({ currentValues: { en: { tag: '' }, fr: { tag: '' } } });

    selectPendingEntry({
      draft,
      locale: 'en',
      keyPath: 'tag',
      valueStoreKey: 'currentValues',
      fieldConfig: { ...fieldConfig, name: 'tag' },
      pendingEntry,
    });

    expect(draft.currentValues.en.tag).toBe('svelte');
    expect(draft.currentValues.fr.tag).toBe('');
    expect(getEntryOptions).toHaveBeenCalledWith({
      locale: 'en',
      fieldConfig: { ...fieldConfig, name: 'tag' },
      refEntry: pendingEntry.entry,
      pendingEntries: draft.pendingEntries,
    });
  });

  it('adds the value to a multiple-value field', () => {
    const draft = createParentDraft({ currentValues: { en: { title: 'Hi', 'tags.0': 'react' } } });

    selectPendingEntry({
      draft,
      locale: 'en',
      keyPath: 'tags',
      valueStoreKey: 'currentValues',
      fieldConfig: { ...fieldConfig, multiple: true },
      pendingEntry,
    });

    expect(draft.currentValues.en).toEqual({ title: 'Hi', 'tags.0': 'react', 'tags.1': 'svelte' });
  });

  it('adds the value to every locale of a duplicated field', () => {
    const draft = createParentDraft({ currentValues: { en: {}, fr: {} } });

    selectPendingEntry({
      draft,
      locale: 'en',
      keyPath: 'tags',
      valueStoreKey: 'currentValues',
      fieldConfig: { ...fieldConfig, multiple: true, i18n: 'duplicate' },
      pendingEntry,
    });

    expect(draft.currentValues.en).toEqual({ 'tags.0': 'svelte' });
    expect(draft.currentValues.fr).toEqual({ 'tags.0': 'svelte' });
  });

  it('leaves a list alone when the value is there or the list is full', () => {
    const draft = createParentDraft({
      currentValues: { en: { 'tags.0': 'svelte' }, fr: { 'tags.0': 'react' } },
    });

    selectPendingEntry({
      draft,
      locale: 'en',
      keyPath: 'tags',
      valueStoreKey: 'currentValues',
      fieldConfig: { ...fieldConfig, multiple: true },
      pendingEntry,
    });
    expect(draft.currentValues.en).toEqual({ 'tags.0': 'svelte' });

    selectPendingEntry({
      draft,
      locale: 'fr',
      keyPath: 'tags',
      valueStoreKey: 'currentValues',
      fieldConfig: { ...fieldConfig, multiple: true, max: 1 },
      pendingEntry,
    });
    expect(draft.currentValues.fr).toEqual({ 'tags.0': 'react' });
  });

  it('does nothing when the entry has no value', () => {
    vi.mocked(getEntryOptions).mockReturnValue([]);

    const draft = createParentDraft({ currentValues: { en: { tag: '' } } });

    selectPendingEntry({
      draft,
      locale: 'en',
      keyPath: 'tag',
      valueStoreKey: 'currentValues',
      fieldConfig: { ...fieldConfig, name: 'tag' },
      pendingEntry,
    });

    expect(draft.currentValues.en.tag).toBe('');
  });
});
