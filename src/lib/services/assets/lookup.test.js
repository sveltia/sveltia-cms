import { describe, expect, test } from 'vitest';

import { getAssetPathMap } from '$lib/services/assets/lookup';
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
