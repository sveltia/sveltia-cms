import { describe, expect, test } from 'vitest';

import {
  getEntryEditorPath,
  getEntryEditorReturnTo,
  getUnpublishedEntryEditorPath,
  isEntryEditorPath,
} from '$lib/services/contents/editor/route';

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
    expect(isEntryEditorPath('/collections/newsletters')).toBe(false);
    expect(isEntryEditorPath('/assets')).toBe(false);
  });
});

describe('getEntryEditorReturnTo()', () => {
  test('returns an entry to the search results it was opened from', () => {
    const returnTo = getEntryEditorReturnTo('posts');

    expect(returnTo('/search/hello')).toBe(true);
    expect(returnTo('/collections/pages')).toBe(false);
    expect(returnTo('/workflow')).toBe(false);
  });

  test('returns a singleton to any page other than an editor', () => {
    const returnTo = getEntryEditorReturnTo('_singletons');

    expect(returnTo('/search/hello')).toBe(true);
    expect(returnTo('/collections/pages')).toBe(true);
    expect(returnTo('/collections/docs/filter/guides')).toBe(true);
    expect(returnTo('/assets/images')).toBe(true);
    expect(returnTo('/workflow')).toBe(true);
    expect(returnTo('/collections/posts/entries/hello')).toBe(false);
    expect(returnTo('/collections/posts/new')).toBe(false);
  });

  test('returns an entry of an unknown collection to the search results only', () => {
    expect(getEntryEditorReturnTo(undefined)('/collections/pages')).toBe(false);
  });
});
