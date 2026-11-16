import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getTakenNamesInDir } from '$lib/services/assets';
import { moveAssets } from '$lib/services/assets/data/move';
import { getEntriesUsingTargets } from '$lib/services/assets/references';
import { publishedAssets } from '$lib/services/assets/state';

import {
  getAssetMoveConflicts,
  getAssetsUsedEntries,
  moveAssetsToFolder,
} from './move-to-folder.js';

vi.mock('$lib/services/assets', () => ({
  getTakenNamesInDir: vi.fn(() => []),
}));

vi.mock('$lib/services/assets/data/move', () => ({
  moveAssets: vi.fn(),
}));

vi.mock('$lib/services/assets/folders', () => ({
  canCreateAsset: vi.fn((/** @type {any} */ folder) => !folder.entryRelative && !folder.readonly),
}));

vi.mock('$lib/services/assets/reference-target', () => ({
  getAssetReferenceTarget: vi.fn((/** @type {any} */ asset) => ({ url: `/${asset.name}` })),
}));

vi.mock('$lib/services/assets/references', () => ({
  getEntriesUsingTargets: vi.fn(),
}));

vi.mock('$lib/services/assets/reserved', () => ({
  isCmsFolderPath: vi.fn((/** @type {string} */ path) =>
    /^static\/(?:uploads\/)?admin\b/.test(path),
  ),
}));

vi.mock('$lib/services/assets/state', () => ({
  publishedAssets: { current: [] },
}));

// List the immediate subfolders off the asset paths, as the real function does
const globalFolder = /** @type {any} */ ({
  internalPath: 'static/uploads',
  publicPath: '/uploads',
});

const projects = /** @type {any} */ ({ internalPath: 'static/projects', publicPath: '/projects' });
/**
 * Create an asset.
 * @param {string} path Path.
 * @param {any} folder Folder.
 * @returns {any} Asset.
 */
const createAsset = (path, folder) => ({ path, name: path.split('/').pop(), folder });

describe('assets/data/move-to-folder', () => {
  beforeEach(() => {
    /** @type {any} */ (publishedAssets).current = [];
    vi.mocked(getTakenNamesInDir).mockReturnValue([]);
  });

  describe('getAssetsUsedEntries', () => {
    it('finds the entries by what the references to the assets are matched by', async () => {
      const a = createAsset('static/uploads/a.png', globalFolder);
      const b = createAsset('static/uploads/b.png', globalFolder);
      const one = /** @type {any} */ ({ id: 'one' });
      const two = /** @type {any} */ ({ id: 'two' });

      vi.mocked(getEntriesUsingTargets).mockResolvedValue([one, two]);

      expect(await getAssetsUsedEntries([a, b])).toEqual([one, two]);
      expect(getEntriesUsingTargets).toHaveBeenCalledWith([{ url: '/a.png' }, { url: '/b.png' }]);
    });
  });

  describe('getAssetMoveConflicts', () => {
    it('reports the names taken in the directory and those shared by the moving assets', () => {
      vi.mocked(getTakenNamesInDir).mockReturnValue(['taken.png', 'é.png']);

      const assets = [
        createAsset('static/uploads/taken.png', globalFolder),
        // Normalized before being compared
        createAsset('static/uploads/é.png', globalFolder),
        createAsset('static/uploads/2024/same.png', globalFolder),
        createAsset('static/uploads/2025/same.png', globalFolder),
        createAsset('static/uploads/free.png', globalFolder),
        // Already in the directory, so not moved
        createAsset('static/projects/here.png', projects),
      ];

      expect(getAssetMoveConflicts({ assets, dirPath: 'static/projects' })).toEqual([
        'taken.png',
        'é.png',
        'same.png',
      ]);
      expect(getTakenNamesInDir).toHaveBeenCalledWith('static/projects');
    });

    it('reports nothing when the names are free', () => {
      const assets = [createAsset('static/uploads/a.png', globalFolder)];

      expect(getAssetMoveConflicts({ assets, dirPath: 'static/projects' })).toEqual([]);
    });
  });

  describe('moveAssetsToFolder', () => {
    it('moves the assets not in the directory yet, with the folder', async () => {
      const a = createAsset('static/uploads/a.png', globalFolder);
      const here = createAsset('static/projects/here.png', projects);

      await moveAssetsToFolder({ assets: [a, here], folder: projects, dirPath: 'static/projects' });

      expect(moveAssets).toHaveBeenCalledWith('move', [
        { asset: a, path: 'static/projects/a.png', folder: projects },
      ]);
    });

    it('does nothing when every asset is in the directory already', async () => {
      const here = createAsset('static/projects/here.png', projects);

      await moveAssetsToFolder({ assets: [here], folder: projects, dirPath: 'static/projects' });

      expect(moveAssets).not.toHaveBeenCalled();
    });

    it('refuses to overwrite a file', async () => {
      vi.mocked(getTakenNamesInDir).mockReturnValue(['a.png']);

      const a = createAsset('static/uploads/a.png', globalFolder);

      await expect(
        moveAssetsToFolder({ assets: [a], folder: projects, dirPath: 'static/projects' }),
      ).rejects.toThrow('These files already exist in the folder: a.png');
      expect(moveAssets).not.toHaveBeenCalled();
    });
  });
});
