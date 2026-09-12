// @vitest-environment jsdom

import { _ } from '@sveltia/i18n';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { announcedPageStatus, goto, parseLocation } from '$lib/services/app/navigation';
import {
  getCollection,
  getCollectionLabel,
  getFirstCollection,
  getSingletonCollection,
  getValidCollections,
  selectedCollection,
} from '$lib/services/contents/collection';
import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
import {
  getCollectionFileEntry,
  getCollectionFileLabel,
} from '$lib/services/contents/collection/files';
import {
  getMetaPathConfig,
  isNestedFolder,
  nestedFilterPath,
} from '$lib/services/contents/collection/nested';
import { createDraft } from '$lib/services/contents/draft/create';
import { showContentOverlay } from '$lib/services/contents/editor';
import { getEntrySummary } from '$lib/services/contents/entry/summary';
import { CONTENTS_ROUTE_REGEX, resolveContentsRoute } from '$lib/services/contents/navigation';
import { isSearchRoute } from '$lib/services/search/navigation';
import { env } from '$lib/services/user/env.svelte';
import {
  getUnpublishedEntriesByCollection,
  getUnpublishedEntry,
  mergeUnpublishedEntries,
  workflowDataReady,
} from '$lib/services/workflow';

vi.mock('@sveltia/i18n', () => ({ _: vi.fn(), locale: { current: 'en' } }));

vi.mock('$lib/services/app/navigation', () => ({
  announcedPageStatus: { current: '' },
  goto: vi.fn(),
  parseLocation: vi.fn(),
}));

vi.mock('$lib/services/contents/collection', () => ({
  getCollection: vi.fn(),
  getCollectionLabel: vi.fn(),
  getFirstCollection: vi.fn(),
  getSingletonCollection: vi.fn(),
  getValidCollections: vi.fn(),
  selectedCollection: { current: undefined },
}));

vi.mock('$lib/services/contents/collection/data', () => ({}));
vi.mock('$lib/services/contents/collection/entries', () => ({ getEntriesByCollection: vi.fn() }));

vi.mock('$lib/services/contents/collection/files', () => ({
  getCollectionFileEntry: vi.fn(),
  getCollectionFileLabel: vi.fn(),
}));

vi.mock('$lib/services/contents/collection/nested', () => ({
  getMetaPathConfig: vi.fn(),
  isNestedFolder: vi.fn(),
  nestedFilterPath: { current: '' },
}));

vi.mock('$lib/services/contents/collection/view', () => ({ listedEntries: { current: [] } }));
vi.mock('$lib/services/contents/draft/create', () => ({ createDraft: vi.fn() }));
vi.mock('$lib/services/contents/editor', () => ({ showContentOverlay: { current: false } }));
vi.mock('$lib/services/contents/entry/summary', () => ({ getEntrySummary: vi.fn() }));
vi.mock('$lib/services/search/navigation', () => ({ isSearchRoute: vi.fn() }));
vi.mock('$lib/services/user/env.svelte', () => ({ env: { isSmallScreen: false } }));

vi.mock('$lib/services/workflow', () => ({
  getUnpublishedEntriesByCollection: vi.fn(),
  getUnpublishedEntry: vi.fn(),
  mergeUnpublishedEntries: vi.fn(),
  workflowDataReady: { current: true },
}));

const posts = /** @type {any} */ ({ name: 'posts', label: 'Posts', _type: 'entry' });
const pages = /** @type {any} */ ({ name: 'pages', label: 'Pages', _type: 'entry' });
const hidden = /** @type {any} */ ({ name: 'secret', _type: 'entry', hide: true });

const general = /** @type {any} */ ({
  name: 'general',
  label: 'General',
  _i18n: { initialLocales: ['en', 'fr'] },
});

const settings = /** @type {any} */ ({
  name: 'settings',
  label: 'Settings',
  _type: 'file',
  _fileMap: { general },
});

const initial = {
  isIndexPage: false,
  isSearchPage: false,
  notFoundKey: '',
  awaitingDrafts: false,
  editorLocale: undefined,
};

/** @type {any} */
let entryDraft;

/**
 * Point the router at the given path.
 * @param {string} path Path.
 * @param {Record<string, string>} [params] Query params.
 */
const visit = (path, params = {}) => {
  vi.mocked(parseLocation).mockReturnValue({ path, params });
};

/**
 * Resolve the current route.
 * @returns {import('$lib/services/contents/navigation').ContentsRouteState} State.
 */
