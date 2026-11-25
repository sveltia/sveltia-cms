import { describe, expect, test } from 'vitest';

import { getAssetPathMap, getAssetsBySha } from '$lib/services/assets/lookup';
import { allAssets } from '$lib/services/assets/state';

describe('getAssetPathMap()', () => {
  test('should map each asset’s path to the asset, until the asset list is replaced', () => {
    const photo = /** @type {any} */ ({ path: 'static/images/photo.jpg' });
    const logo = /** @type {any} */ ({ path: 'static/images/logo.png' });

    allAssets.current = [photo];

    const map = getAssetPathMap();

    expect(map.get('static/images/photo.jpg')).toBe(photo);
    expect(map.get('static/images/logo.png')).toBeUndefined();
    // Reused while the list stays the same
    expect(getAssetPathMap()).toBe(map);

    allAssets.current = [photo, logo];

    expect(getAssetPathMap().get('static/images/logo.png')).toBe(logo);
  });
});

describe('getAssetsBySha()', () => {
  test('should list the assets with each content in order, until the asset list is replaced', () => {
    const photo = /** @type {any} */ ({ path: 'a/photo.jpg', sha: 's1' });
    const copy = /** @type {any} */ ({ path: 'b/photo.jpg', sha: 's1' });
    const logo = /** @type {any} */ ({ path: 'a/logo.png', sha: 's2' });

    allAssets.current = [photo, logo, copy];

    const map = getAssetsBySha();

    expect(map.get('s1')).toEqual([photo, copy]);
    expect(map.get('s2')).toEqual([logo]);
    expect(map.get('s3')).toBeUndefined();
    // Reused while the list stays the same
    expect(getAssetsBySha()).toBe(map);

    allAssets.current = [logo];

    expect(getAssetsBySha().get('s1')).toBeUndefined();
  });
});
