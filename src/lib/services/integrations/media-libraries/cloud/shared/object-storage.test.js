import { sleep } from '@sveltia/utils/misc';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  assertResponseOK,
  browseObjects,
  createObjectStorageOperations,
  deleteObjects,
  fetchListing,
  getRenamedPath,
  listFolderObjects,
  listObjects,
  replaceObject,
  searchObjects,
  uploadObjects,
} from './object-storage';

/**
 * @import { ExternalAsset } from '$lib/types/private';
 * @import { ObjectStorageProvider } from './object-storage';
 */

vi.mock('@sveltia/utils/misc', () => ({ sleep: vi.fn() }));

/**
 * @typedef {{ key: string }} TestObject
 */

describe('integrations/media-libraries/cloud/shared/object-storage', () => {
  const config = { account_name: 'account', container: 'media', prefix: 'uploads/' };
  const options = { apiKey: 'secret' };
  /** @type {TestObject[][]} */
  let pages;

  /** @type {ObjectStorageProvider<TestObject, typeof config>} */
  const provider = {
    requireCredential: vi.fn(({ apiKey }) => {
      if (!apiKey) {
        throw new Error('Credential is required');
      }

      return apiKey;
    }),
    listPage: vi.fn(async ({ cursor }) => {
      const index = cursor ? Number(cursor) : 0;

      return {
        items: pages[index],
        cursor: index + 1 < pages.length ? String(index + 1) : undefined,
      };
    }),
    /**
     * Get the key of an object.
     * @param {TestObject} object Object.
     * @returns {string} Key.
     */
    getKey: ({ key }) => key,
    parseResults: vi.fn((/** @type {TestObject[]} */ items) =>
      items.map(
        ({ key }) => /** @type {ExternalAsset} */ ({ id: key, fileName: key, description: key }),
      ),
    ),
    putObject: vi.fn(async ({ key }) => ({ key })),
    copyObject: vi.fn(async ({ key }) => ({ key })),
    deleteObject: vi.fn(async () => undefined),
    putFolderObject: vi.fn(async () => undefined),
  };

  beforeEach(() => {
    pages = [
      [
        { key: 'uploads/' },
        { key: 'uploads/photo.jpg' },
        { key: 'uploads/2024/' },
        { key: 'uploads/notes.txt' },
      ],
      [{ key: 'uploads/2024/summer/' }, { key: 'uploads/2024/beach.png' }],
    ];
  });

  describe('fetchListing', () => {
    it('should follow the cursor and split the files from the folder placeholders', async () => {
      const result = await fetchListing(provider, config, options);

      expect(result).toEqual({
        files: [
          { key: 'uploads/photo.jpg' },
          { key: 'uploads/notes.txt' },
          { key: 'uploads/2024/beach.png' },
        ],
        folders: ['2024', '2024/summer'],
        truncated: false,
      });
      expect(provider.listPage).toHaveBeenNthCalledWith(1, {
        config,
        credential: 'secret',
        prefix: 'uploads/',
        cursor: undefined,
      });
      expect(provider.listPage).toHaveBeenNthCalledWith(2, {
        config,
        credential: 'secret',
        prefix: 'uploads/',
        cursor: '1',
      });
      expect(sleep).toHaveBeenCalledTimes(1);
    });

    it('should stop after the maximum number of pages', async () => {
      const result = await fetchListing(provider, config, options, { maxPages: 1 });

      expect(result.files).toHaveLength(2);
      // The objects on the next page are left out, which the caller is told about
      expect(result.truncated).toBe(true);
      expect(provider.listPage).toHaveBeenCalledTimes(1);
    });

    it('should list the objects below the given folder', async () => {
      pages = [[{ key: 'uploads/2024/' }, { key: 'uploads/2024/beach.png' }]];

      const result = await fetchListing(provider, config, options, { dirPath: '2024' });

      expect(result).toEqual({
        files: [{ key: 'uploads/2024/beach.png' }],
        folders: ['2024'],
        truncated: false,
      });
      expect(provider.listPage).toHaveBeenCalledWith({
        config,
        credential: 'secret',
        prefix: 'uploads/2024/',
        cursor: undefined,
      });
    });

    it('should reject when the credential is missing', async () => {
      await expect(fetchListing(provider, config, { apiKey: '' })).rejects.toThrow(
        'Credential is required',
      );
      expect(provider.listPage).not.toHaveBeenCalled();
    });
  });

  describe('listObjects', () => {
    it('should list the files', async () => {
      const assets = await listObjects(provider, config, options);

      expect(assets.map(({ id }) => id)).toEqual([
        'uploads/photo.jpg',
        'uploads/notes.txt',
        'uploads/2024/beach.png',
      ]);
      expect(provider.parseResults).toHaveBeenCalledWith(expect.any(Array), config, 'secret');
    });

    it('should filter the files by kind', async () => {
      const assets = await listObjects(provider, config, { ...options, kind: 'image' });

      expect(assets.map(({ id }) => id)).toEqual(['uploads/photo.jpg', 'uploads/2024/beach.png']);
    });
  });

  describe('browseObjects', () => {
    it('should list the files and the folders', async () => {
      const { assets, folders } = await browseObjects(provider, config, {
        ...options,
        kind: 'image',
      });

      expect(assets).toHaveLength(2);
      expect(folders).toEqual(['2024', '2024/summer']);
    });

    it('should tell whether the listing was cut short', async () => {
      expect((await browseObjects(provider, config, options)).truncated).toBe(false);

      // 11 pages are more than the 10 listed at once
      pages = Array.from({ length: 11 }, (_, index) => [{ key: `uploads/${index}.jpg` }]);

      const { assets, truncated } = await browseObjects(provider, config, options);

      expect(assets).toHaveLength(10);
      expect(truncated).toBe(true);
    });
  });

  describe('listFolderObjects', () => {
    it('should list every file and folder below the folder, past the page limit', async () => {
      // 12 pages are more than the 10 the asset list fetches, yet every one is listed
      pages = [
        [{ key: 'uploads/2024/' }, { key: 'uploads/2024/notes.txt' }],
        ...Array.from({ length: 10 }, (_, index) => [{ key: `uploads/2024/${index}.jpg` }]),
        [{ key: 'uploads/2024/summer/' }, { key: 'uploads/2024/summer/beach.png' }],
      ];

      // The kind filter is ignored, as a folder operation acts on every file
      const { assets, folders } = await listFolderObjects(provider, '2024', config, {
        ...options,
        kind: 'image',
      });

      expect(assets).toHaveLength(12);
      expect(assets.map(({ id }) => id)).toContain('uploads/2024/notes.txt');
      expect(assets.at(-1)?.id).toBe('uploads/2024/summer/beach.png');
      expect(folders).toEqual(['2024', '2024/summer']);
      expect(provider.listPage).toHaveBeenCalledTimes(12);
      expect(provider.listPage).toHaveBeenCalledWith(
        expect.objectContaining({ prefix: 'uploads/2024/' }),
      );
      expect(provider.parseResults).toHaveBeenCalledWith(expect.any(Array), config, 'secret');
    });
  });

  describe('searchObjects', () => {
    it('should filter the files by the query', async () => {
      const assets = await searchObjects(provider, 'beach', config, options);

      expect(assets.map(({ id }) => id)).toEqual(['uploads/2024/beach.png']);
    });
  });

  describe('uploadObjects', () => {
    it('should return an empty array when there is no file', async () => {
      expect(await uploadObjects(provider, [], config, { apiKey: '' })).toEqual([]);
      expect(provider.requireCredential).not.toHaveBeenCalled();
    });

    it('should upload the files to the given folder, one by one', async () => {
      const files = [new File(['a'], 'a.jpg'), new File(['b'], '../../b.jpg')];

      const assets = await uploadObjects(provider, files, config, {
        ...options,
        dirPath: '2024',
      });

      expect(assets.map(({ id }) => id)).toEqual(['uploads/2024/a.jpg', 'uploads/2024/b.jpg']);
      expect(provider.putObject).toHaveBeenNthCalledWith(1, {
        key: 'uploads/2024/a.jpg',
        file: files[0],
        config,
        credential: 'secret',
      });
      expect(sleep).toHaveBeenCalledTimes(2);
    });

    it('should upload a single file to the prefix without waiting', async () => {
      const assets = await uploadObjects(provider, [new File(['a'], 'a.jpg')], config, options);

      expect(assets.map(({ id }) => id)).toEqual(['uploads/a.jpg']);
      expect(sleep).not.toHaveBeenCalled();
    });

    it('should keep a file name that has no segment', async () => {
      const assets = await uploadObjects(provider, [new File(['a'], '/')], config, options);

      expect(assets.map(({ id }) => id)).toEqual(['uploads//']);
    });
  });

  describe('deleteObjects', () => {
    it('should delete the objects one by one', async () => {
      const assets = /** @type {ExternalAsset[]} */ ([{ id: 'uploads/a.jpg' }, { id: 'b.jpg' }]);

      await expect(deleteObjects(provider, assets, config, options)).resolves.toBeUndefined();
      expect(provider.deleteObject).toHaveBeenNthCalledWith(2, {
        key: 'b.jpg',
        config,
        credential: 'secret',
      });
      expect(sleep).toHaveBeenCalledTimes(2);
    });

    it('should not wait after deleting a single object', async () => {
      const assets = /** @type {ExternalAsset[]} */ ([{ id: 'uploads/a.jpg' }]);

      await deleteObjects(provider, assets, config, options);
      expect(sleep).not.toHaveBeenCalled();
    });

    it('should reject when the credential is missing', async () => {
      await expect(deleteObjects(provider, [], config, { apiKey: '' })).rejects.toThrow(
        'Credential is required',
      );
    });
  });

  describe('replaceObject', () => {
    it('should put the file under the same key', async () => {
      const asset = /** @type {ExternalAsset} */ ({ id: 'uploads/a.jpg' });
      const file = new File(['a'], 'new.jpg');

      expect((await replaceObject(provider, asset, file, config, options)).id).toBe(
        'uploads/a.jpg',
      );
      expect(provider.putObject).toHaveBeenCalledWith({
        key: 'uploads/a.jpg',
        file,
        config,
        credential: 'secret',
      });
    });
  });

  describe('getRenamedPath', () => {
    it('should keep the file in its folder, relative to the prefix', () => {
      const asset = /** @type {ExternalAsset} */ ({ id: 'uploads/2024/a.jpg' });

      expect(getRenamedPath(config, asset, 'b.jpg')).toBe('2024/b.jpg');
    });

    it('should keep a file at the prefix root', () => {
      const asset = /** @type {ExternalAsset} */ ({ id: 'uploads/a.jpg' });

      expect(getRenamedPath(config, asset, 'b.jpg')).toBe('b.jpg');
    });
  });

  describe('assertResponseOK', () => {
    it('should resolve when the response is OK', async () => {
      await expect(
        assertResponseOK(new Response('ok', { status: 200 }), 'Failed'),
      ).resolves.toBeUndefined();
    });

    it('should throw with the response body appended to the message', async () => {
      await expect(
        assertResponseOK(new Response('Access Denied', { status: 403 }), 'Failed to list objects'),
      ).rejects.toThrow(new Error('Failed to list objects: Access Denied'));
    });

    it('should throw on a 404 response unless it’s allowed', async () => {
      await expect(
        assertResponseOK(new Response('Not Found', { status: 404 }), 'Failed'),
      ).rejects.toThrow('Failed: Not Found');
      await expect(
        assertResponseOK(new Response('Not Found', { status: 404 }), 'Failed', {
          allowNotFound: true,
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('createObjectStorageOperations', () => {
    const operations = createObjectStorageOperations(provider);

    it('should bind the provider to the shared operations', async () => {
      expect((await operations.list(config, options)).map(({ id }) => id)).toEqual([
        'uploads/photo.jpg',
        'uploads/notes.txt',
        'uploads/2024/beach.png',
      ]);
      expect((await operations.browse(config, options)).folders).toEqual(['2024', '2024/summer']);
      expect((await operations.listFolder('2024', config, options)).folders).toEqual([
        '2024',
        '2024/summer',
      ]);
      expect((await operations.search('beach', config, options)).map(({ id }) => id)).toEqual([
        'uploads/2024/beach.png',
      ]);
      expect(
        await operations.upload([new File(['a'], 'a.jpg')], config, { ...options, dirPath: '' }),
      ).toHaveLength(1);
      await operations.delete([/** @type {ExternalAsset} */ ({ id: 'uploads/a.jpg' })], config, {
        ...options,
      });
      expect(provider.deleteObject).toHaveBeenCalledWith({
        key: 'uploads/a.jpg',
        config,
        credential: 'secret',
      });
      expect(
        (
          await operations.replace(
            /** @type {ExternalAsset} */ ({ id: 'uploads/a.jpg' }),
            new File(['a'], 'new.jpg'),
            config,
            options,
          )
        ).id,
      ).toBe('uploads/a.jpg');
    });

    it('should rename a file by moving it within its folder', async () => {
      const asset = /** @type {ExternalAsset} */ ({ id: 'uploads/2024/a.jpg' });

      expect((await operations.rename(asset, 'b.jpg', config, options)).id).toBe(
        'uploads/2024/b.jpg',
      );
      expect(provider.copyObject).toHaveBeenCalledWith({
        asset,
        key: 'uploads/2024/b.jpg',
        config,
        credential: 'secret',
      });
    });

    it('should move a file by copying it and deleting the source', async () => {
      const asset = /** @type {ExternalAsset} */ ({ id: 'uploads/a.jpg' });

      expect((await operations.move(asset, '2024/a.jpg', config, options)).id).toBe(
        'uploads/2024/a.jpg',
      );
      expect(provider.copyObject).toHaveBeenCalledWith({
        asset,
        key: 'uploads/2024/a.jpg',
        config,
        credential: 'secret',
      });
      expect(provider.deleteObject).toHaveBeenCalledWith({
        key: 'uploads/a.jpg',
        config,
        credential: 'secret',
      });
      expect(provider.parseResults).toHaveBeenLastCalledWith(
        [{ key: 'uploads/2024/a.jpg' }],
        config,
        'secret',
      );
    });

    it('should keep the source when the copy fails', async () => {
      vi.mocked(provider.copyObject).mockRejectedValueOnce(new Error('Failed to copy'));

      await expect(
        operations.move(/** @type {ExternalAsset} */ ({ id: 'uploads/a.jpg' }), 'b.jpg', config, {
          ...options,
        }),
      ).rejects.toThrow('Failed to copy');
      expect(provider.deleteObject).not.toHaveBeenCalled();
    });

    it('should create a folder by putting a placeholder object', async () => {
      await operations.createFolder('2024/summer', config, options);

      expect(provider.putFolderObject).toHaveBeenCalledWith({
        key: 'uploads/2024/summer/',
        config,
        credential: 'secret',
      });
      await expect(operations.createFolder('2024', config, { apiKey: '' })).rejects.toThrow(
        'Credential is required',
      );
    });

    it('should delete the placeholder object of a folder, if any', async () => {
      await operations.deleteFolder('2024/summer', config, options);

      expect(provider.deleteObject).toHaveBeenCalledWith({
        key: 'uploads/2024/summer/',
        config,
        credential: 'secret',
        allowNotFound: true,
      });
      await expect(operations.deleteFolder('2024', config, { apiKey: '' })).rejects.toThrow(
        'Credential is required',
      );
    });
  });
});
