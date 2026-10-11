import { beforeEach, describe, expect, it } from 'vitest';

import {
  allAssets,
  focusedAsset,
  publishedAssets,
  selectedAssetPathSet,
  selectedAssets,
  selectedOrFocusedAssets,
  uploadingAssets,
} from '$lib/services/assets/state';

/**
 * @import { Asset } from '$lib/types/private';
 */

/**
 * Create a test asset.
 * @param {string} path File path.
 * @param {Partial<Asset>} [props] Properties to override.
 * @returns {Asset} Asset.
 */
const createAsset = (path, props = {}) =>
  /** @type {Asset} */ ({ path, name: path.split('/').pop(), sha: path, kind: 'image', ...props });

describe('assets/state', () => {
  beforeEach(() => {
    allAssets.current = [];
    selectedAssets.current = [];
    focusedAsset.current = undefined;
  });

  describe('uploadingAssets', () => {
    it('should start with no folder and no files', () => {
      expect(uploadingAssets.current).toEqual({ folder: undefined, files: [] });
    });
  });

  describe('publishedAssets', () => {
    it('should return the same array when no asset is on a workflow branch', () => {
      const assets = [createAsset('a.jpg'), createAsset('b.jpg')];

      allAssets.current = assets;

      expect(publishedAssets.current).toBe(assets);
    });

    it('should leave out the assets on a workflow branch', () => {
      const published = createAsset('a.jpg');

      allAssets.current = [
        published,
        createAsset('b.jpg', { workflow: /** @type {any} */ ({ branch: 'cms/posts/b' }) }),
      ];

      expect(publishedAssets.current).toEqual([published]);
    });

    it('should update when the asset list is replaced', () => {
      allAssets.current = [createAsset('a.jpg')];
      expect(publishedAssets.current).toHaveLength(1);

      allAssets.current = [];
      expect(publishedAssets.current).toEqual([]);
    });
  });

  describe('selectedAssetPathSet', () => {
    it('should hold the paths of the selected assets', () => {
      selectedAssets.current = [createAsset('a.jpg'), createAsset('dir/b.jpg')];

      expect(selectedAssetPathSet.current).toEqual(new Set(['a.jpg', 'dir/b.jpg']));
      expect(selectedAssetPathSet.current.has('c.jpg')).toBe(false);
    });

    it('should be empty when nothing is selected', () => {
      expect(selectedAssetPathSet.current.size).toBe(0);
    });
  });

  describe('selectedOrFocusedAssets', () => {
    it('should return nothing when no asset is selected or focused', () => {
      expect(selectedOrFocusedAssets.current).toEqual([]);
    });

    it('should return the focused asset when nothing is selected', () => {
      const focused = createAsset('a.jpg');

      focusedAsset.current = focused;

      expect(selectedOrFocusedAssets.current).toEqual([focused]);
    });

    it('should prefer the selected assets over the focused one', () => {
      const selected = [createAsset('b.jpg'), createAsset('c.jpg')];

      focusedAsset.current = createAsset('a.jpg');
      selectedAssets.current = selected;

      expect(selectedOrFocusedAssets.current).toEqual(selected);
      // A copy, so the caller can’t modify the selection through it
      expect(selectedOrFocusedAssets.current).not.toBe(selected);
    });
  });
});
