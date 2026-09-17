import { describe, expect, it, vi } from 'vitest';

import { searchAssets } from './assets';
import { hasAllMatches, hasMatch, normalize, tokenize } from './util';

/**
 * @import { Asset } from '$lib/types/private';
 */

// Mock only the stores, not the util functions
vi.mock('$lib/services/assets', () => ({
  publishedAssets: { current: [] },
}));

vi.mock('$lib/services/search', () => ({
  searchTerms: { current: '' },
}));

describe('searchAssets integration', () => {
  /**
   * Create test assets with minimal required properties.
   * @param {string} name Asset name.
   * @returns {Asset} Mock asset object.
   */
  const createAsset = (name) =>
    /** @type {Asset} */ ({
      name,
      path: `/assets/${name}`,
      sha: 'mock-sha',
      size: 1024,
      kind: 'image',
      folder: {
        collectionName: undefined,
        internalPath: '/assets',
        publicPath: '/assets',
        entryRelative: false,
        hasTemplateTags: false,
      },
      // RepositoryFileMetadata properties
      commitAuthor: undefined,
      commitDate: undefined,
      // Optional AssetProps properties
      file: undefined,
      blobURL: undefined,
      text: undefined,
      unsaved: undefined,
    });

  it('should return empty array when no assets provided', () => {
    const result = searchAssets({ assets: [], terms: 'test' });

    expect(result).toEqual([]);
  });

  it('should return empty array when no terms provided', () => {
    const assets = [createAsset('image1.jpg'), createAsset('image2.png')];
    const result = searchAssets({ assets, terms: '' });

    expect(result).toEqual([]);
  });

  it('should return empty array when terms are only whitespace', () => {
    const assets = [createAsset('image1.jpg'), createAsset('image2.png')];
    const result = searchAssets({ assets, terms: '   ' });

    expect(result).toEqual([]);
  });

  it('should filter assets based on matching names', () => {
    const assets = [
      createAsset('profile-image.jpg'),
      createAsset('background.png'),
      createAsset('logo.svg'),
      createAsset('header-image.jpg'),
    ];

    const result = searchAssets({ assets, terms: 'image' });

    expect(result).toHaveLength(2);
    expect(result.map((a) => a.name)).toEqual(['profile-image.jpg', 'header-image.jpg']);
  });

  it('should handle case-insensitive searches', () => {
    const assets = [
      createAsset('PROFILE.JPG'),
      createAsset('background.PNG'),
      createAsset('Logo.SVG'),
    ];

    const result = searchAssets({ assets, terms: 'profile' });

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('PROFILE.JPG');
  });

  it('should preserve all asset properties in results', () => {
    const asset = createAsset('profile.jpg');
    const result = searchAssets({ assets: [asset], terms: 'profile' });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(asset);
  });

  it('should integrate properly with the search utilities', () => {
    // Test that the actual utility functions work correctly
    expect(hasMatch({ value: 'test-file.jpg', terms: normalize('TEST') })).toBe(true);
    expect(hasMatch({ value: 'café.png', terms: normalize('cafe') })).toBe(true);
    expect(hasAllMatches({ value: 'café.png', tokens: tokenize('Cafe PNG') })).toBe(true);

    const assets = [createAsset('café-image.jpg')];
    const result = searchAssets({ assets, terms: 'cafe' });

    expect(result).toHaveLength(1);
  });

  it('should match every word of a multi-word query in a hyphenated file name', () => {
    const assets = [createAsset('annual-report-cover-photo.png'), createAsset('logo.svg')];

    expect(searchAssets({ assets, terms: 'annual report cover' }).map((a) => a.name)).toEqual([
      'annual-report-cover-photo.png',
    ]);
    // The words can appear in any order
    expect(searchAssets({ assets, terms: 'cover annual' }).map((a) => a.name)).toEqual([
      'annual-report-cover-photo.png',
    ]);
  });

  it('should require every word to match', () => {
    const assets = [
      createAsset('photo.png'),
      createAsset('cover-photo.png'),
      createAsset('annual-report-cover-photo.png'),
      createAsset('logo.svg'),
    ];

    const result = searchAssets({ assets, terms: 'annual report cover' });

    expect(result.map((a) => a.name)).toEqual(['annual-report-cover-photo.png']);
  });

  it('should keep the original order of the assets', () => {
    const assets = [
      createAsset('report-2024-annual.pdf'),
      createAsset('annual-summary.pdf'),
      createAsset('annual-report.pdf'),
      createAsset('report-2025.pdf'),
    ];

    const result = searchAssets({ assets, terms: 'annual report' });

    expect(result.map((a) => a.name)).toEqual(['report-2024-annual.pdf', 'annual-report.pdf']);
  });
});

describe('assetSearchResults derived store', () => {
  it('should compute the results from the assets and search terms', async () => {
    // Import after mocks are set up
    const { assetSearchResults } = await import('./assets');
    // The mock replaces the real read-only state with a writable one
    const allAssets = /** @type {any} */ ((await import('$lib/services/assets')).publishedAssets);
    const { searchTerms } = await import('$lib/services/search');

    allAssets.current = [
      /** @type {any} */ ({
        name: 'profile.jpg',
        path: '/assets/profile.jpg',
        sha: 'mock-sha',
        size: 1024,
        kind: 'image',
        folder: {
          collectionName: undefined,
          internalPath: '/assets',
          publicPath: '/assets',
          entryRelative: false,
          hasTemplateTags: false,
        },
      }),
    ];
    searchTerms.current = 'profile';

    expect(assetSearchResults.current).toEqual([expect.objectContaining({ name: 'profile.jpg' })]);
  });
});
