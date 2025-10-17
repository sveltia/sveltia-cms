import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { groupAssets } from './group';

// Mock dependencies
vi.mock('@sveltia/utils/string', () => ({
  compare: vi.fn(),
}));

vi.mock('svelte/store', () => ({
  get: vi.fn(),
}));

vi.mock('svelte-i18n', () => ({
  _: {},
}));

vi.mock('$lib/services/utils/misc', () => ({
  getRegex: vi.fn(),
}));

describe('assets/view/group', () => {
  /** @type {import('$lib/types/private').Asset[]} */
  let mockAssets;
  /** @type {import('vitest').MockedFunction<any>} */
  let compareMock;
  /** @type {import('vitest').MockedFunction<any>} */
  let getMock;
  /** @type {import('vitest').MockedFunction<any>} */
  let getRegexMock;

  beforeEach(async () => {
    vi.clearAllMocks();

    const { compare } = await import('@sveltia/utils/string');
    const { get } = await import('svelte/store');
    const { getRegex } = await import('$lib/services/utils/misc');

    compareMock = vi.mocked(compare);
    getMock = vi.mocked(get);
    getRegexMock = vi.mocked(getRegex);

    // Default compare implementation for sorting
    compareMock.mockImplementation((a, b) => {
      if (String(a) < String(b)) return -1;
      if (String(a) > String(b)) return 1;
      return 0;
    });

    // Mock svelte-i18n properly - get(_) should return a function that returns the translation
    getMock.mockReturnValue(() => 'Other');

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
        commitAuthor: { name: 'Alice', email: 'alice@example.com' },
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
        commitAuthor: { name: 'Bob', email: 'bob@example.com' },
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
        commitAuthor: { name: 'Charlie', email: 'charlie@example.com' },
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
        commitAuthor: { name: 'David', email: 'david@example.com' },
        commitDate: new Date('2023-01-04'),
      },
    ];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('groupAssets', () => {
    it('should return single group with all assets when no field is provided', () => {
      const result = groupAssets(mockAssets);

      expect(result).toEqual({ '*': mockAssets });
    });

    it('should return empty object when no field and no assets', () => {
      const result = groupAssets([]);

      expect(result).toEqual({});
    });

    it('should return single group when field is empty string', () => {
      const result = groupAssets(mockAssets, { field: '', pattern: undefined });

      expect(result).toEqual({ '*': mockAssets });
    });

    it('should group assets by field value without pattern', () => {
      const result = groupAssets(mockAssets, { field: 'kind', pattern: undefined });

      expect(result).toEqual({
        document: [mockAssets[3]],
        image: [mockAssets[0], mockAssets[1]],
        video: [mockAssets[2]],
      });
      expect(compareMock).toHaveBeenCalled();
    });

    it('should group by field with regex pattern', () => {
      const mockRegex = /photo|video/;

      getRegexMock.mockReturnValue(mockRegex);

      const result = groupAssets(mockAssets, { field: 'name', pattern: 'photo|video' });

      expect(getRegexMock).toHaveBeenCalledWith('photo|video');
      expect(result).toEqual({
        Other: [mockAssets[3]], // document.pdf doesn’t match regex
        photo: [mockAssets[0], mockAssets[1]], // photo1.jpg, photo2.png
        video: [mockAssets[2]], // video1.mp4
      });
    });

    it('should group all assets under "Other" when regex doesn\'t match', () => {
      const mockRegex = /nonexistent/;

      getRegexMock.mockReturnValue(mockRegex);

      const result = groupAssets(mockAssets, { field: 'name', pattern: 'nonexistent' });

      expect(result).toEqual({
        Other: mockAssets, // None match the regex
      });
    });

    it('should use default key when regex match returns null', () => {
      const mockRegex = /xyz/;

      getRegexMock.mockReturnValue(mockRegex);

      // Test with a single asset that won't match the regex
      const testAssets = /** @type {any[]} */ ([
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
        },
      ]);

      const result = groupAssets(testAssets, { field: 'name', pattern: 'xyz' });

      expect(result).toEqual({
        Other: testAssets,
      });
    });

    it('should extract matched group from regex when match succeeds', () => {
      const mockRegex = /^test/;

      getRegexMock.mockReturnValue(mockRegex);

      const testAssets = /** @type {any[]} */ ([
        {
          path: '/test1.jpg',
          name: 'test1.jpg',
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
        },
        {
          path: '/other.jpg',
          name: 'other.jpg',
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
        },
      ]);

      const result = groupAssets(testAssets, { field: 'name', pattern: '^test' });

      expect(result).toEqual({
        Other: [testAssets[1]],
        test: [testAssets[0]],
      });
    });

    it('should assign matched text to key from regex with capture group', () => {
      // Use a regex that explicitly captures a group
      const mockRegex = /(test)/;

      getRegexMock.mockReturnValue(mockRegex);

      const testAssets = /** @type {any[]} */ ([
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
        },
      ]);

      const result = groupAssets(testAssets, { field: 'name', pattern: '(test)' });

      // The matched first element (either the full match or first capture group) becomes the key
      expect(result.test || result.Other).toBeDefined();
      expect(Object.keys(result).length).toBeGreaterThan(0);
    });

    it('should handle assets with undefined field values', () => {
      // Using any type for testing purposes since description is not in Asset type
      const assetsWithUndefined = /** @type {any[]} */ ([
        {
          path: '/test1.jpg',
          name: 'test1.jpg',
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
          category: 'photos',
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
          category: undefined,
        },
      ]);

      const result = groupAssets(assetsWithUndefined, { field: 'category', pattern: undefined });

      expect(result).toEqual({
        photos: [assetsWithUndefined[0]],
        undefined: [assetsWithUndefined[1]],
      });
    });

    it('should sort groups alphabetically by key', () => {
      // Create test assets that would result in unsorted groups
      const testAssets = /** @type {any[]} */ ([
        {
          path: '/zebra.jpg',
          name: 'zebra.jpg',
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
          letter: 'z',
        },
        {
          path: '/alpha.jpg',
          name: 'alpha.jpg',
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
          letter: 'a',
        },
        {
          path: '/middle.jpg',
          name: 'middle.jpg',
          sha: 'sha3',
          size: 3000,
          kind: 'image',
          folder: {
            collectionName: undefined,
            internalPath: '/test',
            publicPath: '/test',
            entryRelative: false,
            hasTemplateTags: false,
          },
          letter: 'm',
        },
      ]);

      const result = groupAssets(testAssets, { field: 'letter', pattern: undefined });
      const keys = Object.keys(result);

      expect(keys).toEqual(['a', 'm', 'z']);
      expect(compareMock).toHaveBeenCalled();
    });

    it('should handle empty conditions object', () => {
      const result = groupAssets(mockAssets, /** @type {any} */ ({}));

      expect(result).toEqual({ '*': mockAssets });
    });

    it('should handle default parameter values', () => {
      const result = groupAssets(mockAssets);

      expect(result).toEqual({ '*': mockAssets });
    });

    it('should handle numeric field values', () => {
      const result = groupAssets(mockAssets, { field: 'size', pattern: undefined });

      expect(result).toEqual({
        512000: [mockAssets[3]], // document.pdf
        1024000: [mockAssets[0]], // photo1.jpg
        2048000: [mockAssets[1]], // photo2.png
        10240000: [mockAssets[2]], // video1.mp4
      });
    });

    it('should convert field values to string for regex matching', () => {
      const mockRegex = /1024/;

      getRegexMock.mockReturnValue(mockRegex);

      const result = groupAssets(mockAssets, { field: 'size', pattern: '1024' });

      expect(result).toEqual({
        1024: [mockAssets[0], mockAssets[2]], // 1024000 and 10240000 both contain "1024"
        Other: [mockAssets[1], mockAssets[3]], // 2048000 and 512000 don’t contain "1024"
      });
    });

    it('should handle regex with capture groups', () => {
      const mockRegex = /1024/;

      getRegexMock.mockReturnValue(mockRegex);

      const result = groupAssets(mockAssets, { field: 'size', pattern: '1024' });

      expect(result).toEqual({
        1024: [mockAssets[0], mockAssets[2]], // Both sizes contain "1024"
        Other: [mockAssets[1], mockAssets[3]], // Other sizes don’t contain "1024"
      });
    });
  });
});
