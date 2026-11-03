import { beforeEach, describe, expect, it, vi } from 'vitest';

import { allEntries } from '$lib/services/contents';
import { getCollection } from '$lib/services/contents/collection';
import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
import { getDraftValues, isDraftModified } from '$lib/services/contents/draft';
import { restoreBackup } from '$lib/services/contents/draft/backup';
import { buildDraft } from '$lib/services/contents/draft/create';
import { getReferencedPendingEntrySet } from '$lib/services/contents/draft/pending-entries';
import { createSavingEntryData } from '$lib/services/contents/draft/save/changes';
import { compareWithStore } from '$lib/services/contents/draft/save/conflict';
import { assignManualSortOrder } from '$lib/services/contents/draft/save/sort-order';
import { getCanonicalSlug, getFillSlugOptions, getSlugs } from '$lib/services/contents/draft/slugs';
import { getField } from '$lib/services/contents/entry/fields';
import { isEntryReadonly } from '$lib/services/contents/entry/readonly';
import { getEntrySummary } from '$lib/services/contents/entry/summary';
import { assignAutoNowValues } from '$lib/services/contents/fields/date-time/auto-now';
import { assignAutoIncrementValues } from '$lib/services/contents/fields/number/auto-increment';
import { getEntryOptions, getRefEntries } from '$lib/services/contents/fields/relation/helpers';
import {
  findEditingUnpublishedEntry,
  getUnpublishedEntry,
  getUnpublishedEntryByBranch,
  getUnpublishedEntryByDraft,
  isWorkflowDraft,
  isWorkflowEnabled,
  unpublishedEntries,
} from '$lib/services/workflow';

import {
  addPendingEntries,
  buildQuickAddDraft,
  canEditEntry,
  compareWithLatest,
  createPendingEntry,
  getCreatableCollection,
  getEditableEntries,
  getEditingHostName,
  getEditTarget,
  getLatestEntry,
  getNestedPendingEntries,
  getNestedQuickAddHost,
  getPendingEntrySlugs,
  getPendingRefEntries,
  getQuickAddHost,
  getRefEntriesWithPending,
  getUnlistedEntries,
  hasCreationRoom,
  isEditUnchanged,
  isPendingEntryMoved,
  replaceEntryValues,
  revertSaveTimeValues,
  selectPendingEntry,
} from './quick-add';

/**
 * @import {
 * Entry,
 * EntryDraft,
 * InternalEntryCollection,
 * PendingEntry,
 * UnpublishedEntry,
 * } from '$lib/types/private';
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

vi.mock('$lib/services/contents/entry/fields', async (importOriginal) => ({
  .../** @type {any} */ (await importOriginal()),
  getField: vi.fn(),
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

vi.mock('$lib/services/contents/draft/backup', () => ({
  restoreBackup: vi.fn(),
}));
vi.mock('$lib/services/contents/draft/create', () => ({
  buildDraft: vi.fn(() => ({ id: 'built' })),
}));
vi.mock('$lib/services/contents/entry/summary', () => ({
  getEntrySummary: vi.fn(),
}));
vi.mock('$lib/services/contents/entry/readonly', () => ({
  isEntryReadonly: vi.fn(() => false),
}));

