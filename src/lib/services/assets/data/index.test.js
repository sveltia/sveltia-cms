import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getAssetByInternalPath } from '$lib/services/assets';
import { focusedAsset, overlaidAsset } from '$lib/services/assets/state';
import { UPDATE_TOAST_DEFAULT_STATE } from '$lib/services/contents/collection/data';

import { assetUpdatesToast, refreshFocusedAssets } from '.';

vi.mock('$lib/services/assets', () => ({
  getAssetByInternalPath: vi.fn((/** @type {string} */ path) => ({ path, refreshed: true })),
}));

vi.mock('$lib/services/assets/state', () => ({
  focusedAsset: { current: undefined },
  overlaidAsset: { current: undefined },
}));

describe('assets/data/index', () => {
  describe('assetUpdatesToast', () => {
    it('should initialize with default state', () => {
      const state = assetUpdatesToast.current;

      expect(state).toEqual(UPDATE_TOAST_DEFAULT_STATE);
    });

    it('should be writable', () => {
      const newState = { ...UPDATE_TOAST_DEFAULT_STATE, saved: true, count: 3 };

      assetUpdatesToast.current = newState;

      const state = assetUpdatesToast.current;

      expect(state).toEqual(newState);
    });

    it('should update specific properties', () => {
      assetUpdatesToast.current = { ...assetUpdatesToast.current, deleted: true, count: 2 };

      const state = assetUpdatesToast.current;

      expect(state.deleted).toBe(true);
      expect(state.count).toBe(2);
    });
  });

  describe('refreshFocusedAssets', () => {
    beforeEach(() => {
      focusedAsset.current = undefined;
      overlaidAsset.current = undefined;
    });

    it('should replace the focused and overlaid assets with the ones at the given paths', () => {
      focusedAsset.current = /** @type {any} */ ({ path: 'a.jpg' });
      overlaidAsset.current = /** @type {any} */ ({ path: 'b.jpg' });

      refreshFocusedAssets(({ path }) => `new/${path}`);

      expect(focusedAsset.current).toEqual({ path: 'new/a.jpg', refreshed: true });
      expect(overlaidAsset.current).toEqual({ path: 'new/b.jpg', refreshed: true });
    });

    it('should leave an asset as is when no path is given for it', () => {
      const asset = /** @type {any} */ ({ path: 'a.jpg' });

      focusedAsset.current = asset;

      refreshFocusedAssets(() => undefined);

      expect(focusedAsset.current).toBe(asset);
      expect(getAssetByInternalPath).not.toHaveBeenCalled();
    });

    it('should do nothing when no asset is focused or overlaid', () => {
      const getPath = vi.fn();

      refreshFocusedAssets(getPath);

      expect(getPath).not.toHaveBeenCalled();
      expect(focusedAsset.current).toBeUndefined();
      expect(overlaidAsset.current).toBeUndefined();
    });
  });
});
