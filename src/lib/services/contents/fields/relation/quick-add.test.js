import { beforeEach, describe, expect, it, vi } from 'vitest';

import { allEntries } from '$lib/services/contents';
import { getCollection } from '$lib/services/contents/collection';
import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
import { getDraftValues, isDraftModified } from '$lib/services/contents/draft';
import { getReferencedPendingEntrySet } from '$lib/services/contents/draft/pending-entries';
import { createSavingEntryData } from '$lib/services/contents/draft/save/changes';
import { compareWithStore } from '$lib/services/contents/draft/save/conflict';
import { assignManualSortOrder } from '$lib/services/contents/draft/save/sort-order';
import { getCanonicalSlug, getFillSlugOptions, getSlugs } from '$lib/services/contents/draft/slugs';
import { isEntryReadonly } from '$lib/services/contents/entry/readonly';
import { assignAutoNowValues } from '$lib/services/contents/fields/date-time/auto-now';
import { assignAutoIncrementValues } from '$lib/services/contents/fields/number/auto-increment';
import { getEntryOptions, getRefEntries } from '$lib/services/contents/fields/relation/helpers';
import {
  getUnpublishedEntry,
  getUnpublishedEntryByBranch,
  getUnpublishedEntryByDraft,
  isWorkflowDraft,
  isWorkflowEnabled,
  unpublishedEntries,
} from '$lib/services/workflow';

import {
  addPendingEntries,
  canEditEntry,
  createPendingEntry,
  getCreatableCollection,
  getEditableEntries,
  getEditTarget,
  getNestedPendingEntries,
  getNestedQuickAddHost,
  getPendingEntrySlugs,
  getPendingRefEntries,
  getQuickAddHost,
  getRefEntriesWithPending,
  hasCreationRoom,
  isEditUnchanged,
  isPendingEntryMoved,
  replaceEntryValues,
  revertSaveTimeValues,
  selectPendingEntry,
} from './quick-add';

/**
 * @import { Entry, EntryDraft, PendingEntry, UnpublishedEntry } from '$lib/types/private';
 * @import { RelationField } from '$lib/types/public';
 */

vi.mock('$lib/services/contents/collection', () => ({
  getCollection: vi.fn(),
}));

vi.mock('$lib/services/contents/collection/entries', () => ({
  getEntriesByCollection: vi.fn(() => []),
  // The real one drops the collection’s index file, which it tells by the entry’s path; here a
  // test marks that entry with `_isIndexFile` instead
  countCollectionEntries: vi.fn(
    (_collectionName, entries) =>
      entries.filter((/** @type {any} */ { _isIndexFile }) => !_isIndexFile).length,
  ),
}));

vi.mock('$lib/services/contents/draft/save/conflict', () => ({
  compareWithStore: vi.fn(),
}));

vi.mock('$lib/services/contents/fields/date-time/auto-now', () => ({
  assignAutoNowValues: vi.fn(),
}));

vi.mock('$lib/services/contents/draft', async (importOriginal) => ({
  .../** @type {object} */ (await importOriginal()),
  getDraftValues: vi.fn(),
  isDraftModified: vi.fn(),
}));

vi.mock('$lib/services/contents/entry/readonly', () => ({
  isEntryReadonly: vi.fn(() => false),
}));

vi.mock('$lib/services/contents/draft/pending-entries', () => ({
  getReferencedPendingEntrySet: vi.fn(),
}));

vi.mock('$lib/services/contents/draft/save/changes', async (importOriginal) => ({
  createSavingEntryData: vi.fn(),
  removeDisabledLocales: /** @type {any} */ (await importOriginal()).removeDisabledLocales,
}));

vi.mock('$lib/services/contents/draft/save/sort-order', () => ({
  assignManualSortOrder: vi.fn(),
}));

vi.mock('$lib/services/contents/fields/number/auto-increment', () => ({
  assignAutoIncrementValues: vi.fn(),
}));

vi.mock('$lib/services/contents/draft/slugs', () => ({
  getCanonicalSlug: vi.fn(),
  getFillSlugOptions: vi.fn(() => ({ content: {} })),
  getSlugs: vi.fn(),
}));

vi.mock('$lib/services/contents/fields/relation/helpers', () => ({
  getEntryOptions: vi.fn(),
  getRefEntries: vi.fn(() => []),
}));

// `mergeUnpublishedEntries` is a pure helper and is used as is, and so is `getCompanionEntries`,
// pointed at the store mocked here
vi.mock('$lib/services/workflow', async (importOriginal) => {
  const original = /** @type {any} */ (await importOriginal());
  const store = { current: [] };

  return {
    ...original,
    getCompanionEntries: vi.fn((collectionName, entries = store.current) =>
      original.getCompanionEntries(collectionName, entries),
    ),
    getUnpublishedEntry: vi.fn(),
    getUnpublishedEntryByBranch: vi.fn(),
    getUnpublishedEntryByDraft: vi.fn(),
    isWorkflowDraft: vi.fn(() => false),
    isWorkflowEnabled: vi.fn(() => false),
    unpublishedEntries: store,
  };
});

beforeEach(() => {
  vi.mocked(getUnpublishedEntry).mockReturnValue(undefined);
  vi.mocked(getUnpublishedEntryByBranch).mockReturnValue(undefined);
  vi.mocked(getUnpublishedEntryByDraft).mockReturnValue(undefined);
  unpublishedEntries.current = [];
});

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
  source: /** @type {any} */ ({ currentValues: {}, files: {} }),
});

