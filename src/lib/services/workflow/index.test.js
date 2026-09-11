import { beforeEach, describe, expect, test } from 'vitest';

import { backend, backendName } from '$lib/services/backends';
import { cmsConfig } from '$lib/services/config';
import { allEntries } from '$lib/services/contents';
import {
  getUnpublishedEntriesByCollection,
  getUnpublishedEntry,
  getUnpublishedEntryBySlug,
  hasPublishedVersion,
  mergeUnpublishedEntries,
  unpublishedEntries,
  unpublishedEntriesLoaded,
  workflowDataReady,
  workflowEnabled,
} from '$lib/services/workflow';

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
      backendName.current = 'gitea';
      cmsConfig.current = /** @type {any} */ ({ publish_mode: 'editorial_workflow' });
      expect(backend.current?.workflow).toBeUndefined();
      expect(workflowEnabled.current).toBe(false);
    });

    test.each(['github', 'gitlab'])(
      'is true with the %s backend and the editorial_workflow publish mode',
      (name) => {
        backendName.current = name;
        cmsConfig.current = /** @type {any} */ ({ publish_mode: 'editorial_workflow' });
        expect(workflowEnabled.current).toBe(true);
      },
    );
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
    test('finds the entry by the branch opened for it', () => {
      const entry = createEntry({ collectionName: 'posts', subPath: 'hello' });

      // The branch keeps the slug the entry had when the pull request was opened
      entry.slug = 'renamed';
      entry.subPath = 'renamed';
      unpublishedEntries.current = [entry];

      expect(getUnpublishedEntryBySlug({ collectionName: 'posts', slug: 'hello' })).toBe(entry);
      expect(
        getUnpublishedEntryBySlug({ collectionName: 'posts', slug: 'renamed' }),
      ).toBeUndefined();
      expect(getUnpublishedEntryBySlug({ collectionName: 'pages', slug: 'hello' })).toBeUndefined();
    });

    test('finds a nested entry whether or not its branch encodes the slashes', () => {
      const encoded = createEntry({ collectionName: 'pages', subPath: 'about/ethos' });
      const legacy = createEntry({ collectionName: 'pages', subPath: 'about/team' });

      encoded.workflow.pullRequest.branch = 'cms/pages/about%2Fethos';
      unpublishedEntries.current = [encoded, legacy];

      expect(getUnpublishedEntryBySlug({ collectionName: 'pages', slug: 'about/ethos' })).toBe(
        encoded,
      );
      expect(getUnpublishedEntryBySlug({ collectionName: 'pages', slug: 'about/team' })).toBe(
        legacy,
      );
      expect(getUnpublishedEntryBySlug({ collectionName: 'pages', slug: 'about' })).toBeUndefined();
    });
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