vi.mock('$lib/services/contents/draft/pending-entries', async (importOriginal) => ({
  .../** @type {any} */ (await importOriginal()),
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
    findEditingUnpublishedEntry: vi.fn(),
    getCompanionEntries: vi.fn((collectionName, entries = store.current) =>
      original.getCompanionEntries(collectionName, entries),
    ),
    getEditedCompanionEntries: vi.fn((collectionName, entries = store.current) =>
      original.getEditedCompanionEntries(collectionName, entries),
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
  vi.mocked(findEditingUnpublishedEntry).mockReturnValue(undefined);
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

describe('getUnlistedEntries', () => {
  it('returns the entries pending on the draft without a pull request', () => {
    const pendingEntries = [createPending('react')];
    const draft = createParentDraft({ pendingEntries });

    expect(getUnlistedEntries(undefined)).toBeUndefined();
    expect(getUnlistedEntries(draft)).toBe(pendingEntries);
  });

  it('puts the entries in the pull request of the host entry before the pending ones', () => {
    const react = createPending('react');
    const vue = createPending('vue');
    const draft = createParentDraft({ pendingEntries: [react] });
    const hostEntry = createHostEntry('svelte');

    vi.mocked(getUnpublishedEntryByDraft).mockReturnValue(hostEntry);
    vi.mocked(getUnpublishedEntryByBranch).mockReturnValue(hostEntry);

    expect(getUnlistedEntries(draft)).toEqual([...(hostEntry.workflow.companions ?? []), react]);
    expect(getUnlistedEntries(draft, [vue])).toEqual([
      ...(hostEntry.workflow.companions ?? []),
      vue,
    ]);
  });
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

  it('offers an entry an earlier save of the host entry has changed as it stands there', () => {
    const svelte = createPendingEdit('svelte');
    const react = createPendingEdit('react');
    const saved = [{ ...svelte.entry, commitDate: new Date() }, react.entry];
    const changedSvelte = { ...svelte.entry, slug: 'svelte-5' };
    const changedReact = { ...react.entry, slug: 'react-19' };
    const draft = createParentDraft({ pendingEntries: [react] });

    const hostEntry = /** @type {any} */ ({
      workflow: {
        pullRequest: { branch: 'cms/posts/hello' },
        companions: [
          { collectionName: 'tags', entry: changedSvelte, edited: true },
          { collectionName: 'tags', entry: changedReact, edited: true },
        ],
      },
    });

    vi.mocked(isWorkflowDraft).mockReturnValue(true);
    vi.mocked(getUnpublishedEntryByDraft).mockReturnValue(hostEntry);
    vi.mocked(getUnpublishedEntryByBranch).mockReturnValue(hostEntry);
    vi.mocked(getRefEntries).mockReturnValue(saved);

    // An entry edited again since is offered as edited
    expect(getRefEntriesWithPending({ draft, fieldConfig })).toEqual([changedSvelte, react.entry]);
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
    /** @type {any} */ ({
      id: 'new',
      isNew: true,
      collectionName: 'tags',
      defaultLocale: 'en',
      collection: { _type: 'entry' },
    })
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

  it('resolves the value against the entries in the pull request of the host entry', () => {
    const draft = createParentDraft({ currentValues: { en: { tag: '' } } });
    const hostEntry = createHostEntry('react');

    vi.mocked(getUnpublishedEntryByDraft).mockReturnValue(hostEntry);
    vi.mocked(getUnpublishedEntryByBranch).mockReturnValue(hostEntry);

    selectPendingEntry({
      draft,
      locale: 'en',
      keyPath: 'tag',
      valueStoreKey: 'currentValues',
      fieldConfig: { ...fieldConfig, name: 'tag' },
      pendingEntry,
    });

    expect(getEntryOptions).toHaveBeenCalledWith(
      expect.objectContaining({ pendingEntries: hostEntry.workflow.companions }),
    );
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
  const multipleFieldConfig = { ...fieldConfig, name: 'related', multiple: true };

  beforeEach(() => {
    vi.mocked(getEntryOptions).mockImplementation(({ locale, refEntry }) => [
      { label: refEntry.slug, value: `${locale}/${refEntry.slug}`, searchValue: '' },
    ]);
    // `tag` and the items of `related` and `items.*.tag` point at the `tags` collection, `category`
    // elsewhere
    vi.mocked(getField).mockImplementation(
      ({ keyPath }) =>
        /** @type {any} */ (
          keyPath === 'tag' || /^items\.\d+\.tag$/.test(keyPath)
            ? fieldConfig
            : /^related\.\d+$/.test(keyPath)
              ? multipleFieldConfig
              : keyPath === 'category'
                ? { ...fieldConfig, collection: 'categories' }
                : keyPath === 'title'
                  ? { name: 'title', widget: 'string' }
                  : undefined
        ),
    );
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

  it('replaces the values of every Relation field pointing at the collection', () => {
    const draft = createParentDraft({
      currentValues: {
        en: {
          title: 'en/svelte',
          tag: 'en/react',
          'related.0': 'en/react',
          'related.1': 'en/svelte',
          'items.0.tag': 'en/svelte',
          'items.0.other': 'en/svelte',
          category: 'en/svelte',
        },
      },
    });

    replaceEntryValues({
      draft,
      keyPath: 'tag',
      valueStoreKey: 'currentValues',
      fieldConfig,
      previousEntry,
      entry,
    });

    expect(draft.currentValues.en).toEqual({
      title: 'en/svelte',
      tag: 'en/react',
      'related.0': 'en/react',
      'related.1': 'en/svelte-js',
      'items.0.tag': 'en/svelte-js',
      'items.0.other': 'en/svelte',
      category: 'en/svelte',
    });
    // Each field’s values are worked out with its own configuration, once per locale
    expect(getEntryOptions).toHaveBeenCalledWith(
      expect.objectContaining({ fieldConfig: multipleFieldConfig, refEntry: previousEntry }),
    );
    expect(
      vi
        .mocked(getEntryOptions)
        .mock.calls.filter(([args]) => args.fieldConfig === fieldConfig && args.refEntry === entry),
    ).toHaveLength(1);
  });

  it('replaces the value of the field in the values of a rich text editor component', () => {
    const draft = /** @type {any} */ ({
      ...createParentDraft({ currentValues: { en: { tag: 'en/svelte' } } }),
      extraValues: {
        en: { 'tags.0': 'en/svelte', 'tags.1': 'en/react', label: 'en/svelte' },
        fr: { 'tags.0': 'fr/svelte' },
      },
    });

    replaceEntryValues({
      draft,
      keyPath: 'tags',
      valueStoreKey: 'extraValues',
      fieldConfig: { ...fieldConfig, multiple: true },
      previousEntry,
      entry,
    });

    expect(draft.extraValues).toEqual({
      en: { 'tags.0': 'en/svelte-js', 'tags.1': 'en/react', label: 'en/svelte' },
      fr: { 'tags.0': 'fr/svelte-js' },
    });
    // The entry’s own fields are updated as well
    expect(draft.currentValues.en.tag).toBe('en/svelte-js');

    const singleDraft = /** @type {any} */ ({
      ...createParentDraft(),
      extraValues: { en: { tag: 'en/svelte' } },
    });

    replaceEntryValues({
      draft: singleDraft,
      keyPath: 'tag',
      valueStoreKey: 'extraValues',
      fieldConfig,
      previousEntry,
      entry,
    });

    expect(singleDraft.extraValues.en.tag).toBe('en/svelte-js');
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

  it('allows an entry of another collection to go into the pull request of the draft', () => {
    const draft = createParentDraft();

    vi.mocked(isWorkflowDraft).mockReturnValue(true);
    // Even if the collection uses the workflow, as it’s reviewed along with the draft
    vi.mocked(isWorkflowEnabled).mockReturnValue(true);
    expect(canEditEntry({ fieldConfig, draft, entry })).toBe(true);

    // An entry of the same collection couldn’t be told apart from the draft on the board
    vi.mocked(getCollection).mockReturnValue({ ...collection, name: 'posts' });
    expect(
      canEditEntry({ fieldConfig: { ...fieldConfig, collection: 'posts' }, draft, entry }),
    ).toBe(false);
  });

  it('refuses an entry that would skip the review, or another pull request changes', () => {
    const draft = createParentDraft();

    // Saved on the configured branch along with the draft
    vi.mocked(isWorkflowEnabled).mockReturnValue(true);
    expect(canEditEntry({ fieldConfig, draft, entry })).toBe(false);

    vi.mocked(isWorkflowEnabled).mockReturnValue(false);
    vi.mocked(getUnpublishedEntry).mockReturnValue(/** @type {any} */ ({}));
    expect(canEditEntry({ fieldConfig, draft, entry })).toBe(false);
    vi.mocked(getUnpublishedEntry).mockReturnValue(undefined);

    // Edited along with another entry
    vi.mocked(findEditingUnpublishedEntry).mockReturnValue(
      /** @type {any} */ ({ workflow: { pullRequest: { branch: 'cms/posts/other' } } }),
    );
    expect(canEditEntry({ fieldConfig, draft, entry })).toBe(false);
    expect(findEditingUnpublishedEntry).toHaveBeenCalledWith(entry);

    // Edited along with the draft by an earlier save
    vi.mocked(isWorkflowDraft).mockReturnValue(true);
    vi.mocked(getUnpublishedEntryByDraft).mockReturnValue(
      /** @type {any} */ ({ workflow: { pullRequest: { branch: 'cms/posts/other' } } }),
    );
    expect(canEditEntry({ fieldConfig, draft, entry })).toBe(true);
  });

  it('refuses an entry changed on the configured branch since the pull request was opened', () => {
    const draft = createParentDraft();

    const hostEntry = /** @type {any} */ ({
      workflow: {
        pullRequest: { branch: 'cms/posts/hello', createdDate: new Date('2026-01-02T00:00:00Z') },
      },
    });

    /**
     * Check whether the entry last committed at the given date can be edited.
     * @param {string} date Commit date.
     * @returns {boolean} Result.
     */
    const canEditAt = (date) =>
      canEditEntry({ fieldConfig, draft, entry: { ...entry, commitDate: new Date(date) } });

    vi.mocked(isWorkflowDraft).mockReturnValue(true);
    vi.mocked(getUnpublishedEntryByDraft).mockReturnValue(hostEntry);
    vi.mocked(getUnpublishedEntryByBranch).mockReturnValue(hostEntry);
    vi.mocked(findEditingUnpublishedEntry).mockReturnValue(undefined);

    expect(canEditAt('2026-01-01T00:00:00Z')).toBe(true);
    expect(canEditAt('2026-01-03T00:00:00Z')).toBe(false);
    // Without the commit date, there’s nothing to tell
    expect(canEditEntry({ fieldConfig, draft, entry })).toBe(true);

    // The pull request changes the entry already, so its branch has the entry as it is now
    vi.mocked(findEditingUnpublishedEntry).mockReturnValue(hostEntry);
    expect(canEditAt('2026-01-03T00:00:00Z')).toBe(true);
    vi.mocked(findEditingUnpublishedEntry).mockReturnValue(undefined);

    // So does an entry created in the pull request by an earlier save
    hostEntry.workflow.companions = [{ collectionName: 'tags', entry: { id: entry.id } }];
    expect(canEditAt('2026-01-03T00:00:00Z')).toBe(true);
    delete hostEntry.workflow.companions;

    // Without a pull request, the entry is saved on the configured branch
    vi.mocked(findEditingUnpublishedEntry).mockReturnValue(undefined);
    vi.mocked(getUnpublishedEntryByDraft).mockReturnValue(undefined);
    expect(canEditAt('2026-01-03T00:00:00Z')).toBe(true);

    // The pull request has gone in the meantime
    vi.mocked(getUnpublishedEntryByDraft).mockReturnValue(hostEntry);
    vi.mocked(getUnpublishedEntryByBranch).mockReturnValue(undefined);
    expect(canEditAt('2026-01-03T00:00:00Z')).toBe(true);
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
    expect(getEditTarget({ parentDraft: createParentDraft(), entry: undefined })).toEqual({
      changedSince: false,
    });
  });

  it('edits an existing entry from the version the field offers', () => {
    const { entry } = createPending('svelte');
    const parentDraft = createParentDraft({ pendingEntries: [createPending('react')] });

    expect(getEditTarget({ parentDraft, entry })).toEqual({
      baseEntry: entry,
      changedSince: false,
    });
  });

  it('opens a new pending entry again on its own', () => {
    const pendingEntry = createPending('svelte');
    const parentDraft = createParentDraft({ pendingEntries: [pendingEntry] });

    expect(getEditTarget({ parentDraft, entry: pendingEntry.entry })).toEqual({
      pendingEntry,
      changedSince: false,
    });
  });

  it('opens an edited entry again on top of its latest version, telling if it has changed', () => {
    const pendingEntry = createPendingEdit('svelte');
    const latest = /** @type {Entry} */ ({ ...pendingEntry.entry, locales: {} });
    const parentDraft = createParentDraft({ pendingEntries: [pendingEntry] });
    const args = { parentDraft, entry: pendingEntry.entry };

    allEntries.current = [latest];
    expect(getEditTarget(args)).toEqual({ pendingEntry, baseEntry: latest, changedSince: false });
    expect(compareWithStore).toHaveBeenCalledWith(pendingEntry.baseEntry, { entries: [latest] });

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

describe('buildQuickAddDraft', () => {
  const collection = /** @type {InternalEntryCollection} */ ({ name: 'tags' });

  beforeEach(() => {
    allEntries.current = [];
    vi.mocked(compareWithStore).mockReturnValue(undefined);
  });

  it('builds a new entry at the root of the collection folder', async () => {
    const parentDraft = /** @type {EntryDraft} */ ({ ...createParentDraft(), id: 'hello' });
    const { draft, changedSince } = await buildQuickAddDraft({ collection, parentDraft });

    expect(buildDraft).toHaveBeenCalledWith({ collection, initialPath: '' });
    expect(restoreBackup).not.toHaveBeenCalled();
    expect(changedSince).toBe(false);
    expect(draft.id).toBe('built');
    expect(draft.pendingEntries).toEqual([]);
    expect(draft.quickAddHost?.entryIds).toEqual(['hello']);
  });

  it('builds an existing entry from its version, restoring the values it was added with', async () => {
    const pendingEntry = { ...createPending('svelte'), source: /** @type {any} */ ({ a: 1 }) };
    const parentDraft = createParentDraft({ pendingEntries: [pendingEntry] });
    const { entry } = createPending('react');

    await buildQuickAddDraft({ collection, parentDraft, entry });
    expect(buildDraft).toHaveBeenLastCalledWith({ collection, originalEntry: entry });

    const { draft } = await buildQuickAddDraft({
      collection,
      parentDraft,
      entry: pendingEntry.entry,
    });

    expect(draft.id).toBe(pendingEntry.entry.id);
    expect(restoreBackup).toHaveBeenCalledWith({ backup: { a: 1 }, draft });
    expect(draft.pendingEntries).toEqual([pendingEntry]);
    expect(draft.pendingEntries).not.toBe(parentDraft.pendingEntries);
  });
});

describe('getLatestEntry', () => {
  const published = /** @type {Entry} */ ({ id: 'id-svelte', slug: 'svelte', locales: {} });
  const changed = /** @type {Entry} */ ({ ...published, locales: { en: /** @type {any} */ ({}) } });

  beforeEach(() => {
    allEntries.current = [published];
  });

  it('returns the entry on the configured branch', () => {
    expect(getLatestEntry(createParentDraft(), 'id-svelte')).toBe(published);
    expect(getLatestEntry(createParentDraft(), 'id-other')).toBeUndefined();
  });

  it('returns the entry as an earlier save of the host entry has created or changed it', () => {
    const draft = createParentDraft();

    const hostEntry = /** @type {any} */ ({
      workflow: {
        pullRequest: { branch: 'cms/posts/hello' },
        companions: [
          // A new entry an earlier save has created can be edited again too
          { collectionName: 'tags', entry: { ...published, id: 'id-new' } },
          { collectionName: 'tags', entry: changed, edited: true },
        ],
      },
    });

    vi.mocked(isWorkflowDraft).mockReturnValue(true);
    vi.mocked(getUnpublishedEntryByDraft).mockReturnValue(hostEntry);
    vi.mocked(getUnpublishedEntryByBranch).mockReturnValue(hostEntry);
    expect(getLatestEntry(draft, 'id-svelte')).toBe(changed);
    expect(getUnpublishedEntryByBranch).toHaveBeenCalledWith('cms/posts/hello');
    expect(getLatestEntry(draft, 'id-new')).toEqual({ ...published, id: 'id-new' });

    // Without companions
    vi.mocked(getUnpublishedEntryByBranch).mockReturnValue(
      /** @type {any} */ ({ workflow: { pullRequest: { branch: 'cms/posts/hello' } } }),
    );
    expect(getLatestEntry(draft, 'id-svelte')).toBe(published);
  });

  it('compares a version with the latest one', () => {
    vi.mocked(compareWithStore).mockReturnValue(undefined);
    expect(compareWithLatest(createParentDraft(), published)).toBeUndefined();
    expect(compareWithStore).toHaveBeenCalledWith(published, { entries: [published] });

    allEntries.current = [];
    compareWithLatest(createParentDraft(), published);
    expect(compareWithStore).toHaveBeenLastCalledWith(published, { entries: [] });
  });
});

describe('getEditingHostName', () => {
  const draft = /** @type {EntryDraft} */ (
    /** @type {any} */ ({ isNew: false, originalEntry: { id: 'id-ada', slug: 'ada' } })
  );

  /**
   * Build the unpublished entry of a post.
   * @param {object} [workflow] Workflow properties.
   * @returns {any} Unpublished entry.
   */
  const createPostEntry = (workflow = {}) => ({
    slug: 'hello',
    locales: { _default: { content: { title: 'Hello' } } },
    workflow: { collectionName: 'posts', ...workflow },
  });

  beforeEach(() => {
    vi.mocked(getEntrySummary).mockReturnValue('Hello World');
  });

  it('returns nothing without an existing entry that another pull request changes', () => {
    expect(getEditingHostName(undefined)).toBeUndefined();
    expect(getEditingHostName(/** @type {any} */ ({ isNew: true }))).toBeUndefined();
    expect(getEditingHostName(/** @type {any} */ ({ isNew: false }))).toBeUndefined();
    expect(getEditingHostName(draft)).toBeUndefined();
    expect(findEditingUnpublishedEntry).toHaveBeenCalledWith(draft.originalEntry);
  });

  it('names the entry whose pull request changes the entry', () => {
    const posts = { name: 'posts', _type: 'entry' };

    vi.mocked(findEditingUnpublishedEntry).mockReturnValue(createPostEntry());
    vi.mocked(getCollection).mockReturnValue(/** @type {any} */ (posts));
    expect(getEditingHostName(draft)).toBe('Hello World');
    expect(getEntrySummary).toHaveBeenCalledWith(posts, expect.objectContaining({ slug: 'hello' }));

    // A file of a file collection
    vi.mocked(findEditingUnpublishedEntry).mockReturnValue(
      createPostEntry({ collectionName: 'pages', fileName: 'home' }),
    );
    vi.mocked(getCollection).mockReturnValue(
      /** @type {any} */ ({
        name: 'pages',
        _type: 'file',
        _fileMap: { home: { name: 'home', label: 'Home Page' } },
      }),
    );
    expect(getEditingHostName(draft)).toBe('Home Page');

    // A collection removed from the configuration since leaves the slug to go by
    vi.mocked(getCollection).mockReturnValue(undefined);
    expect(getEditingHostName(draft)).toBe('hello');
  });
});
