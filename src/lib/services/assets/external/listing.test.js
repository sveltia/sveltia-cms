import { describe, expect, test, vi } from 'vitest';

import { fetchExternalAssetListing } from '$lib/services/assets/external/listing';

/** @type {any} */
const options = { kind: 'image' };
/** @type {any[]} */
const assets = [{ id: 'a' }];

describe('fetchExternalAssetListing()', () => {
  test('searches with a query', async () => {
    const search = vi.fn(async () => assets);
    const browse = vi.fn();

    expect(
      await fetchExternalAssetListing({ service: { search, browse }, query: 'cat', options }),
    ).toEqual({ assets, truncated: false });
    expect(search).toHaveBeenCalledWith('cat', options);
    expect(browse).not.toHaveBeenCalled();
  });

  test('browses a service with folders, listing its empty folders', async () => {
    const browse = vi.fn(async () => ({ assets, folders: ['2024'], truncated: true }));

    expect(
      await fetchExternalAssetListing({ service: { search: vi.fn(), browse }, query: '', options }),
    ).toEqual({ assets, folders: ['2024'], truncated: true });
    expect(
      await fetchExternalAssetListing({
        service: { browse: vi.fn(async () => ({ assets, folders: [] })) },
        query: 'ignored without search',
        options,
      }),
    ).toEqual({ assets, folders: [], truncated: false });
  });

  test('lists the files of any other service', async () => {
    const list = vi.fn(async () => assets);

    expect(await fetchExternalAssetListing({ service: { list }, query: '', options })).toEqual({
      assets,
      truncated: false,
    });
    expect(list).toHaveBeenCalledWith(options);
    expect(await fetchExternalAssetListing({ service: {}, query: '', options })).toEqual({
      assets: [],
      truncated: false,
    });
  });
});