/**
 * Build a pending entry standing for an existing entry edited from a Relation field.
 * @param {string} slug Slug.
 * @param {string} [collectionName] Collection name.
 * @returns {PendingEntry} Pending entry.
 */
const createPendingEdit = (slug, collectionName = 'tags') => {
  const pendingEntry = createPending(slug, collectionName);

  return { ...pendingEntry, baseEntry: { ...pendingEntry.entry } };
};

/**
 * Build an entry of the host’s pull request that a new tag rides along in.
 * @param {string} slug Slug of the tag.
 * @returns {UnpublishedEntry} Unpublished entry.
 */
const createHostEntry = (slug) =>
  /** @type {any} */ ({
    workflow: {
      collectionName: 'posts',
      pullRequest: { branch: 'cms/posts/hello' },
      companions: [
        { collectionName: 'tags', entry: { id: `id-${slug}`, slug, subPath: slug, locales: {} } },
        { collectionName: 'authors', entry: { id: 'id-jane', slug: 'jane', locales: {} } },
      ],
    },
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

  it('offers the collection while the entry is saved through Editorial Workflow', () => {
    // The new entry goes into the entry’s pull request, so the collection’s own review is kept
    // @see https://github.com/sveltia/sveltia-cms/issues/1112
    vi.mocked(isWorkflowDraft).mockReturnValue(true);
    vi.mocked(isWorkflowEnabled).mockReturnValue(true);
    expect(getCreatableCollection({ fieldConfig, draft })).toBe(tagCollection);
    expect(isWorkflowEnabled).not.toHaveBeenCalled();
  });

  it('returns nothing for the entry’s own collection while it’s saved through Editorial Workflow', () => {
    const postCollection = /** @type {any} */ ({ name: 'posts', _type: 'entry' });

    vi.mocked(isWorkflowDraft).mockReturnValue(true);
    vi.mocked(getCollection).mockReturnValue(postCollection);
    expect(
      getCreatableCollection({ fieldConfig: { ...fieldConfig, collection: 'posts' }, draft }),
    ).toBeUndefined();

    vi.mocked(isWorkflowDraft).mockReturnValue(false);
    expect(
      getCreatableCollection({ fieldConfig: { ...fieldConfig, collection: 'posts' }, draft }),
    ).toBe(postCollection);
  });

  it('follows the host entry in a quick-add dialog', () => {
    const tagDraft = /** @type {EntryDraft} */ ({
      ...draft,
      collectionName: 'authors',
      quickAddHost: { collectionName: 'tags', workflow: true, entryIds: ['host'] },
    });

    // The dialog’s own draft would be saved through Editorial Workflow, but the host decides
    expect(getCreatableCollection({ fieldConfig, draft: tagDraft })).toBeUndefined();
    expect(isWorkflowDraft).not.toHaveBeenCalled();

    tagDraft.quickAddHost = { collectionName: 'posts', workflow: false, entryIds: ['host'] };
    vi.mocked(isWorkflowDraft).mockReturnValue(true);
    vi.mocked(isWorkflowEnabled).mockReturnValue(true);
    expect(getCreatableCollection({ fieldConfig, draft: tagDraft })).toBeUndefined();
    expect(isWorkflowEnabled).toHaveBeenCalledWith(tagCollection);
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

  it('returns nothing when the collection is read-only', () => {
    vi.mocked(getCollection).mockReturnValue({ ...tagCollection, readonly: true });
    expect(getCreatableCollection({ fieldConfig, draft })).toBeUndefined();
  });
});

describe('getQuickAddHost', () => {
  it('returns the host a quick-add draft has been given', () => {
    const quickAddHost = {
      collectionName: 'posts',
      workflow: true,
      branch: 'cms/posts/hello',
      entryIds: ['hello'],
    };

    const draft = /** @type {EntryDraft} */ ({ ...createParentDraft(), quickAddHost });

    expect(getQuickAddHost(draft)).toBe(quickAddHost);
    expect(isWorkflowDraft).not.toHaveBeenCalled();
  });

  it('makes any other draft its own host', () => {
    const draft = /** @type {EntryDraft} */ ({ ...createParentDraft(), id: 'hello' });

    vi.mocked(isWorkflowDraft).mockReturnValue(true);
    vi.mocked(getUnpublishedEntryByDraft).mockReturnValue(createHostEntry('svelte'));

    expect(getQuickAddHost(draft)).toEqual({
      collectionName: 'posts',
      workflow: true,
      branch: 'cms/posts/hello',
      entryIds: ['hello'],
    });
    expect(getUnpublishedEntryByDraft).toHaveBeenCalledWith(draft);

    vi.mocked(isWorkflowDraft).mockReturnValue(false);
    vi.mocked(getUnpublishedEntryByDraft).mockReturnValue(undefined);

    expect(getQuickAddHost(draft)).toEqual({
      collectionName: 'posts',
      workflow: false,
      branch: undefined,
      entryIds: ['hello'],
    });
  });
});

describe('getNestedQuickAddHost', () => {
  it('adds the entry being edited to the host it’s saved along with', () => {
    const draft = /** @type {EntryDraft} */ ({ ...createParentDraft(), id: 'hello' });

    expect(getNestedQuickAddHost(draft)).toEqual({
      collectionName: 'posts',
      workflow: false,
      branch: undefined,
      entryIds: ['hello'],
    });

    const quickAddHost = { collectionName: 'posts', workflow: false, entryIds: ['hello'] };

    const nestedDraft = /** @type {EntryDraft} */ ({
      ...createParentDraft(),
      id: 'ada',
      quickAddHost,
    });

    expect(getNestedQuickAddHost(nestedDraft)).toEqual({
      ...quickAddHost,
      entryIds: ['hello', 'ada'],
    });
  });
});

describe('hasCreationRoom', () => {
  beforeEach(() => {
    vi.mocked(getEntriesByCollection).mockReturnValue([]);
    unpublishedEntries.current = [];
  });

  it('does not count the existing entries edited from the draft', () => {
    const collection = { ...tagCollection, limit: 2 };

    vi.mocked(getEntriesByCollection).mockReturnValue(/** @type {any} */ ([{}]));

    expect(
      hasCreationRoom({
        collection,
        draft: createParentDraft({ pendingEntries: [createPendingEdit('a')] }),
      }),
    ).toBe(true);
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

  it('counts a never-published draft in the collection against the limit', () => {
    const collection = { ...tagCollection, limit: 2 };

    /**
     * Build an entry in the collection.
     * @param {string} slug Slug.
     * @param {object} [workflow] Workflow properties of an unpublished entry.
     * @returns {any} Entry.
     */
    const entry = (slug, workflow) => ({
      slug,
      locales: { _default: { path: `tags/${slug}.md` } },
      ...(workflow ? { workflow } : {}),
    });

    vi.mocked(getEntriesByCollection).mockReturnValue([entry('a')]);
    unpublishedEntries.current = [
      entry('b', { collectionName: 'tags' }),
      entry('c', { collectionName: 'posts' }),
    ];

    expect(hasCreationRoom({ collection, draft: createParentDraft() })).toBe(false);
  });

  it('counts a new entry riding along in another entry’s pull request against the limit', () => {
    vi.mocked(getEntriesByCollection).mockReturnValue(/** @type {any} */ ([{}]));
    unpublishedEntries.current = [createHostEntry('svelte')];

    expect(
      hasCreationRoom({ collection: { ...tagCollection, limit: 2 }, draft: createParentDraft() }),
    ).toBe(false);
    expect(
      hasCreationRoom({ collection: { ...tagCollection, limit: 3 }, draft: createParentDraft() }),
    ).toBe(true);
  });

  it('counts a pending entry once after it has been saved to the pull request', () => {
    // The editor may stay open on the draft after the save, which still holds the entry
    vi.mocked(getEntriesByCollection).mockReturnValue(/** @type {any} */ ([{}]));
    unpublishedEntries.current = [createHostEntry('svelte')];

    expect(
      hasCreationRoom({
        collection: { ...tagCollection, limit: 3 },
        draft: createParentDraft({ pendingEntries: [createPending('svelte')] }),
      }),
    ).toBe(true);
  });

  it('doesn’t count the collection’s index file against the limit', () => {
    const collection = { ...tagCollection, limit: 2 };

    // `_index` is the collection’s own page, so only one of the two files takes up a slot
    // @see https://github.com/sveltia/sveltia-cms/issues/1005
    vi.mocked(getEntriesByCollection).mockReturnValue(
      /** @type {any} */ ([{ _isIndexFile: true }, {}]),
    );

    expect(hasCreationRoom({ collection, draft: createParentDraft() })).toBe(true);
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

  it('returns the entries an earlier save has committed to the pull request as well', () => {
    const react = createPending('react');
    const draft = createParentDraft({ pendingEntries: [react] });
    const hostEntry = createHostEntry('svelte');

    vi.mocked(getUnpublishedEntryByDraft).mockReturnValue(hostEntry);
    vi.mocked(getUnpublishedEntryByBranch).mockReturnValue(hostEntry);

    expect(getPendingRefEntries({ draft, fieldConfig, refEntries: [] })).toEqual([
      react.entry,
      hostEntry.workflow.companions?.[0].entry,
    ]);
    // The entry is looked up afresh, as a save or a reload may have replaced it
    expect(getUnpublishedEntryByBranch).toHaveBeenCalledWith('cms/posts/hello');

    // An entry that has been published along with the host is among the saved ones
    expect(
      getPendingRefEntries({
        draft,
        fieldConfig,
        refEntries: [/** @type {Entry} */ (hostEntry.workflow.companions?.[0].entry)],
      }),
    ).toEqual([react.entry]);

    // A pending entry saved to the pull request while the editor stays open is offered once
    const svelte = createPending('svelte');

    expect(
      getPendingRefEntries({
        draft: createParentDraft({ pendingEntries: [react, svelte] }),
        fieldConfig,
        refEntries: [],
      }),
    ).toEqual([react.entry, svelte.entry]);

    // The host entry may have left the store, e.g. once it has been published
    vi.mocked(getUnpublishedEntryByBranch).mockReturnValue(undefined);

    expect(getPendingRefEntries({ draft, fieldConfig, refEntries: [] })).toEqual([react.entry]);
  });

  it('returns nothing without a draft', () => {
    expect(getPendingRefEntries({ draft: null, fieldConfig, refEntries: [] })).toEqual([]);
    expect(getPendingRefEntries({ draft: undefined, fieldConfig, refEntries: [] })).toEqual([]);
  });
});

describe('getRefEntriesWithPending', () => {
  it('appends the pending entries to the saved ones', () => {
    const svelte = createPending('svelte');
    const react = createPending('react');
    const saved = { ...svelte.entry, commitDate: new Date() };
    const draft = createParentDraft({ pendingEntries: [svelte, react] });

    vi.mocked(getRefEntries).mockReturnValue([saved]);

    expect(getRefEntriesWithPending({ draft, fieldConfig })).toEqual([saved, react.entry]);
    expect(getRefEntries).toHaveBeenCalledWith(fieldConfig);
  });

  it('offers an edited entry in place of its saved version', () => {
    const svelte = createPendingEdit('svelte');
    const react = createPending('react');
    const saved = { ...svelte.entry, commitDate: new Date() };
    const vue = createPending('vue').entry;

    const draft = createParentDraft({
      pendingEntries: [svelte, react, createPendingEdit('x', 'y')],
    });

    vi.mocked(getRefEntries).mockReturnValue([saved, vue]);

    expect(getRefEntriesWithPending({ draft, fieldConfig })).toEqual([
      svelte.entry,
      vue,
      react.entry,
    ]);
  });

  it('returns the saved entries as they are when nothing is pending', () => {
    const refEntries = [createPending('svelte').entry];

    vi.mocked(getRefEntries).mockReturnValue(refEntries);

    expect(getRefEntriesWithPending({ draft: null, fieldConfig })).toBe(refEntries);
  });
});

describe('getPendingEntrySlugs', () => {
  const draft = /** @type {EntryDraft} */ (
    /** @type {any} */ ({ collectionName: 'tags', defaultLocale: 'en' })
  );

  beforeEach(() => {
    vi.mocked(getEntriesByCollection).mockReturnValue([]);
  });

  it('returns the slugs as they are when nothing pending takes them', () => {
    const slugs = {
      defaultLocaleSlug: 'svelte',
      localizedSlugs: undefined,
      canonicalSlug: undefined,
    };

    vi.mocked(getSlugs).mockReturnValue(slugs);

    expect(getPendingEntrySlugs({ draft, pendingEntries: [] })).toBe(slugs);
    expect(
      getPendingEntrySlugs({
        draft,
        pendingEntries: [createPending('react')],
      }),
    ).toBe(slugs);
    expect(getCanonicalSlug).not.toHaveBeenCalled();
  });

  it('numbers the slug after the entries pending on the parent draft', () => {
    const pendingEntries = [createPending('react')];

    vi.mocked(getSlugs).mockReturnValue({
      defaultLocaleSlug: '1',
      localizedSlugs: undefined,
      canonicalSlug: undefined,
    });

    getPendingEntrySlugs({ draft, pendingEntries });

    expect(getSlugs).toHaveBeenCalledWith({ draft, pendingEntries });
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
        pendingEntries: [createPending('svelte'), createPending('svelte-1')],
      }),
    ).toEqual({
      defaultLocaleSlug: 'svelte-2',
      localizedSlugs: undefined,
      canonicalSlug: undefined,
    });
  });

  it('numbers a slug with a dot at the end rather than before the dot', () => {
    vi.mocked(getSlugs).mockReturnValue({
      defaultLocaleSlug: 'release-2.0',
      localizedSlugs: undefined,
      canonicalSlug: undefined,
    });
    vi.mocked(getCanonicalSlug).mockReturnValue(undefined);

    expect(
      getPendingEntrySlugs({
        draft,
        pendingEntries: [createPending('release-2.0')],
      }).defaultLocaleSlug,
    ).toBe('release-2.0-1');
  });

  it('renames the slug taken by a new entry riding along in a pull request', () => {
    vi.mocked(getSlugs).mockReturnValue({
      defaultLocaleSlug: 'svelte',
      localizedSlugs: undefined,
      canonicalSlug: undefined,
    });
    vi.mocked(getCanonicalSlug).mockReturnValue(undefined);
    unpublishedEntries.current = [createHostEntry('svelte')];

    expect(getPendingEntrySlugs({ draft, pendingEntries: [] }).defaultLocaleSlug).toBe('svelte-1');
  });

  it('does not rename the slug to one taken by a saved entry', () => {
    vi.mocked(getSlugs).mockReturnValue({
      defaultLocaleSlug: 'svelte',
      localizedSlugs: undefined,
      canonicalSlug: undefined,
    });
    vi.mocked(getCanonicalSlug).mockReturnValue(undefined);
    vi.mocked(getEntriesByCollection).mockReturnValue([
      /** @type {Entry} */ ({ id: 'saved', slug: 'svelte-1', subPath: 'svelte-1', locales: {} }),
    ]);

    expect(
      getPendingEntrySlugs({
        draft,
        pendingEntries: [createPending('svelte')],
      }).defaultLocaleSlug,
    ).toBe('svelte-2');
    expect(getEntriesByCollection).toHaveBeenCalledWith('tags');
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
      pendingEntries: [createPending('svelte')],
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
    /** @type {any} */ ({ id: 'new', isNew: true, collectionName: 'tags', defaultLocale: 'en' })
  );

  const source = /** @type {any} */ ({ currentValues: { en: { title: 'Svelte' } }, files: {} });

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
    vi.mocked(getDraftValues).mockReturnValue(source);
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
    expect(assignAutoIncrementValues).toHaveBeenCalledWith(draft, 1);
    expect(assignAutoNowValues).toHaveBeenCalledWith(draft);
    // The `preSave` event hooks are held back until the entry is committed with the parent
    expect(createSavingEntryData).toHaveBeenCalledWith({ draft, slugs, runPreSave: false });
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
      source,
    });
    expect(result).not.toHaveProperty('baseEntry');
    expect(getDraftValues).toHaveBeenCalledWith(draft);
  });

  it('keeps the place of a pending entry added again, leaving its earlier version out', async () => {
    const react = createPending('react');
    const earlier = { ...createPending('svelte'), entry: { ...savingEntry } };
    const vue = createPending('vue');
    const parentDraft = createParentDraft({ pendingEntries: [react, earlier, vue] });

    await createPendingEntry({ draft, parentDraft, fieldConfig });

    expect(assignManualSortOrder).toHaveBeenCalledWith(draft, 1);
    expect(assignAutoIncrementValues).toHaveBeenCalledWith(draft, 1);
    expect(getSlugs).toHaveBeenCalledWith({ draft, pendingEntries: [react, vue] });
    expect(getEntryOptions).toHaveBeenCalledWith({
      locale: 'en',
      fieldConfig,
      refEntry: savingEntry,
      pendingEntries: [react, vue],
    });
  });

  it('prepares an existing entry with its own slug, along with the version it was edited from', async () => {
    const originalEntry = { ...savingEntry, locales: {} };

    const existingDraft = /** @type {EntryDraft} */ (
      /** @type {any} */ ({ ...draft, id: 'new', isNew: false, originalEntry })
    );

    const parentDraft = createParentDraft({
      pendingEntries: [createPending('react'), createPendingEdit('vue')],
    });

    const result = await createPendingEntry({ draft: existingDraft, parentDraft, fieldConfig });

    expect(assignManualSortOrder).not.toHaveBeenCalled();
    // The edited entry already has its number, so only the new one counts
    expect(assignAutoIncrementValues).toHaveBeenCalledWith(existingDraft, 1);
    expect(getSlugs).toHaveBeenCalledWith({ draft: existingDraft });
    expect(result.baseEntry).toEqual(originalEntry);
    expect(result.baseEntry).not.toBe(originalEntry);
  });

  it('leaves the locales turned off out of the entry', async () => {
    vi.mocked(createSavingEntryData).mockResolvedValue(
      /** @type {any} */ ({
        // A locale turned off only carries the path its file would have
        savingEntry: { ...savingEntry, locales: { ...savingEntry.locales, fr: { path: 'x.md' } } },
        changes,
        savingAssets,
      }),
    );

    const parentDraft = createParentDraft({ currentValues: { en: {} } });
    const result = await createPendingEntry({ draft, parentDraft, fieldConfig });

    expect(result.entry).toEqual(savingEntry);
  });
});

