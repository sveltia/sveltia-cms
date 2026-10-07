import { beforeEach, describe, expect, test } from 'vitest';

import { backend, backendName } from '$lib/services/backends';
import { mergeLockedBranch } from '$lib/services/backends/branch-access';
import { cmsConfig } from '$lib/services/config';
import { allEntries } from '$lib/services/contents';
import { createDerivedState } from '$lib/services/utils/state.svelte';
import {
  canMergePullRequest,
  checkPublishedVersion,
  getPublishedVersion,
  getUnpublishedEntriesByCollection,
  getUnpublishedEntry,
  getUnpublishedEntryByBranch,
  getUnpublishedEntryByDraft,
  getUnpublishedEntryBySlug,
  hasPublishedVersion,
  isPublishAllowed,
  isWorkflowDraft,
  isWorkflowEnabled,
  mergeUnpublishedEntries,
  unpublishedEntries,
  unpublishedEntriesLoaded,
  workflowDataReady,
  workflowEnabled,
} from '$lib/services/workflow';
import { forkedRepository } from '$lib/services/workflow/open-authoring';

/**
 * Create a minimal unpublished entry for testing.
 * @param {object} args Arguments.
 * @param {string} args.collectionName Collection name.
 * @param {string} args.subPath Entry sub path.
 * @returns {any} Unpublished entry.
 */
const createEntry = ({ collectionName, subPath }) => ({
  id: `${collectionName}/${subPath}`,
  slug: subPath,
  subPath,
  locales: { _default: { path: `content/${collectionName}/${subPath}.md` } },
  workflow: {
    collectionName,
    status: 'draft',
    pullRequest: { branch: `cms/${collectionName}/${subPath}` },
  },
});

