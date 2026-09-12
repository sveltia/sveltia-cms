// @ts-nocheck
import { describe, expect, test } from 'vitest';

import { filterAssetsByQuery } from '$lib/services/integrations/media-libraries/cloud/search';

describe('filterAssetsByQuery()', () => {
  const assets = [
    { id: '1', fileName: 'Sunset.jpg', description: 'Beach at dusk' },
    { id: '2', fileName: 'city.png', description: 'Skyline' },
    { id: '3', fileName: 'notes.txt', description: 'Sunset plans' },
  ];

  test('matches the file name or description, case-insensitively', () => {
    expect(filterAssetsByQuery(assets, 'sunset').map(({ id }) => id)).toEqual(['1', '3']);
    expect(filterAssetsByQuery(assets, 'SKY').map(({ id }) => id)).toEqual(['2']);
  });

  test('returns every asset for an empty query', () => {
    expect(filterAssetsByQuery(assets, '')).toEqual(assets);
  });

  test('returns nothing when no asset matches', () => {
    expect(filterAssetsByQuery(assets, 'mountain')).toEqual([]);
  });
});
