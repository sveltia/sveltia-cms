import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { filterAssets } from './filter';

// Mock dependencies
vi.mock('$lib/services/assets/kinds', () => ({
  getAssetKind: vi.fn(),
}));

vi.mock('$lib/services/utils/misc', () => ({
  getRegex: vi.fn(),
}));

describe('assets/view/filter', () => {
  /** @type {import('$lib/types/private').Asset[]} */
  let mockAssets;
  /** @type {import('vitest').MockedFunction<any>} */
  let getAssetKindMock;
  /** @type {import('vitest').MockedFunction<any>} */
  let getRegexMock;

  beforeEach(async () => {
    vi.clearAllMocks();

    const { getAssetKind } = await import('$lib/services/assets/kinds');
    const { getRegex } = await import('$lib/services/utils/misc');

    getAssetKindMock = /** @type {any} */ (vi.mocked(getAssetKind));
    getRegexMock = /** @type {any} */ (vi.mocked(getRegex));

    // Sample asset data with complete Asset structure
    mockAssets = [
      {
        path: '/images/photo1.jpg',
        name: 'photo1.jpg',
        sha: 'sha1',
        size: 1024000,
        kind: 'image',
        folder: {
          collectionName: undefined,
          internalPath: '/images',
          publicPath: '/images',
          entryRelative: false,
          hasTemplateTags: false,
        },
        commitAuthor: { name: 'Test User', email: 'test@example.com' },
        commitDate: new Date('2023-01-01'),
      },
      {
        path: '/images/photo2.png',
        name: 'photo2.png',
        sha: 'sha2',
        size: 2048000,
        kind: 'image',
        folder: {
          collectionName: undefined,
          internalPath: '/images',
          publicPath: '/images',
          entryRelative: false,
          hasTemplateTags: false,
        },
        commitAuthor: { name: 'Test User', email: 'test@example.com' },
        commitDate: new Date('2023-01-02'),
      },
      {
        path: '/videos/video1.mp4',
        name: 'video1.mp4',
        sha: 'sha3',
        size: 10240000,
        kind: 'video',
        folder: {
          collectionName: undefined,
          internalPath: '/videos',
          publicPath: '/videos',
          entryRelative: false,
          hasTemplateTags: false,
        },
        commitAuthor: { name: 'Test User', email: 'test@example.com' },
        commitDate: new Date('2023-01-03'),
      },
      {
        path: '/docs/document.pdf',
        name: 'document.pdf',
        sha: 'sha4',
        size: 512000,
        kind: 'document',
        folder: {
          collectionName: undefined,
          internalPath: '/docs',
          publicPath: '/docs',
          entryRelative: false,
          hasTemplateTags: false,
        },
        commitAuthor: { name: 'Test User', email: 'test@example.com' },
        commitDate: new Date('2023-01-04'),
      },
    ];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('filterAssets', () => {
    it('should return all assets when no field is provided', () => {
      const result = filterAssets(mockAssets);

      expect(result).toEqual(mockAssets);
    });

    it('should return all assets when field is empty string', () => {
      const result = filterAssets(mockAssets, { field: '', pattern: 'image' });

      expect(result).toEqual(mockAssets);
    });

    it('should filter by fileType using getAssetKind', () => {
      getAssetKindMock.mockImplementation((path) => {
        if (String(path).includes('.jpg') || String(path).includes('.png')) return 'image';
        if (String(path).includes('.mp4')) return 'video';
        if (String(path).includes('.pdf')) return 'document';
        return 'other';
      });

      const result = filterAssets(mockAssets, { field: 'fileType', pattern: 'image' });

      expect(getAssetKindMock).toHaveBeenCalledTimes(4);
      expect(getAssetKindMock).toHaveBeenCalledWith('/images/photo1.jpg');
      expect(getAssetKindMock).toHaveBeenCalledWith('/images/photo2.png');
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('photo1.jpg');
      expect(result[1].name).toBe('photo2.png');
    });

    it('should filter by field with regex pattern', () => {
      const mockRegex = /photo/i;

      getRegexMock.mockReturnValue(mockRegex);

      const result = filterAssets(mockAssets, { field: 'name', pattern: 'photo' });

      expect(getRegexMock).toHaveBeenCalledWith('photo');
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('photo1.jpg');
      expect(result[1].name).toBe('photo2.png');
    });

    it('should filter by field with exact string match when no regex', () => {
      getRegexMock.mockReturnValue(null);

      const result = filterAssets(mockAssets, { field: 'name', pattern: 'photo1.jpg' });

      expect(getRegexMock).toHaveBeenCalledWith('photo1.jpg');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('photo1.jpg');
    });

    it('should handle undefined field values with regex', () => {
      const mockRegex = /test/;

      getRegexMock.mockReturnValue(mockRegex);

      // Using any type for testing purposes since description is not in Asset type
      const assetsWithUndefined = /** @type {any[]} */ ([
        {
          path: '/test.jpg',
          name: 'test.jpg',
          sha: 'sha1',
          size: 1000,
          kind: 'image',
          folder: {
            collectionName: undefined,
            internalPath: '/test',
            publicPath: '/test',
            entryRelative: false,
            hasTemplateTags: false,
          },
          description: undefined,
        },
        {
          path: '/test2.jpg',
          name: 'test2.jpg',
          sha: 'sha2',
          size: 2000,
          kind: 'image',
          folder: {
            collectionName: undefined,
            internalPath: '/test',
            publicPath: '/test',
            entryRelative: false,
            hasTemplateTags: false,
          },
          description: 'test description',
        },
      ]);

      const result = filterAssets(assetsWithUndefined, { field: 'description', pattern: 'test' });

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('test2.jpg');
    });

    it('should handle undefined field values with exact match', () => {
      getRegexMock.mockReturnValue(null);

      // Using any type for testing purposes since description is not in Asset type
      const assetsWithUndefined = /** @type {any[]} */ ([
        {
          path: '/test.jpg',
          name: 'test.jpg',
          sha: 'sha1',
          size: 1000,
          kind: 'image',
          folder: {
            collectionName: undefined,
            internalPath: '/test',
            publicPath: '/test',
            entryRelative: false,
            hasTemplateTags: false,
          },
          description: undefined,
        },
        {
          path: '/test2.jpg',
          name: 'test2.jpg',
          sha: 'sha2',
          size: 2000,
          kind: 'image',
          folder: {
            collectionName: undefined,
            internalPath: '/test',
            publicPath: '/test',
            entryRelative: false,
            hasTemplateTags: false,
          },
          description: 'exact',
        },
      ]);

      const result = filterAssets(assetsWithUndefined, { field: 'description', pattern: 'exact' });

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('test2.jpg');
    });

    it('should convert values to string for regex testing', () => {
      const mockRegex = /1024/;

      getRegexMock.mockReturnValue(mockRegex);

      const result = filterAssets(mockAssets, { field: 'size', pattern: '1024' });

      expect(result).toHaveLength(2); // 1024000 and 10240000 both contain "1024"
    });

    it('should handle empty conditions object', () => {
      const result = filterAssets(mockAssets, /** @type {any} */ ({}));

      expect(result).toEqual(mockAssets);
    });

    it('should handle default parameter values', () => {
      const result = filterAssets(mockAssets);

      expect(result).toEqual(mockAssets);
    });
  });
});