describe('workflow/index', () => {
  beforeEach(() => {
    unpublishedEntries.current = [];
    unpublishedEntriesLoaded.current = false;
    allEntries.current = [];
    cmsConfig.current = undefined;
    backendName.current = undefined;
    forkedRepository.current = undefined;
  });

  describe('workflowDataReady', () => {
    test('is true right away when the feature is disabled', () => {
      backendName.current = 'github';
      cmsConfig.current = /** @type {any} */ ({ publish_mode: 'simple' });
      expect(workflowDataReady.current).toBe(true);
    });

    test('waits for the unpublished entries when the feature is enabled', () => {
      backendName.current = 'github';
      cmsConfig.current = /** @type {any} */ ({ publish_mode: 'editorial_workflow' });
      expect(workflowDataReady.current).toBe(false);

      unpublishedEntriesLoaded.current = true;
      expect(workflowDataReady.current).toBe(true);
    });
  });

  describe('workflowEnabled', () => {
    test('is false without the editorial_workflow publish mode', () => {
      backendName.current = 'github';
      cmsConfig.current = /** @type {any} */ ({ publish_mode: 'simple' });
      expect(workflowEnabled.current).toBe(false);
    });

    test('is false when the backend doesn’t implement the feature', () => {
      backendName.current = 'test-repo';
      cmsConfig.current = /** @type {any} */ ({ publish_mode: 'editorial_workflow' });
      expect(backend.current?.workflow).toBeUndefined();
      expect(workflowEnabled.current).toBe(false);
    });

    test.each(['github', 'gitlab', 'gitea'])(
      'is true with the %s backend and the editorial_workflow publish mode',
      (name) => {
        backendName.current = name;
        cmsConfig.current = /** @type {any} */ ({ publish_mode: 'editorial_workflow' });
        expect(workflowEnabled.current).toBe(true);
      },
    );

    test('is true when a collection opts in on its own', () => {
      backendName.current = 'github';
      cmsConfig.current = /** @type {any} */ ({
        publish_mode: 'simple',
        collections: [{ name: 'posts', folder: 'posts', publish_mode: 'editorial_workflow' }],
      });
      expect(workflowEnabled.current).toBe(true);
    });

    test('stays true when every collection opts out', () => {
      // Singletons follow the site-level option
      backendName.current = 'github';
      cmsConfig.current = /** @type {any} */ ({
        publish_mode: 'editorial_workflow',
        collections: [{ name: 'posts', folder: 'posts', publish_mode: 'simple' }],
      });
      expect(workflowEnabled.current).toBe(true);
    });
  });

  describe('isWorkflowEnabled', () => {
    /** @type {any} */
    const posts = { name: 'posts', folder: 'posts' };
    /** @type {any} */
    const optedOut = { name: 'settings', files: [], publish_mode: 'simple' };
    /** @type {any} */
    const optedIn = { name: 'reviewed', folder: 'reviewed', publish_mode: 'editorial_workflow' };

    test('follows the site-level publish mode for a collection without its own', () => {
      backendName.current = 'github';
      cmsConfig.current = /** @type {any} */ ({ publish_mode: 'simple' });
      expect(isWorkflowEnabled(posts)).toBe(false);
      expect(isWorkflowEnabled(undefined)).toBe(false);

      cmsConfig.current = /** @type {any} */ ({ publish_mode: 'editorial_workflow' });
      expect(isWorkflowEnabled(posts)).toBe(true);
      expect(isWorkflowEnabled(undefined)).toBe(true);
    });

    test('lets a collection override the site-level publish mode', () => {
      backendName.current = 'github';
      cmsConfig.current = /** @type {any} */ ({ publish_mode: 'editorial_workflow' });
      expect(isWorkflowEnabled(optedOut)).toBe(false);

      cmsConfig.current = /** @type {any} */ ({ publish_mode: 'simple' });
      expect(isWorkflowEnabled(optedIn)).toBe(true);
    });

    test('is false when the backend doesn’t implement the feature', () => {
      backendName.current = 'test-repo';
      cmsConfig.current = /** @type {any} */ ({ publish_mode: 'editorial_workflow' });
      expect(isWorkflowEnabled(posts)).toBe(false);
      expect(isWorkflowEnabled(optedIn)).toBe(false);
    });

    test('ignores an opt-out for a contributor working on a fork', () => {
      // The contributor can’t write to the configured repository, so every change has to go
      // through a pull request
      backendName.current = 'github';
      cmsConfig.current = /** @type {any} */ ({ publish_mode: 'editorial_workflow' });
      forkedRepository.current = { owner: 'me', repo: 'site' };
      expect(isWorkflowEnabled(optedOut)).toBe(true);
    });
  });

  describe('isWorkflowDraft', () => {
    /** @type {any} */
    const optedOut = { name: 'posts', folder: 'posts', publish_mode: 'simple' };

    beforeEach(() => {
      backendName.current = 'github';
      cmsConfig.current = /** @type {any} */ ({ publish_mode: 'editorial_workflow' });
    });

    test('follows the collection’s publish mode for an entry without a pull request', () => {
      const originalEntry = /** @type {any} */ ({
        slug: 'a',
        locales: { _default: { path: 'content/posts/a.md' } },
      });

      expect(
        isWorkflowDraft({ collection: optedOut, collectionName: 'posts', originalEntry }),
      ).toBe(false);
      expect(isWorkflowDraft({ collection: optedOut, collectionName: 'posts' })).toBe(false);
      expect(
        isWorkflowDraft({
          collection: /** @type {any} */ ({ name: 'posts', folder: 'posts' }),
          collectionName: 'posts',
        }),
      ).toBe(true);
    });

    test('keeps an entry that already has a pull request in the workflow', () => {
      // The collection has opted out since the pull request was opened, or a contributor working
      // on a fork opened it. Either way, saving straight to the configured branch would publish
      // the unreviewed changes
      const entry = createEntry({ collectionName: 'posts', subPath: 'a' });

      unpublishedEntries.current = [entry];

      expect(
        isWorkflowDraft({ collection: optedOut, collectionName: 'posts', originalEntry: entry }),
      ).toBe(true);
      // The published version was opened, but the pull request is found by the slug
      expect(
        isWorkflowDraft({
          collection: optedOut,
          collectionName: 'posts',
          originalEntry: /** @type {any} */ ({
            slug: 'a',
            locales: { _default: { path: 'content/posts/a.md' } },
          }),
        }),
      ).toBe(true);
      // Another entry in the same collection has no pull request
      expect(
        isWorkflowDraft({
          collection: optedOut,
          collectionName: 'posts',
          originalEntry: /** @type {any} */ ({
            slug: 'b',
            locales: { _default: { path: 'content/posts/b.md' } },
          }),
        }),
      ).toBe(false);
    });
  });

  describe('getUnpublishedEntriesByCollection', () => {
    test('filters the entries by collection', () => {
      unpublishedEntries.current = [
        createEntry({ collectionName: 'posts', subPath: 'a' }),
        createEntry({ collectionName: 'pages', subPath: 'b' }),
      ];

      expect(getUnpublishedEntriesByCollection('posts')).toHaveLength(1);
      expect(getUnpublishedEntriesByCollection('pages')).toHaveLength(1);
      expect(getUnpublishedEntriesByCollection('other')).toHaveLength(0);
    });

    test('returns an empty array without a collection name', () => {
      unpublishedEntries.current = [createEntry({ collectionName: 'posts', subPath: 'a' })];
      expect(getUnpublishedEntriesByCollection(undefined)).toEqual([]);
    });
  });

  describe('getUnpublishedEntry', () => {
    test('finds the entry by collection name and sub path', () => {
      unpublishedEntries.current = [
        createEntry({ collectionName: 'posts', subPath: 'a' }),
        createEntry({ collectionName: 'posts', subPath: 'b' }),
      ];

      expect(getUnpublishedEntry({ collectionName: 'posts', subPath: 'b' })?.subPath).toBe('b');
      expect(getUnpublishedEntry({ collectionName: 'posts', subPath: 'c' })).toBeUndefined();
      expect(getUnpublishedEntry({ collectionName: 'pages', subPath: 'a' })).toBeUndefined();
    });

    test('finds a collection file by its name rather than its path', () => {
      const entry = createEntry({ collectionName: 'settings', subPath: 'data/site.yml' });

      entry.workflow.fileName = 'site';
      unpublishedEntries.current = [entry];

      // The URL carries the file name, while the entry’s `subPath` is the whole file path
      expect(getUnpublishedEntry({ collectionName: 'settings', subPath: 'site' })).toBe(entry);

      expect(
        getUnpublishedEntry({ collectionName: 'settings', subPath: 'data/site.yml' }),
      ).toBeUndefined();
    });
  });

  describe('getUnpublishedEntryBySlug', () => {
    /**
     * Create the published entry a branch would hold.
     * @param {string} path File path.
     * @returns {any} Entry.
     */
    const createPublished = (path) => ({ locales: { _default: { path } } });

    test('finds the entry by the branch opened for it', () => {
      const entry = createEntry({ collectionName: 'posts', subPath: 'hello' });
      const published = createPublished('content/posts/hello.md');

      // The branch keeps the slug the entry had when the pull request was opened
      entry.slug = 'renamed';
      entry.subPath = 'renamed';
      unpublishedEntries.current = [entry];

      expect(
        getUnpublishedEntryBySlug({ collectionName: 'posts', slug: 'hello', entry: published }),
      ).toBe(entry);
      expect(
        getUnpublishedEntryBySlug({ collectionName: 'posts', slug: 'renamed', entry: published }),
      ).toBeUndefined();
      expect(
        getUnpublishedEntryBySlug({ collectionName: 'pages', slug: 'hello', entry: published }),
      ).toBeUndefined();
    });

    test('finds a nested entry whether or not its branch encodes the slashes', () => {
      const encoded = createEntry({ collectionName: 'pages', subPath: 'about/ethos' });
      const legacy = createEntry({ collectionName: 'pages', subPath: 'about/team' });

      encoded.workflow.pullRequest.branch = 'cms/pages/about%2Fethos';
      unpublishedEntries.current = [encoded, legacy];

      expect(
        getUnpublishedEntryBySlug({
          collectionName: 'pages',
          slug: 'about/ethos',
          entry: createPublished('content/pages/about/ethos.md'),
        }),
      ).toBe(encoded);
      expect(
        getUnpublishedEntryBySlug({
          collectionName: 'pages',
          slug: 'about/team',
          entry: createPublished('content/pages/about/team.md'),
        }),
      ).toBe(legacy);
      expect(
        getUnpublishedEntryBySlug({
          collectionName: 'pages',
          slug: 'about',
          entry: createPublished('content/pages/about.md'),
        }),
      ).toBeUndefined();
    });

    test('only finds a pull request that holds the entry', () => {
      // Someone opened a pull request under the entry’s branch name that holds another entry.
      // Taking it for the entry’s would make its editor offer to publish that other entry
      const squatter = createEntry({ collectionName: 'posts', subPath: 'zzz' });

      squatter.workflow.pullRequest.branch = 'cms/posts/hello';
      unpublishedEntries.current = [squatter];

      expect(
        getUnpublishedEntryBySlug({
          collectionName: 'posts',
          slug: 'hello',
          entry: createPublished('content/posts/hello.md'),
        }),
      ).toBeUndefined();

      // A renamed entry is matched by the path it vacates
      /** @type {any} */ (squatter.workflow).previousPaths = ['content/posts/hello.md'];

      expect(
        getUnpublishedEntryBySlug({
          collectionName: 'posts',
          slug: 'hello',
          entry: createPublished('content/posts/hello.md'),
        }),
      ).toBe(squatter);

      // A new entry has no pull request yet
      expect(
        getUnpublishedEntryBySlug({ collectionName: 'posts', slug: 'hello', entry: undefined }),
      ).toBeUndefined();
    });
  });

  describe('getUnpublishedEntryByBranch', () => {
    test('finds the entry by its branch name as is', () => {
      const entry = createEntry({ collectionName: 'posts', subPath: 'hello' });

      unpublishedEntries.current = [entry];

      expect(getUnpublishedEntryByBranch('cms/posts/hello')).toBe(entry);
      expect(getUnpublishedEntryByBranch('cms/posts/hello-2')).toBeUndefined();
    });
  });

  describe('getUnpublishedEntryByDraft', () => {
    test('returns nothing for a new entry', () => {
      unpublishedEntries.current = [createEntry({ collectionName: 'posts', subPath: 'hello' })];

      expect(getUnpublishedEntryByDraft({ collectionName: 'posts' })).toBeUndefined();
    });

    test('finds the entry by the branch it is already associated with', () => {
      const entry = createEntry({ collectionName: 'posts', subPath: 'hello' });

      // The slug was edited after the pull request was opened, so the branch still carries the old
      // slug while the entry has the new one
      entry.slug = 'renamed';
      entry.subPath = 'renamed';
      unpublishedEntries.current = [entry];

      expect(getUnpublishedEntryByDraft({ collectionName: 'posts', originalEntry: entry })).toBe(
        entry,
      );
    });

    test('follows an entry replaced in the store', () => {
      const entry = createEntry({ collectionName: 'posts', subPath: 'hello' });
      const updated = { ...entry, workflow: { ...entry.workflow, status: 'pending_review' } };

      unpublishedEntries.current = [updated];

      expect(getUnpublishedEntryByDraft({ collectionName: 'posts', originalEntry: entry })).toBe(
        updated,
      );
    });

    test('falls back to the branch derived from the slug', () => {
      const entry = createEntry({ collectionName: 'posts', subPath: 'hello' });
      const { workflow, ...publishedEntry } = entry;

      unpublishedEntries.current = [entry];

      expect(workflow).toBeDefined();
      // The editor opened the published version, e.g. before the pull request was found
      expect(
        getUnpublishedEntryByDraft({ collectionName: 'posts', originalEntry: publishedEntry }),
      ).toBe(entry);
      expect(
        getUnpublishedEntryByDraft({ collectionName: 'pages', originalEntry: publishedEntry }),
      ).toBeUndefined();
    });

    test('addresses a collection file by its name', () => {
      const entry = createEntry({ collectionName: 'settings', subPath: 'data/site.yml' });
      const { workflow, ...publishedEntry } = entry;

      entry.workflow.fileName = 'site';
      entry.workflow.pullRequest.branch = 'cms/settings/site';
      unpublishedEntries.current = [entry];

      expect(workflow).toBeDefined();
      expect(
        getUnpublishedEntryByDraft({
          collectionName: 'settings',
          fileName: 'site',
          originalEntry: publishedEntry,
        }),
      ).toBe(entry);
    });

    test('returns nothing once the pull request is gone', () => {
      const entry = createEntry({ collectionName: 'posts', subPath: 'hello' });

      unpublishedEntries.current = [];

      expect(
        getUnpublishedEntryByDraft({ collectionName: 'posts', originalEntry: entry }),
      ).toBeUndefined();
    });
  });
});

