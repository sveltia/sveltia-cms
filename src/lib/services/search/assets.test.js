import { describe, it, expect } from 'vitest';
import { searchAssets } from './assets';
import { hasMatch, normalize } from './util';

/**
 * @import { Asset } from '$lib/types/private';
 */

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

  it('should integrate properly with hasMatch and normalize utilities', () => {
    // Test that the actual utility functions work correctly
    expect(hasMatch({ value: 'test-file.jpg', terms: normalize('TEST') })).toBe(true);
    expect(hasMatch({ value: 'café.png', terms: normalize('cafe') })).toBe(true);

    const assets = [createAsset('café-image.jpg')];
    const result = searchAssets({ assets, terms: 'cafe' });

    expect(result).toHaveLength(1);
  });
});