const resolve = () => resolveContentsRoute({ entryDraft });

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(_).mockImplementation((key) => /** @type {string} */ (key));
  vi.mocked(getCollectionLabel).mockImplementation((c) => c.label ?? c.name);
  vi.mocked(getCollectionFileLabel).mockImplementation((f) => f.label ?? f.name);
  vi.mocked(getEntrySummary).mockReturnValue('Summary');
  vi.mocked(getUnpublishedEntriesByCollection).mockReturnValue([]);
  vi.mocked(mergeUnpublishedEntries).mockImplementation((a) => a);
  entryDraft = { current: null };
  selectedCollection.current = undefined;
  showContentOverlay.current = false;
  announcedPageStatus.current = '';
  nestedFilterPath.current = '';
  /** @type {any} */ (workflowDataReady).current = true;
  env.isSmallScreen = false;
  vi.mocked(getCollection).mockImplementation(
    (name) => ({ posts, pages, secret: hidden, settings })[name],
  );
  vi.mocked(getValidCollections).mockReturnValue([]);
  vi.mocked(isNestedFolder).mockReturnValue(true);
  vi.mocked(getEntriesByCollection).mockReturnValue([]);
  vi.mocked(isSearchRoute).mockReturnValue(false);
  window.history.replaceState(null, '');
});

describe('CONTENTS_ROUTE_REGEX', () => {
  test('parses the routes', () => {
    expect('/collections'.match(CONTENTS_ROUTE_REGEX)?.groups).toEqual({
      _collectionName: undefined,
      routeType: undefined,
      subPath: undefined,
    });
    expect('/collections/posts/entries/hello-world'.match(CONTENTS_ROUTE_REGEX)?.groups).toEqual({
      _collectionName: 'posts',
      routeType: 'entries',
      subPath: 'hello-world',
    });
    expect('/collections/posts/filter/2026/09'.match(CONTENTS_ROUTE_REGEX)?.groups).toMatchObject({
      routeType: 'filter',
      subPath: '2026/09',
    });
    expect('/assets'.match(CONTENTS_ROUTE_REGEX)).toBeNull();
  });
});