describe('isPendingEntryMoved', () => {
  it('tells whether an existing entry would be moved', () => {
    const edit = createPendingEdit('svelte');
    const move = /** @type {any} */ ({ action: 'move', path: 'b.md', previousPath: 'a.md' });
    const update = /** @type {any} */ ({ action: 'update', path: 'a.md' });

    expect(isPendingEntryMoved({ ...edit, changes: [update] })).toBe(false);
    expect(isPendingEntryMoved({ ...edit, changes: [update, move] })).toBe(true);
    // A new entry is only ever created
    expect(isPendingEntryMoved({ ...createPending('svelte'), changes: [move] })).toBe(false);
  });
});

describe('isEditUnchanged', () => {
  const inherited = createPendingEdit('react');

  const draft = /** @type {EntryDraft} */ (
    /** @type {any} */ ({ id: 'id-svelte', isNew: false, pendingEntries: [inherited] })
  );

  beforeEach(() => {
    vi.mocked(getReferencedPendingEntrySet).mockReturnValue(new Set([inherited]));
  });

  it('tells an existing entry left as it was', () => {
    const parentDraft = createParentDraft({ pendingEntries: [inherited] });

    vi.mocked(isDraftModified).mockReturnValue(false);
    expect(isEditUnchanged({ draft, parentDraft })).toBe(true);
    // The entries inherited from the parent are no change of the draft’s own
    expect(isDraftModified).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'id-svelte', pendingEntries: [] }),
    );

    vi.mocked(isDraftModified).mockReturnValue(true);
    expect(isEditUnchanged({ draft, parentDraft })).toBe(false);
  });

  it('takes an entry added from the draft’s own Relation fields as a change', () => {
    const own = createPendingEdit('vue');

    vi.mocked(isDraftModified).mockReturnValue(false);
    vi.mocked(getReferencedPendingEntrySet).mockReturnValue(new Set([inherited, own]));

    expect(
      isEditUnchanged({
        draft: /** @type {EntryDraft} */ ({ ...draft, pendingEntries: [inherited, own] }),
        parentDraft: createParentDraft({ pendingEntries: [inherited] }),
      }),
    ).toBe(false);
  });

  it('never takes a new entry, or one edited before, as unchanged', () => {
    vi.mocked(isDraftModified).mockReturnValue(false);

    expect(
      isEditUnchanged({
        draft: /** @type {EntryDraft} */ ({ ...draft, isNew: true }),
        parentDraft: createParentDraft(),
      }),
    ).toBe(false);
    expect(
      isEditUnchanged({
        draft,
        parentDraft: createParentDraft({ pendingEntries: [createPendingEdit('svelte')] }),
      }),
    ).toBe(false);
  });
});

