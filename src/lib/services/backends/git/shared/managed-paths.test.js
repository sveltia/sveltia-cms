import { beforeEach, describe, expect, test, vi } from 'vitest';

import { allAssetFolders } from '$lib/services/assets/folders';
import { getManagedPaths } from '$lib/services/backends/git/shared/managed-paths';
import { allEntryFolders } from '$lib/services/contents';

vi.mock('$lib/services/assets/folders', () => ({ allAssetFolders: { current: [] } }));
vi.mock('$lib/services/contents', () => ({ allEntryFolders: { current: [] } }));

/**
 * Set the entry and asset folders.
 * @param {any[]} entryFolders Entry folders.
 * @param {any[]} [assetFolders] Asset folders.
 */
const setFolders = (entryFolders, assetFolders = []) => {
  allEntryFolders.current = entryFolders;
  allAssetFolders.current = assetFolders;
};

describe('backends/git/shared/managed-paths', () => {
  beforeEach(() => {
    setFolders([]);
  });

  test('lists the entry and asset folders, and the files of file collections', () => {
    setFolders(
      [
        { collectionName: 'posts', folderPathMap: { _default: 'content/posts/' } },
        { collectionName: 'pages', filePathMap: { _default: 'data/about.yml' } },
      ],
      [{ internalPath: undefined }, { internalPath: 'static/images' }],
    );

    expect(getManagedPaths()).toEqual({
      dirs: ['content/posts', 'static/images'],
      files: ['data/about.yml'],
    });
  });

  test('lists a folder with a template tag from the part before the tag', () => {
    setFolders(
      [
        { collectionName: 'posts', folderPathMap: { en: 'content/{{locale}}/posts' } },
        // A file path with a tag left in it stands for files in more than one folder
        { collectionName: 'settings', filePathMap: { _default: 'data/{{locale}}/site.yml' } },
      ],
      [{ internalPath: 'static/uploads/{{slug}}' }],
    );

    expect(getManagedPaths()).toEqual({
      dirs: ['content', 'data', 'static/uploads'],
      files: [],
    });
  });

  test('leaves out the folders and files within another folder, or outside the root', () => {
    setFolders(
      [
        { collectionName: 'posts', folderPathMap: { en: 'content/posts', ja: 'content-ja' } },
        { collectionName: 'news', folderPathMap: { _default: 'content/posts/news' } },
        { collectionName: 'home', filePathMap: { en: 'content/home.md', ja: 'content/home.md' } },
        { collectionName: 'theme', filePathMap: { _default: '../theme/config.yml' } },
        { collectionName: 'site', filePathMap: { _default: 'site.yml' } },
      ],
      [{ internalPath: 'content' }, { internalPath: '../shared/images' }],
    );

    expect(getManagedPaths()).toEqual({
      dirs: ['content', 'content-ja'],
      files: ['site.yml'],
    });
  });

  test('gives up when a folder is the root directory itself', () => {
    setFolders(
      [{ collectionName: 'posts', folderPathMap: { _default: 'content/posts' } }],
      [{ internalPath: '' }],
    );

    expect(getManagedPaths()).toBeUndefined();

    // Or when it starts with a template tag
    setFolders([{ collectionName: 'posts', folderPathMap: { en: '{{locale}}/posts' } }]);

    expect(getManagedPaths()).toBeUndefined();
  });

  test('lists nothing without any folder', () => {
    setFolders([{ collectionName: 'posts' }]);

    expect(getManagedPaths()).toEqual({ dirs: [], files: [] });
  });
});