describe('getPublishedVersion', () => {
  beforeEach(() => {
    allEntries.current = [];
  });

  test('returns the published entry sharing a file path', () => {
    const entry = createEntry({ collectionName: 'posts', subPath: 'hello' });

    const published = /** @type {any} */ ({
      id: 'p1',
      locales: { _default: { path: 'content/posts/hello.md' } },
    });

    allEntries.current = [published];

    expect(getPublishedVersion(entry)).toBe(published);
  });

  test('matches the path the entry had before the pull request renamed it', () => {
    const entry = createEntry({ collectionName: 'posts', subPath: 'renamed' });

    const published = /** @type {any} */ ({
      id: 'p1',
      locales: { _default: { path: 'content/posts/hello.md' } },
    });

    entry.workflow.previousPaths = ['content/posts/hello.md'];
    allEntries.current = [published];

    expect(getPublishedVersion(entry)).toBe(published);
  });

  test('is undefined for an entry that has never been published', () => {
    const entry = createEntry({ collectionName: 'posts', subPath: 'hello' });

    allEntries.current = [
      /** @type {any} */ ({ id: 'p1', locales: { _default: { path: 'content/posts/other.md' } } }),
    ];

    expect(getPublishedVersion(entry)).toBeUndefined();
  });

  test('is undefined for a published entry, which has no other version', () => {
    const published = /** @type {any} */ ({
      id: 'p1',
      locales: { _default: { path: 'content/posts/hello.md' } },
    });

    allEntries.current = [published];

    expect(getPublishedVersion(published)).toBeUndefined();
  });
});