describe('revertSaveTimeValues', () => {
  it('puts back the values assigned when the entry was prepared for saving', () => {
    const pendingEntry = {
      ...createPendingEdit('svelte'),
      entry: /** @type {Entry} */ ({
        id: 'id-svelte',
        slug: 'svelte',
        subPath: 'svelte',
        locales: {
          en: /** @type {any} */ ({
            content: { title: 'Svelte', date: '2026-11-02', note: 'Old', body: 'Hi' },
          }),
        },
      }),
      source: /** @type {any} */ ({
        currentValues: { en: { title: 'Svelte', date: '', note: 'Old', body: 'Hi' }, fr: {} },
      }),
    };

    const draft = /** @type {EntryDraft} */ (
      /** @type {any} */ ({
        // `note` has been typed in while the entry was being prepared
        currentValues: {
          en: { title: 'Svelte', date: '2026-11-02', note: 'New', body: 'Hi' },
          fr: {},
        },
      })
    );

    revertSaveTimeValues({ draft, pendingEntry });
    expect(draft.currentValues).toEqual({
      en: { title: 'Svelte', date: '', note: 'New', body: 'Hi' },
      fr: {},
    });

    // Nothing to put back without the values
    const { source: _source, ...withoutSource } = createPendingEdit('svelte');

    revertSaveTimeValues({ draft, pendingEntry: withoutSource });
    expect(draft.currentValues.en.date).toBe('');
  });
});