describe('resolveContentsRoute()', () => {
  test('reads the editor locale from the params and drops it', () => {
    const params = { _locale: 'fr' };

    visit('/collections/posts', params);

    expect(resolve().editorLocale).toBe('fr');
    expect(params).toEqual({});
  });

  test('drops the singletons pseudo-collection when there are real ones', () => {
    selectedCollection.current = /** @type {any} */ ({ name: '_singletons' });
    vi.mocked(getValidCollections).mockReturnValue([posts]);
    visit('/assets');

    resolve();

    expect(selectedCollection.current).toBeUndefined();
  });

  test('passes a different page through, closing the editor', () => {
    showContentOverlay.current = true;
    visit('/assets');

    expect(resolve()).toEqual(initial);
    expect(showContentOverlay.current).toBe(false);
  });

  test('shows the search results', () => {
    vi.mocked(isSearchRoute).mockReturnValue(true);
    visit('/search/hello');

    expect(resolve()).toEqual({ ...initial, isSearchPage: true });
    expect(isSearchRoute).toHaveBeenCalledWith('/search/hello');
  });

  describe('collection list', () => {
    test('shows the list alone on a small screen', () => {
      env.isSmallScreen = true;
      selectedCollection.current = posts;
      showContentOverlay.current = true;
      visit('/collections');

      expect(resolve()).toEqual({ ...initial, isIndexPage: true });
      expect(selectedCollection.current).toBeUndefined();
      expect(showContentOverlay.current).toBe(false);
      expect(announcedPageStatus.current).toBe('viewing_collection_list');
    });

    test('redirects to the selected collection', () => {
      selectedCollection.current = pages;
      visit('/collections');

      expect(resolve()).toEqual(initial);
      expect(goto).toHaveBeenCalledWith('/collections/pages', { replaceState: true });
    });

    test('redirects to the first collection', () => {
      vi.mocked(getFirstCollection).mockReturnValue(posts);
      visit('/collections');

      resolve();

      expect(goto).toHaveBeenCalledWith('/collections/posts', { replaceState: true });
    });

    test('redirects to the singleton collection', () => {
      vi.mocked(getSingletonCollection).mockReturnValue(
        /** @type {any} */ ({ name: '_singletons' }),
      );
      visit('/collections');

      resolve();

      expect(goto).toHaveBeenCalledWith('/collections/_singletons', { replaceState: true });
    });
  });

  describe('collection', () => {
    test('selects the collection and resets the folder being browsed', () => {
      selectedCollection.current = pages;
      nestedFilterPath.current = 'old';
      visit('/collections/posts');

      expect(resolve()).toEqual(initial);
      expect(selectedCollection.current).toBe(posts);
      expect(nestedFilterPath.current).toBe('');
      expect(showContentOverlay.current).toBe(false);
      expect(announcedPageStatus.current).toBe('viewing_x_collection');
    });

    test('keeps the collection selected', () => {
      selectedCollection.current = posts;
      visit('/collections/posts');

      resolve();

      expect(selectedCollection.current).toBe(posts);
    });

    test('reports an unknown or hidden collection', () => {
      selectedCollection.current = posts;
      visit('/collections/nope');

      expect(resolve()).toEqual({ ...initial, notFoundKey: 'collection_not_found' });
      expect(selectedCollection.current).toBeUndefined();
      expect(announcedPageStatus.current).toBe('collection_not_found');

      visit('/collections/secret');

      expect(resolve()).toEqual({ ...initial, notFoundKey: 'collection_not_found' });
    });

    test('reports a dead link under the collection', () => {
      visit('/collections/posts/foo/ever');

      expect(resolve()).toEqual({ ...initial, notFoundKey: 'page_not_found' });
      expect(announcedPageStatus.current).toBe('page_not_found');
    });
  });

  describe('nested folder', () => {
    test('browses an existing folder', () => {
      visit('/collections/posts/filter/2026/09');

      expect(resolve()).toEqual(initial);
      expect(nestedFilterPath.current).toBe('2026/09');
      expect(isNestedFolder).toHaveBeenCalledWith(
        expect.objectContaining({ collection: posts, dirPath: '2026/09' }),
      );
    });

    test('browses the root folder without a path', () => {
      nestedFilterPath.current = 'old';
      visit('/collections/posts/filter');

      expect(resolve()).toEqual(initial);
      expect(nestedFilterPath.current).toBe('');
    });

    test('waits for the drafts before giving up on a missing folder', () => {
      vi.mocked(isNestedFolder).mockReturnValue(false);
      /** @type {any} */ (workflowDataReady).current = false;
      visit('/collections/posts/filter/2026');

      expect(resolve()).toEqual({ ...initial, awaitingDrafts: true });
      expect(announcedPageStatus.current).toBe('loading');
    });

    test('reports a missing folder once the drafts are in', () => {
      vi.mocked(isNestedFolder).mockReturnValue(false);
      visit('/collections/posts/filter');

      expect(resolve()).toEqual({ ...initial, notFoundKey: 'page_not_found' });
      expect(isNestedFolder).toHaveBeenCalledWith(expect.objectContaining({ dirPath: '' }));
    });
  });

  describe('entry collection editor', () => {
    test('waits for the drafts before opening a deep-linked entry', () => {
      /** @type {any} */ (workflowDataReady).current = false;
      visit('/collections/posts/entries/hello');

      expect(resolve()).toEqual({ ...initial, awaitingDrafts: true });
      expect(showContentOverlay.current).toBe(true);
      expect(announcedPageStatus.current).toBe('loading_entries');
      expect(createDraft).not.toHaveBeenCalled();
    });

    test('creates a new entry with the query params as dynamic values', () => {
      visit('/collections/posts/new', { title: 'Hi', path: 'sub' });

      expect(resolve()).toEqual(initial);
      expect(showContentOverlay.current).toBe(true);
      expect(createDraft).toHaveBeenCalledWith({
        entryDraft,
        collection: posts,
        dynamicValues: { title: 'Hi', path: 'sub' },
        initialPath: undefined,
        isIndexFile: false,
      });
      expect(announcedPageStatus.current).toBe('create_entry_announcement');
    });

    test('creates a new entry in the folder given as `path` in a nested collection', () => {
      vi.mocked(getMetaPathConfig).mockReturnValue(/** @type {any} */ ({}));
      window.history.replaceState({ index: true }, '');
      visit('/collections/posts/new', { path: 'sub' });

      resolve();

      expect(createDraft).toHaveBeenCalledWith({
        entryDraft,
        collection: posts,
        dynamicValues: {},
        initialPath: 'sub',
        isIndexFile: true,
      });
    });

    test('opens an existing entry', () => {
      const entry = /** @type {any} */ ({ subPath: 'hello' });

      vi.mocked(getEntriesByCollection).mockReturnValue([entry]);
      visit('/collections/posts/entries/hello');

      expect(resolve()).toEqual(initial);
      expect(createDraft).toHaveBeenCalledWith({
        entryDraft,
        collection: posts,
        originalEntry: entry,
      });
      expect(announcedPageStatus.current).toBe('edit_entry_announcement');
    });

    test('prefers the unpublished version of an entry', () => {
      const entry = /** @type {any} */ ({ subPath: 'hello' });
      const draft = /** @type {any} */ ({ subPath: 'hello', workflow: {} });

      vi.mocked(getEntriesByCollection).mockReturnValue([entry]);
      vi.mocked(getUnpublishedEntry).mockReturnValue(draft);
      visit('/collections/posts/entries/hello');

      resolve();

      expect(createDraft).toHaveBeenCalledWith(expect.objectContaining({ originalEntry: draft }));
    });

    test('waits for the app locale before opening an entry', async () => {
      const i18n = await import('@sveltia/i18n');
      const entry = /** @type {any} */ ({ subPath: 'hello' });

      vi.mocked(getEntriesByCollection).mockReturnValue([entry]);
      /** @type {any} */ (i18n.locale).current = '';
      visit('/collections/posts/entries/hello');

      expect(resolve()).toEqual(initial);
      expect(createDraft).not.toHaveBeenCalled();
      /** @type {any} */ (i18n.locale).current = 'en';
    });

    test('reports a missing entry', () => {
      entryDraft.current = {};
      visit('/collections/posts/entries/nope');

      expect(resolve()).toEqual(initial);
      expect(entryDraft.current).toBeUndefined();
      expect(announcedPageStatus.current).toBe('entry_not_found');
    });

    test('reports a malformed editor route', () => {
      entryDraft.current = {};
      visit('/collections/posts/new/foo');

      expect(resolve()).toEqual(initial);
      expect(entryDraft.current).toBeUndefined();
      expect(announcedPageStatus.current).toBe('entry_not_found');

      visit('/collections/posts/entries');

      resolve();

      expect(createDraft).not.toHaveBeenCalled();
    });
  });

  describe('file collection editor', () => {
    test('opens an existing file', () => {
      const entry = /** @type {any} */ ({ slug: 'general' });

      vi.mocked(getCollectionFileEntry).mockReturnValue(entry);
      visit('/collections/settings/entries/general');

      expect(resolve()).toEqual(initial);
      expect(showContentOverlay.current).toBe(true);
      expect(createDraft).toHaveBeenCalledWith({
        entryDraft,
        collection: settings,
        collectionFile: general,
        originalEntry: entry,
      });
      expect(announcedPageStatus.current).toBe('edit_file_announcement');
    });

    test('prefers the unpublished version of a file', () => {
      const draft = /** @type {any} */ ({ slug: 'general', workflow: {} });

      vi.mocked(getUnpublishedEntry).mockReturnValue(draft);
      vi.mocked(getCollectionFileEntry).mockReturnValue(/** @type {any} */ ({ slug: 'x' }));
      visit('/collections/settings/entries/general');

      resolve();

      expect(createDraft).toHaveBeenCalledWith(expect.objectContaining({ originalEntry: draft }));
    });

    test('starts a file that hasn’t been created yet', () => {
      visit('/collections/settings/entries/general');

      resolve();

      expect(createDraft).toHaveBeenCalledWith({
        entryDraft,
        collection: settings,
        collectionFile: general,
        originalEntry: { slug: 'general', locales: { en: {}, fr: {} } },
      });
    });

    test('reports a file that isn’t part of the collection', () => {
      entryDraft.current = {};
      visit('/collections/settings/entries/nope');

      expect(resolve()).toEqual(initial);
      expect(entryDraft.current).toBeUndefined();
      expect(announcedPageStatus.current).toBe('file_not_found');
      expect(createDraft).not.toHaveBeenCalled();
    });

    test('reports a route a file collection doesn’t have', () => {
      entryDraft.current = {};
      visit('/collections/settings/new');

      expect(resolve()).toEqual(initial);
      expect(entryDraft.current).toBeUndefined();
      expect(announcedPageStatus.current).toBe('file_not_found');
    });
  });
});
