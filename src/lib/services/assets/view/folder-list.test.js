import { describe, expect, it, vi } from 'vitest';

import { allAssetFolders } from '$lib/services/assets/folders';

import { getAssetFolderIcon, getListedAssetFolders } from './folder-list.js';

vi.mock('$lib/services/assets/folders', () => ({
  allAssetFolders: { current: [] },
}));

vi.mock('$lib/services/contents/collection', () => ({
  getCollection: vi.fn((/** @type {string} */ name) =>
    name === 'posts' ? { icon: 'article' } : name === 'pages' ? {} : undefined,
  ),
  getCollectionIndex: vi.fn((/** @type {string | undefined} */ name) =>
    name === undefined ? -1 : ['posts', 'pages'].indexOf(name),
  ),
}));

vi.mock('$lib/services/contents/collection/files', () => ({
  getCollectionFile: vi.fn((/** @type {any} */ _collection, /** @type {string} */ name) =>
    name === 'home' ? { icon: 'home' } : {},
  ),
  getCollectionFileIndex: vi.fn(
    (
      /** @type {string | undefined} */ _collectionName,
      /** @type {string | undefined} */ fileName,
    ) => (fileName === undefined ? -1 : ['about', 'home'].indexOf(fileName)),
  ),
}));

describe('assets/view/folder-list', () => {
  describe('getListedAssetFolders', () => {
    it('lists the folders in the order of the sidebar, leaving out field-level folders', () => {
      const all = { collectionName: undefined, internalPath: undefined };
      const global = { collectionName: undefined, internalPath: 'static/uploads' };
      const posts = { collectionName: 'posts', internalPath: 'static/posts' };
      const home = { collectionName: 'pages', fileName: 'home', internalPath: 'static/home' };
      const about = { collectionName: 'pages', fileName: 'about', internalPath: 'static/about' };
      const field = { collectionName: 'posts', typedKeyPath: 'image', internalPath: 'x' };
      const photos = { collectionName: 'photos', isAssetCollection: true, internalPath: 'p' };

      allAssetFolders.current = /** @type {any} */ ([
        photos,
        home,
        field,
        posts,
        about,
        global,
        all,
      ]);

      expect(getListedAssetFolders()).toEqual([global, all, posts, about, home, photos]);
    });
  });

  describe('getAssetFolderIcon', () => {
    it('uses the folder’s icon, then the collection file’s, then the collection’s', () => {
      const icon = vi.fn((/** @type {any} */ folder) => getAssetFolderIcon(folder));

      expect(icon({ icon: 'photo', collectionName: 'posts' })).toBe('photo');
      expect(icon({ collectionName: 'pages', fileName: 'home' })).toBe('home');
      expect(icon({ collectionName: 'posts', fileName: 'about' })).toBe('article');
      expect(icon({ collectionName: 'posts' })).toBe('article');
      expect(icon({ collectionName: 'pages', fileName: 'about' })).toBe('folder');
      expect(icon({ collectionName: undefined })).toBe('folder');
      expect(icon({ collectionName: 'missing' })).toBe('folder');
    });
  });
});
