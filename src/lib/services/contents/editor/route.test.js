import { describe, expect, test } from 'vitest';

import {
  CONTENTS_ROUTE_REGEX,
  getCollectionPath,
  getEntryEditorBackTarget,
  getEntryEditorPath,
  getNewEntryPath,
  getUnpublishedEntryEditorPath,
  isEntryEditorPath,
  parseContentsPath,
} from '$lib/services/contents/editor/route';

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

describe('getEntryEditorPath()', () => {
  test('builds the path of an entry’s editor, encoding each segment', () => {
    expect(getEntryEditorPath('posts', '2024/hello-world')).toBe(
      '/collections/posts/entries/2024/hello-world',
    );
    expect(getEntryEditorPath('_singletons', 'about')).toBe(
      '/collections/_singletons/entries/about',
    );
    expect(getEntryEditorPath('pages', '50%off #1')).toBe(
      '/collections/pages/entries/50%25off%20%231',
    );
  });

  test('names the pull request from a fork to open the entry from', () => {
    expect(getEntryEditorPath('posts', 'hello', { pullRequestNumber: 7 })).toBe(
      '/collections/posts/entries/hello?_pr=7',
    );
    expect(getEntryEditorPath('posts', 'hello', { pullRequestNumber: undefined })).toBe(
      '/collections/posts/entries/hello',
    );
  });
});

describe('getUnpublishedEntryEditorPath()', () => {
  /**
   * Create an unpublished entry.
   * @param {Record<string, any>} workflow Workflow properties.
   * @returns {any} Entry.
   */
  const createEntry = (workflow) => ({ subPath: '2024/hello', workflow });

  test('opens an entry of the maintainers’ own pull request like any other', () => {
    expect(
      getUnpublishedEntryEditorPath(
        createEntry({ collectionName: 'posts', pullRequest: { number: 1, branch: 'cms/posts/x' } }),
      ),
    ).toBe('/collections/posts/entries/2024/hello');
  });

  test('opens a collection file by its name', () => {
    expect(
      getUnpublishedEntryEditorPath(
        createEntry({ collectionName: 'pages', fileName: 'about', pullRequest: { number: 1 } }),
      ),
    ).toBe('/collections/pages/entries/about');
  });

  test('names the pull request of an entry from a contributor’s fork', () => {
    expect(
      getUnpublishedEntryEditorPath(
        createEntry({
          collectionName: 'posts',
          pullRequest: { number: 7, fork: { owner: 'alice', repo: 'website', editable: true } },
        }),
      ),
    ).toBe('/collections/posts/entries/2024/hello?_pr=7');
  });
});

describe('isEntryEditorPath()', () => {
  test('tells the editor of an existing or new entry from other pages', () => {
    expect(isEntryEditorPath('/collections/posts/entries/2024/hello')).toBe(true);
    expect(isEntryEditorPath('/collections/_singletons/entries/team')).toBe(true);
    expect(isEntryEditorPath('/collections/posts/new')).toBe(true);
    expect(isEntryEditorPath('/collections/posts')).toBe(false);
    expect(isEntryEditorPath('/collections/posts/entries')).toBe(false);
    expect(isEntryEditorPath('/collections/posts/filter/new')).toBe(false);
    expect(isEntryEditorPath('/collections/posts/new/extra')).toBe(false);
    expect(isEntryEditorPath('/collections/newsletters')).toBe(false);
    expect(isEntryEditorPath('/assets')).toBe(false);
  });
});

describe('getEntryEditorBackTarget()', () => {
  test('goes back to the collection’s entry list, or the search results', () => {
    const { path, returnTo } = getEntryEditorBackTarget({ collectionName: 'posts' });

    expect(path).toBe('/collections/posts');
    expect(getEntryEditorBackTarget({ collectionName: 'posts', dirPath: '' }).path).toBe(
      '/collections/posts',
    );
    expect(returnTo('/search/hello')).toBe(true);
    expect(returnTo('/collections/pages')).toBe(false);
    expect(returnTo('/workflow')).toBe(false);
  });

  test('goes back to the folder being browsed in a collection with nested entries, encoded', () => {
    expect(
      getEntryEditorBackTarget({ collectionName: 'docs', dirPath: 'guides/getting started' }).path,
    ).toBe('/collections/docs/filter/guides/getting%20started');
  });

  test('goes back from a singleton to any page other than an editor', () => {
    const { path, returnTo } = getEntryEditorBackTarget({
      collectionName: '_singletons',
      dirPath: 'a',
    });

    expect(path).toBe('/collections');
    expect(returnTo('/search/hello')).toBe(true);
    expect(returnTo('/collections/pages')).toBe(true);
    expect(returnTo('/collections/docs/filter/guides')).toBe(true);
    expect(returnTo('/assets/images')).toBe(true);
    expect(returnTo('/workflow')).toBe(true);
    expect(returnTo('/collections/posts/entries/hello')).toBe(false);
    expect(returnTo('/collections/posts/new')).toBe(false);
  });
});

describe('getCollectionPath()', () => {
  test('builds the path of a collection or a folder in it, encoding each segment', () => {
    expect(getCollectionPath('posts')).toBe('/collections/posts');
    expect(getCollectionPath('news#1')).toBe('/collections/news%231');
    expect(getCollectionPath('docs', { dirPath: 'guides/getting started' })).toBe(
      '/collections/docs/filter/guides/getting%20started',
    );
  });
});

describe('getNewEntryPath()', () => {
  test('builds the path of a new entry’s editor, with the folder to create it in', () => {
    expect(getNewEntryPath('posts')).toBe('/collections/posts/new');
    expect(getNewEntryPath('news#1')).toBe('/collections/news%231/new');
    expect(getNewEntryPath('docs', { dirPath: 'guides/getting started' })).toBe(
      '/collections/docs/new?path=guides/getting%20started',
    );
  });
});

describe('parseContentsPath()', () => {
  test('tells what each route shows', () => {
    expect(parseContentsPath('/collections')).toEqual({
      view: 'index',
      collectionName: undefined,
      routeType: undefined,
      subPath: undefined,
    });
    expect(parseContentsPath('/collections/posts')).toMatchObject({
      view: 'list',
      collectionName: 'posts',
    });
    expect(parseContentsPath('/collections/docs/filter/guides')).toMatchObject({
      view: 'folder',
      collectionName: 'docs',
      subPath: 'guides',
    });
    expect(parseContentsPath('/collections/posts/new')).toMatchObject({ view: 'new' });
    expect(parseContentsPath('/collections/posts/entries/2024/hello')).toMatchObject({
      view: 'entry',
      subPath: '2024/hello',
    });
  });

  test('marks any other path under a collection as invalid, keeping its route type', () => {
    expect(parseContentsPath('/collections/posts/foo')).toMatchObject({
      view: 'invalid',
      routeType: undefined,
    });
    expect(parseContentsPath('/collections/posts/new/foo')).toMatchObject({
      view: 'invalid',
      routeType: 'new',
    });
    expect(parseContentsPath('/collections/posts/entries')).toMatchObject({
      view: 'invalid',
      routeType: 'entries',
    });
  });

  test('gives nothing for another page', () => {
    expect(parseContentsPath('/assets')).toBeUndefined();
  });
});
