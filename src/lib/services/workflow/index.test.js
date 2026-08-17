import { get } from 'svelte/store';
import { beforeEach, describe, expect, test } from 'vitest';

import { backend, backendName } from '$lib/services/backends';
import { cmsConfig } from '$lib/services/config';
import { allEntries } from '$lib/services/contents';
import {
  getUnpublishedEntriesByCollection,
  getUnpublishedEntry,
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
    unpublishedEntries.set([]);
    unpublishedEntriesLoaded.set(false);
    allEntries.set([]);
    cmsConfig.set(undefined);
    backendName.set(undefined);
  });

  describe('workflowDataReady', () => {
    test('is true right away when the feature is disabled', () => {
      backendName.set('github');
      cmsConfig.set(/** @type {any} */ ({ publish_mode: 'simple' }));
      expect(get(workflowDataReady)).toBe(true);
    });

    test('waits for the unpublished entries when the feature is enabled', () => {
      backendName.set('github');
      cmsConfig.set(/** @type {any} */ ({ publish_mode: 'editorial_workflow' }));
      expect(get(workflowDataReady)).toBe(false);

      unpublishedEntriesLoaded.set(true);
      expect(get(workflowDataReady)).toBe(true);
    });
  });

  describe('workflowEnabled', () => {
    test('is false without the editorial_workflow publish mode', () => {
      backendName.set('github');
      cmsConfig.set(/** @type {any} */ ({ publish_mode: 'simple' }));
      expect(get(workflowEnabled)).toBe(false);
    });

    test('is false when the backend doesn’t implement the feature', () => {
      backendName.set('gitea');
      cmsConfig.set(/** @type {any} */ ({ publish_mode: 'editorial_workflow' }));
      expect(get(backend)?.workflow).toBeUndefined();
      expect(get(workflowEnabled)).toBe(false);
    });

    test.each(['github', 'gitlab'])(
      'is true with the %s backend and the editorial_workflow publish mode',
      (name) => {
        backendName.set(name);
        cmsConfig.set(/** @type {any} */ ({ publish_mode: 'editorial_workflow' }));
        expect(get(workflowEnabled)).toBe(true);
      },
    );
  });

  describe('getUnpublishedEntriesByCollection', () => {
    test('filters the entries by collection', () => {
      unpublishedEntries.set([
        createEntry({ collectionName: 'posts', subPath: 'a' }),
        createEntry({ collectionName: 'pages', subPath: 'b' }),
      ]);

      expect(getUnpublishedEntriesByCollection('posts')).toHaveLength(1);
      expect(getUnpublishedEntriesByCollection('pages')).toHaveLength(1);
      expect(getUnpublishedEntriesByCollection('other')).toHaveLength(0);
    });

    test('returns an empty array without a collection name', () => {
      unpublishedEntries.set([createEntry({ collectionName: 'posts', subPath: 'a' })]);
      expect(getUnpublishedEntriesByCollection(undefined)).toEqual([]);
    });
  });

  describe('getUnpublishedEntry', () => {
    test('finds the entry by collection name and sub path', () => {
      unpublishedEntries.set([
        createEntry({ collectionName: 'posts', subPath: 'a' }),
        createEntry({ collectionName: 'posts', subPath: 'b' }),
      ]);

      expect(getUnpublishedEntry({ collectionName: 'posts', subPath: 'b' })?.subPath).toBe('b');
      expect(getUnpublishedEntry({ collectionName: 'posts', subPath: 'c' })).toBeUndefined();
      expect(getUnpublishedEntry({ collectionName: 'pages', subPath: 'a' })).toBeUndefined();
    });

    test('finds a collection file by its name rather than its path', () => {
      const entry = createEntry({ collectionName: 'settings', subPath: 'data/site.yml' });

      entry.workflow.fileName = 'site';
      unpublishedEntries.set([entry]);

      // The URL carries the file name, while the entry’s `subPath` is the whole file path
      expect(getUnpublishedEntry({ collectionName: 'settings', subPath: 'site' })).toBe(entry);

      expect(
        getUnpublishedEntry({ collectionName: 'settings', subPath: 'data/site.yml' }),
      ).toBeUndefined();
    });
  });
});

describe('hasPublishedVersion', () => {
  beforeEach(() => {
    allEntries.set([]);
  });

  test('is true when a published entry shares a file path', () => {
    const entry = createEntry({ collectionName: 'posts', subPath: 'hello' });

    allEntries.set([
      /** @type {any} */ ({ id: 'p1', locales: { _default: { path: 'content/posts/hello.md' } } }),
    ]);

    expect(hasPublishedVersion(entry)).toBe(true);
  });

  test('matches the path the entry had before the pull request renamed it', () => {
    const entry = createEntry({ collectionName: 'posts', subPath: 'renamed' });

    entry.workflow.previousPaths = ['content/posts/hello.md'];

    allEntries.set([
      /** @type {any} */ ({ id: 'p1', locales: { _default: { path: 'content/posts/hello.md' } } }),
    ]);

    expect(hasPublishedVersion(entry)).toBe(true);
  });

  test('is false for an entry that has never been published', () => {
    const entry = createEntry({ collectionName: 'posts', subPath: 'hello' });

    allEntries.set([
      /** @type {any} */ ({ id: 'p1', locales: { _default: { path: 'content/posts/other.md' } } }),
    ]);

    expect(hasPublishedVersion(entry)).toBe(false);
    allEntries.set([]);
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

    allEntries.set([
      /** @type {any} */ ({ id: 'p1', locales: { fr: { path: 'content/posts/fr/hello.md' } } }),
    ]);

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