describe('hasPublishedVersion', () => {
  beforeEach(() => {
    allEntries.current = [];
  });

  test('is true when a published entry shares a file path', () => {
    const entry = createEntry({ collectionName: 'posts', subPath: 'hello' });

    allEntries.current = [
      /** @type {any} */ ({ id: 'p1', locales: { _default: { path: 'content/posts/hello.md' } } }),
    ];

    expect(hasPublishedVersion(entry)).toBe(true);
  });

  test('matches the path the entry had before the pull request renamed it', () => {
    const entry = createEntry({ collectionName: 'posts', subPath: 'renamed' });

    entry.workflow.previousPaths = ['content/posts/hello.md'];

    allEntries.current = [
      /** @type {any} */ ({ id: 'p1', locales: { _default: { path: 'content/posts/hello.md' } } }),
    ];

    expect(hasPublishedVersion(entry)).toBe(true);
  });

  test('is false for an entry that has never been published', () => {
    const entry = createEntry({ collectionName: 'posts', subPath: 'hello' });

    allEntries.current = [
      /** @type {any} */ ({ id: 'p1', locales: { _default: { path: 'content/posts/other.md' } } }),
    ];

    expect(hasPublishedVersion(entry)).toBe(false);
    allEntries.current = [];
    expect(hasPublishedVersion(entry)).toBe(false);
  });

  test('is true for a collection file, which can never be deleted from the site', () => {
    const entry = createEntry({ collectionName: 'settings', subPath: 'site' });

    entry.workflow.fileName = 'site';

    // The file hasn’t been written to the configured branch yet, but it’s still part of the
    // collection, so the pull request can only be discarded, never deleted
    expect(hasPublishedVersion(entry)).toBe(true);
  });

  test('matches any locale of a multilingual entry', () => {
    const entry = /** @type {any} */ ({
      locales: {
        en: { path: 'content/posts/en/hello.md' },
        fr: { path: 'content/posts/fr/hello.md' },
      },
      workflow: {},
    });

    allEntries.current = [
      /** @type {any} */ ({ id: 'p1', locales: { fr: { path: 'content/posts/fr/hello.md' } } }),
    ];

    expect(hasPublishedVersion(entry)).toBe(true);
  });
});