describe('addPendingEntries', () => {
  it('adds new entries and replaces the earlier versions of the others', () => {
    const react = createPending('react');
    const svelte = createPending('svelte');
    const draft = createParentDraft({ pendingEntries: [react, svelte] });
    const changedReact = { ...createPending('react'), values: ['changed'] };
    const vue = createPending('vue');

    addPendingEntries(draft, [changedReact, vue]);

    expect(draft.pendingEntries).toEqual([changedReact, svelte, vue]);
    expect(draft.pendingEntries[0]).toBe(changedReact);
  });
});

describe('getNestedPendingEntries', () => {
  it('returns an inherited entry changed in the draft', () => {
    const inherited = createPending('react');
    const changed = { ...createPending('react'), values: ['changed'] };
    const draft = createParentDraft({ pendingEntries: [changed] });
    const parentDraft = createParentDraft({ pendingEntries: [inherited] });

    vi.mocked(getReferencedPendingEntrySet).mockReturnValue(new Set([changed]));
    expect(getNestedPendingEntries({ draft, parentDraft })).toEqual([changed]);
  });

  it('returns the entries the draft added on its own, as long as they are referenced', () => {
    const inherited = createPending('react');
    const own = createPending('svelte');
    const draft = createParentDraft({ pendingEntries: [inherited, own] });
    const parentDraft = createParentDraft({ pendingEntries: [inherited] });

    vi.mocked(getReferencedPendingEntrySet).mockReturnValue(new Set([inherited, own]));
    expect(getNestedPendingEntries({ draft, parentDraft })).toEqual([own]);
    expect(getReferencedPendingEntrySet).toHaveBeenCalledWith(draft);

    // Deselected in the draft
    vi.mocked(getReferencedPendingEntrySet).mockReturnValue(new Set([inherited]));
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

  it('localizes a locale-prefixed value for every locale of a duplicated field', () => {
    vi.mocked(getEntryOptions).mockReturnValue([
      { label: 'Svelte', value: 'en/svelte', searchValue: 'Svelte' },
    ]);

    const draft = createParentDraft({
      currentValues: { en: { 'tags.0': 'en/react' }, fr: { 'tags.0': 'fr/react' } },
    });

    selectPendingEntry({
      draft,
      locale: 'en',
      keyPath: 'tags',
      valueStoreKey: 'currentValues',
      fieldConfig: {
        ...fieldConfig,
        multiple: true,
        i18n: 'duplicate',
        value_field: '{{locale}}/{{slug}}',
      },
      pendingEntry,
    });

    expect(draft.currentValues.en).toEqual({ 'tags.0': 'en/react', 'tags.1': 'en/svelte' });
    expect(draft.currentValues.fr).toEqual({ 'tags.0': 'fr/react', 'tags.1': 'fr/svelte' });
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

describe('replaceEntryValues', () => {
  const previousEntry = /** @type {Entry} */ ({ id: 'svelte', slug: 'svelte', locales: {} });
  const entry = /** @type {Entry} */ ({ id: 'svelte', slug: 'svelte-js', locales: {} });

  beforeEach(() => {
    vi.mocked(getEntryOptions).mockImplementation(({ locale, refEntry }) => [
      { label: refEntry.slug, value: `${locale}/${refEntry.slug}`, searchValue: '' },
    ]);
  });

  it('replaces the value of a single-value field in every locale', () => {
    const draft = createParentDraft({
      currentValues: { en: { tag: 'en/svelte' }, fr: { tag: 'fr/react' }, de: {} },
    });

    replaceEntryValues({
      draft,
      keyPath: 'tag',
      valueStoreKey: 'currentValues',
      fieldConfig,
      previousEntry,
      entry,
    });

    expect(draft.currentValues).toEqual({
      en: { tag: 'en/svelte-js' },
      fr: { tag: 'fr/react' },
      de: {},
    });
    expect(getEntryOptions).toHaveBeenCalledWith({
      locale: 'en',
      fieldConfig,
      refEntry: previousEntry,
      pendingEntries: draft.pendingEntries,
    });
  });

  it('replaces the matching items of a multiple-value field', () => {
    const draft = createParentDraft({
      currentValues: {
        en: { 'tags.0': 'en/react', 'tags.1': 'en/svelte', 'tags.1.x': 'en/svelte', other: 'x' },
      },
    });

    replaceEntryValues({
      draft,
      keyPath: 'tags',
      valueStoreKey: 'currentValues',
      fieldConfig: { ...fieldConfig, multiple: true },
      previousEntry,
      entry,
    });

    expect(draft.currentValues.en).toEqual({
      'tags.0': 'en/react',
      'tags.1': 'en/svelte-js',
      'tags.1.x': 'en/svelte',
      other: 'x',
    });
  });

  it('leaves the values alone if they have not changed, or cannot be paired', () => {
    const draft = createParentDraft({ currentValues: { en: { tag: 'en/svelte' } } });
    const args = { draft, keyPath: 'tag', valueStoreKey: /** @type {const} */ ('currentValues') };

    replaceEntryValues({ ...args, fieldConfig, previousEntry, entry: previousEntry });
    expect(draft.currentValues.en.tag).toBe('en/svelte');

    vi.mocked(getEntryOptions).mockImplementation(({ refEntry }) =>
      refEntry === entry ? [] : [{ label: 'Svelte', value: 'en/svelte', searchValue: '' }],
    );
    replaceEntryValues({ ...args, fieldConfig, previousEntry, entry });
    expect(draft.currentValues.en.tag).toBe('en/svelte');
  });
});

describe('canEditEntry', () => {
  const collection = { ...tagCollection, _file: {} };

  const entry = /** @type {Entry} */ ({
    id: 'id-svelte',
    slug: 'svelte',
    subPath: 'svelte',
    locales: {},
  });

  beforeEach(() => {
    vi.mocked(getCollection).mockReturnValue(collection);
    vi.mocked(isEntryReadonly).mockReturnValue(false);
    vi.mocked(isWorkflowDraft).mockReturnValue(false);
    vi.mocked(isWorkflowEnabled).mockReturnValue(false);
  });

  it('allows a new entry pending on the draft, as long as its values are kept', () => {
    const pendingEntry = createPending('svelte');

    // Even where an existing entry couldn’t be edited
    vi.mocked(isWorkflowEnabled).mockReturnValue(true);

    expect(
      canEditEntry({
        fieldConfig,
        draft: createParentDraft({ pendingEntries: [pendingEntry] }),
        entry: pendingEntry.entry,
      }),
    ).toBe(true);

    const { source: _source, ...withoutSource } = pendingEntry;

    expect(
      canEditEntry({
        fieldConfig,
        draft: createParentDraft({ pendingEntries: [withoutSource] }),
        entry: pendingEntry.entry,
      }),
    ).toBe(false);
  });

  it('allows an existing entry saved on its own on the configured branch', () => {
    expect(canEditEntry({ fieldConfig, draft: createParentDraft(), entry })).toBe(true);
    expect(getCollection).toHaveBeenCalledWith('tags');
    expect(getUnpublishedEntry).toHaveBeenCalledWith({ collectionName: 'tags', subPath: 'svelte' });

    // Edited before
    const draft = createParentDraft({ pendingEntries: [createPendingEdit('svelte')] });

    expect(canEditEntry({ fieldConfig, draft, entry })).toBe(true);
  });

  it('refuses an entry that cannot be saved on its own, or not along with the draft', () => {
    const draft = createParentDraft();

    expect(canEditEntry({ fieldConfig: { ...fieldConfig, file: 'x' }, draft, entry })).toBe(false);

    /** @type {any[]} */ ([
      undefined,
      { ...collection, _type: 'file' },
      { ...collection, _file: { arrayFile: true } },
      { ...collection, readonly: true },
    ]).forEach((_collection) => {
      vi.mocked(getCollection).mockReturnValue(_collection);
      expect(canEditEntry({ fieldConfig, draft, entry })).toBe(false);
    });

    // The collection’s index file, which has fields of its own
    vi.mocked(getCollection).mockReturnValue(
      /** @type {any} */ ({ ...collection, fields: [], index_file: true }),
    );
    expect(canEditEntry({ fieldConfig, draft, entry })).toBe(true);
    expect(canEditEntry({ fieldConfig, draft, entry: { ...entry, slug: '_index' } })).toBe(false);

    vi.mocked(getCollection).mockReturnValue(collection);
    vi.mocked(isEntryReadonly).mockReturnValue(true);
    expect(canEditEntry({ fieldConfig, draft, entry })).toBe(false);

    vi.mocked(isEntryReadonly).mockReturnValue(false);
    expect(
      canEditEntry({
        fieldConfig,
        draft,
        entry: /** @type {any} */ ({ ...entry, workflow: { status: 'pending_deletion' } }),
      }),
    ).toBe(false);
  });

  it('refuses an entry while Editorial Workflow is involved', () => {
    const draft = createParentDraft();

    vi.mocked(isWorkflowDraft).mockReturnValue(true);
    expect(canEditEntry({ fieldConfig, draft, entry })).toBe(false);

    vi.mocked(isWorkflowDraft).mockReturnValue(false);
    vi.mocked(isWorkflowEnabled).mockReturnValue(true);
    expect(canEditEntry({ fieldConfig, draft, entry })).toBe(false);

    vi.mocked(isWorkflowEnabled).mockReturnValue(false);
    vi.mocked(getUnpublishedEntry).mockReturnValue(/** @type {any} */ ({}));
    expect(canEditEntry({ fieldConfig, draft, entry })).toBe(false);
  });

  it('refuses the entry being edited itself', () => {
    const draft = /** @type {EntryDraft} */ ({ ...createParentDraft(), id: 'id-svelte' });

    expect(canEditEntry({ fieldConfig, draft, entry })).toBe(false);

    const nestedDraft = /** @type {EntryDraft} */ ({
      ...createParentDraft(),
      id: 'other',
      // Being edited in a dialog the nested one was opened from
      quickAddHost: { collectionName: 'tags', workflow: false, entryIds: ['top', 'id-svelte'] },
    });

    expect(canEditEntry({ fieldConfig, draft: nestedDraft, entry })).toBe(false);
  });
});

describe('getEditableEntries', () => {
  const collection = { ...tagCollection, _file: {} };
  const svelte = /** @type {Entry} */ ({ id: 'id-svelte', slug: 'svelte', locales: {} });
  const react = /** @type {Entry} */ ({ id: 'id-react', slug: 'react', locales: {} });
  const other = /** @type {Entry} */ ({ id: 'id-other', slug: 'other', locales: {} });

  beforeEach(() => {
    vi.mocked(getCollection).mockReturnValue(collection);
    vi.mocked(isEntryReadonly).mockReturnValue(false);
    vi.mocked(isWorkflowDraft).mockReturnValue(false);
    vi.mocked(isWorkflowEnabled).mockReturnValue(false);
    vi.mocked(getEntryOptions).mockImplementation(({ refEntry }) =>
      refEntry === other
        ? // Goes by the same value as React, e.g. a shared title
          [{ label: 'React (other)', value: 'react', searchValue: '' }]
        : [{ label: refEntry.slug.toUpperCase(), value: refEntry.slug, searchValue: '' }],
    );
  });

  it('returns the selected entries that can be edited, by their value and label', () => {
    const draft = createParentDraft();
    const args = { draft, locale: 'en', fieldConfig, refEntries: [svelte, react] };

    expect(getEditableEntries({ ...args, currentValue: 'svelte' })).toEqual([
      { value: 'svelte', label: 'SVELTE', entry: svelte },
    ]);
    expect(getEditableEntries({ ...args, currentValue: ['react', 'svelte', 'vue'] })).toEqual([
      { value: 'react', label: 'REACT', entry: react },
      { value: 'svelte', label: 'SVELTE', entry: svelte },
    ]);
    expect(getEntryOptions).toHaveBeenCalledWith({
      locale: 'en',
      fieldConfig,
      refEntry: svelte,
      pendingEntries: draft.pendingEntries,
    });
  });

  it('returns nothing without a value', () => {
    const args = { draft: createParentDraft(), locale: 'en', fieldConfig, refEntries: [svelte] };

    [undefined, null, '', []].forEach((currentValue) => {
      expect(getEditableEntries({ ...args, currentValue })).toEqual([]);
    });

    expect(getEntryOptions).not.toHaveBeenCalled();
  });

  it('leaves out a value matching more than one entry, and an entry that cannot be edited', () => {
    const draft = createParentDraft();
    const args = { draft, locale: 'en', fieldConfig, refEntries: [svelte, react, other] };

    expect(getEditableEntries({ ...args, currentValue: ['react', 'svelte'] })).toEqual([
      { value: 'svelte', label: 'SVELTE', entry: svelte },
    ]);

    vi.mocked(isWorkflowEnabled).mockReturnValue(true);
    expect(getEditableEntries({ ...args, currentValue: 'svelte' })).toEqual([]);
  });

  it('offers an entry going by more than one selected value once', () => {
    // E.g. two items of a list field used as the value
    vi.mocked(getEntryOptions).mockImplementation(({ refEntry }) =>
      ['a', 'b'].map((item) => ({
        label: `${refEntry.slug} ${item}`,
        value: `${refEntry.slug}-${item}`,
        searchValue: '',
      })),
    );

    expect(
      getEditableEntries({
        draft: createParentDraft(),
        locale: 'en',
        fieldConfig,
        refEntries: [svelte],
        currentValue: ['svelte-a', 'svelte-b'],
      }),
    ).toEqual([{ value: 'svelte-a', label: 'svelte a', entry: svelte }]);
  });
});

describe('getEditTarget', () => {
  beforeEach(() => {
    allEntries.current = [];
    vi.mocked(compareWithStore).mockReturnValue(undefined);
  });

  it('creates a new entry without an entry to edit', () => {
    expect(getEditTarget({ pendingEntries: [], entry: undefined })).toEqual({
      changedSince: false,
    });
  });

  it('edits an existing entry from the version the field offers', () => {
    const { entry } = createPending('svelte');

    expect(getEditTarget({ pendingEntries: [createPending('react')], entry })).toEqual({
      baseEntry: entry,
      changedSince: false,
    });
  });

  it('opens a new pending entry again on its own', () => {
    const pendingEntry = createPending('svelte');

    expect(getEditTarget({ pendingEntries: [pendingEntry], entry: pendingEntry.entry })).toEqual({
      pendingEntry,
      changedSince: false,
    });
  });

  it('opens an edited entry again on top of its latest version, telling if it has changed', () => {
    const pendingEntry = createPendingEdit('svelte');
    const latest = /** @type {Entry} */ ({ ...pendingEntry.entry, locales: {} });
    const args = { pendingEntries: [pendingEntry], entry: pendingEntry.entry };

    allEntries.current = [latest];
    expect(getEditTarget(args)).toEqual({ pendingEntry, baseEntry: latest, changedSince: false });
    expect(compareWithStore).toHaveBeenCalledWith(pendingEntry.baseEntry);

    vi.mocked(compareWithStore).mockReturnValue({ type: 'modified', canOverwrite: true });
    expect(getEditTarget(args).changedSince).toBe(true);

    // Deleted since, so it’s edited from the version it was edited from
    allEntries.current = [];
    expect(getEditTarget(args)).toEqual({
      pendingEntry,
      baseEntry: pendingEntry.baseEntry,
      changedSince: false,
    });
  });
});
