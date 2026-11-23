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

  test('returns the asset itself if its public path is relative', () => {
    // An empty public folder stores a bare path, which another collection’s media folder can hold a
    // different file at
    const asset = /** @type {any} */ ({ path: 'static/posts/photo.jpg', folder: {} });

    ['photo.jpg', 'sub/photo.jpg', './photo.jpg', '../images/photo.jpg'].forEach((url) => {
      mockGetAssetPublicURL.mockReturnValue(url);
      expect(getAssetReferenceTarget(asset)).toEqual({ asset });
    });
  });

  test('returns a public path that refers to one file only', () => {
    const asset = /** @type {any} */ ({ path: 'src/assets/photo.jpg', folder: {} });

    ['@assets/photo.jpg', 'https://cdn.example.com/photo.jpg'].forEach((url) => {
      mockGetAssetPublicURL.mockReturnValue(url);
      expect(getAssetReferenceTarget(asset)).toEqual({ url });
    });
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
