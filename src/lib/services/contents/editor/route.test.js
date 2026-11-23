import { describe, expect, test } from 'vitest';

import {
  getEntryEditorPath,
  getUnpublishedEntryEditorPath,
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