describe('checkPublishedVersion', () => {
  beforeEach(() => {
    allEntries.current = [];
  });

  test('is false without an entry', () => {
    expect(checkPublishedVersion(undefined)).toBe(false);
  });

  test('tells whether the entry has a published version', () => {
    const entry = createEntry({ collectionName: 'posts', subPath: 'hello' });

    expect(checkPublishedVersion(entry)).toBe(false);

    allEntries.current = [
      /** @type {any} */ ({ id: 'p1', locales: { _default: { path: 'content/posts/hello.md' } } }),
    ];

    expect(checkPublishedVersion(entry)).toBe(true);
  });

  test('makes a derived state depend on the published entries', () => {
    const entry = createEntry({ collectionName: 'settings', subPath: 'site' });
    let count = 0;

    entry.workflow.fileName = 'site';

    const state = createDerivedState(() => {
      count += 1;

      return checkPublishedVersion(entry);
    });

    expect(state.current).toBe(true);
    // A collection file doesn’t need the store to be looked up, but it’s read all the same
    allEntries.current = [];
    expect(state.current).toBe(true);
    expect(count).toBe(2);
  });
});

describe('mergeUnpublishedEntries', () => {
  /**
   * Create a published entry for testing.
   * @param {string} id Entry ID.
   * @param {string} path File path.
   * @returns {any} Entry.
   */
  const createPublished = (id, path) => ({ id, locales: { _default: { path, content: {} } } });

  /**
   * Create an unpublished entry for testing.
   * @param {string} id Entry ID.
   * @param {string} path File path.
   * @param {string[]} [previousPaths] Paths the pull request renamed the entry from.
   * @returns {any} Unpublished entry.
   */
  const createDraft = (id, path, previousPaths = []) => ({
    id,
    locales: { _default: { path, content: {} } },
    workflow: { collectionName: 'posts', status: 'draft', previousPaths },
  });

  test('returns the published entries as is without any draft', () => {
    const entries = [createPublished('a', 'content/posts/a.md')];

    expect(mergeUnpublishedEntries(entries, [])).toBe(entries);
  });

  test('replaces a published entry with its pending version', () => {
    const published = createPublished('a', 'content/posts/a.md');
    const draft = createDraft('a-draft', 'content/posts/a.md');
    const result = mergeUnpublishedEntries([published, createPublished('b', 'b.md')], [draft]);

    expect(result.map((/** @type {any} */ { id }) => id)).toEqual(['a-draft', 'b']);
  });

  test('includes a draft that has never been published', () => {
    const published = createPublished('a', 'content/posts/a.md');
    const draft = createDraft('new', 'content/posts/new.md');

    // A new entry isn’t in `allEntries` at all, so it has to be appended
    expect(
      mergeUnpublishedEntries([published], [draft]).map((/** @type {any} */ { id }) => id),
    ).toEqual(['a', 'new']);
  });

  test('lists a renamed entry once, under its pending version', () => {
    const published = createPublished('a', 'content/posts/old.md');
    const draft = createDraft('a-draft', 'content/posts/new.md', ['content/posts/old.md']);

    expect(
      mergeUnpublishedEntries([published], [draft]).map((/** @type {any} */ { id }) => id),
    ).toEqual(['a-draft']);
  });
});

