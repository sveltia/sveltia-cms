import { beforeEach, describe, expect, test, vi } from 'vitest';

import { getAssetReferenceTarget } from '$lib/services/assets/reference-target';

const { mockGetAssetPublicURL } = vi.hoisted(() => ({ mockGetAssetPublicURL: vi.fn() }));

vi.mock('$lib/services/assets/info', () => ({ getAssetPublicURL: mockGetAssetPublicURL }));

describe('getAssetReferenceTarget', () => {
  beforeEach(() => {
    mockGetAssetPublicURL.mockReturnValue('/images/a.png');
  });

  test('returns the public path of the asset', () => {
    const asset = /** @type {any} */ ({ path: 'static/images/a.png', folder: {} });

    expect(getAssetReferenceTarget(asset)).toEqual({ url: '/images/a.png' });
    expect(mockGetAssetPublicURL).toHaveBeenCalledWith(asset, {
      allowSpecial: true,
      pathOnly: true,
    });
  });

  test('returns the asset itself if it has no public path', () => {
    mockGetAssetPublicURL.mockReturnValue(undefined);

    const asset = /** @type {any} */ ({ path: 'static/images/a.png', folder: {} });

    expect(getAssetReferenceTarget(asset)).toEqual({ asset });
  });

  test('returns the asset itself in an entry-relative folder without looking up the path', () => {
    const asset = /** @type {any} */ ({
      path: 'content/post/a.png',
      folder: { entryRelative: true },
    });

    expect(getAssetReferenceTarget(asset)).toEqual({ asset });
    expect(mockGetAssetPublicURL).not.toHaveBeenCalled();
  });
});