describe('Test canMergePullRequest()', () => {
  const pullRequest = /** @type {any} */ ({ number: 1, branch: 'cms/posts/hello' });

  test('lets the user merge when nothing says otherwise', () => {
    expect(canMergePullRequest(pullRequest)).toBe(true);
    expect(canMergePullRequest({ ...pullRequest, canMerge: true })).toBe(true);
  });

  test('refuses a pull request the user can’t merge', () => {
    expect(canMergePullRequest({ ...pullRequest, canMerge: false })).toBe(false);
  });

  test('refuses every pull request when the user can’t merge into the branch', () => {
    mergeLockedBranch.current = 'main';

    try {
      expect(canMergePullRequest({ ...pullRequest, canMerge: true })).toBe(false);
    } finally {
      mergeLockedBranch.current = undefined;
    }
  });
});

describe('Test isPublishAllowed()', () => {
  const pullRequest = /** @type {any} */ ({ number: 1, branch: 'cms/posts/hello' });
  const collection = /** @type {any} */ ({ name: 'posts' });

  /**
   * Create an unpublished entry at the given status.
   * @param {string} status Workflow status.
   * @param {object} [overrides] Pull request overrides.
   * @returns {any} Entry.
   */
  const createWorkflowEntry = (status, overrides = {}) => ({
    workflow: { status, pullRequest: { ...pullRequest, ...overrides } },
  });

  test('allows publishing a ready entry or carrying out a pending deletion', () => {
    expect(isPublishAllowed(createWorkflowEntry('pending_publish'), collection)).toBe(true);
    expect(isPublishAllowed(createWorkflowEntry('pending_deletion'), collection)).toBe(true);
    expect(isPublishAllowed(createWorkflowEntry('pending_publish'), undefined)).toBe(true);
  });

  test('refuses an entry that hasn’t reached the last stage', () => {
    expect(isPublishAllowed(createWorkflowEntry('draft'), collection)).toBe(false);
    expect(isPublishAllowed(createWorkflowEntry('pending_review'), collection)).toBe(false);
  });

  test('refuses when the collection’s `publish` option is disabled', () => {
    expect(
      isPublishAllowed(createWorkflowEntry('pending_publish'), { ...collection, publish: false }),
    ).toBe(false);
  });

  test('refuses a pull request the user can’t merge', () => {
    expect(
      isPublishAllowed(createWorkflowEntry('pending_publish', { canMerge: false }), collection),
    ).toBe(false);
  });

  test('refuses an Open Authoring contributor', () => {
    forkedRepository.current = { owner: 'me', repo: 'site' };

    try {
      expect(isPublishAllowed(createWorkflowEntry('pending_publish'), collection)).toBe(false);
    } finally {
      forkedRepository.current = undefined;
    }
  });
});
