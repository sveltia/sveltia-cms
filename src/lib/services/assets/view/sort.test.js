import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sortAssets, getValue } from './sort';

// Mock dependencies
vi.mock('@sveltia/utils/string', () => ({
  compare: vi.fn(),
}));

describe('assets/view/sort', () => {
  /** @type {import('$lib/types/private').Asset[]} */
  let mockAssets;
  /** @type {import('vitest').MockedFunction<any>} */
  let compareMock;

  beforeEach(async () => {
    vi.clearAllMocks();

    const { compare } = await import('@sveltia/utils/string');

    compareMock = vi.mocked(compare);

    // Default compare implementation for string sorting
    compareMock.mockImplementation((a, b) => {
      if (String(a) < String(b)) return -1;
      if (String(a) > String(b)) return 1;
      return 0;
    });

    // Sample asset data with complete Asset structure
    mockAssets = [
      {
        path: '/images/hero.png',
        name: 'hero.png',
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
        commitAuthor: { name: 'Alice', login: 'alice', email: 'alice@example.com' },
        commitDate: new Date('2023-01-01'),
      },
      {
        path: '/images/hero-1.png',
        name: 'hero-1.png',
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
        commitAuthor: { name: 'Bob', login: 'bob', email: 'bob@example.com' },
        commitDate: new Date('2023-01-02'),
      },
      {
        path: '/images/hero-2.png',
        name: 'hero-2.png',
        sha: 'sha3',
        size: 512000,
        kind: 'image',
        folder: {
          collectionName: undefined,
          internalPath: '/images',
          publicPath: '/images',
          entryRelative: false,
          hasTemplateTags: false,
        },
        commitAuthor: { name: 'Charlie', login: 'charlie', email: 'charlie@example.com' },
        commitDate: new Date('2023-01-03'),
      },
      {
        path: '/docs/document.pdf',
        name: 'document.pdf',
        sha: 'sha4',
        size: 256000,
        kind: 'document',
        folder: {
          collectionName: undefined,
          internalPath: '/docs',
          publicPath: '/docs',
          entryRelative: false,
          hasTemplateTags: false,
        },
        commitAuthor: { name: '', email: 'david@example.com' },
        commitDate: new Date('2023-01-04'),
      },
    ];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('sortAssets', () => {
    it('should return assets unchanged when no key is provided', () => {
      const result = sortAssets(mockAssets);

      expect(result).toEqual(mockAssets);
    });

    it('should return assets unchanged when no order is provided', () => {
      const result = sortAssets(mockAssets, { key: 'name' });

      expect(result).toEqual(mockAssets);
    });

    it('should return assets unchanged when key is empty', () => {
      const result = sortAssets(mockAssets, { key: '', order: 'ascending' });

      expect(result).toEqual(mockAssets);
    });

    it('should return assets unchanged when order is empty', () => {
      const result = sortAssets(mockAssets, { key: 'name', order: /** @type {any} */ ('') });

      expect(result).toEqual(mockAssets);
    });

    it('should sort by name field in ascending order', () => {
      const result = sortAssets(mockAssets, { key: 'name', order: 'ascending' });

      // Check that compare was called (exact calls depend on sorting algorithm)
      expect(compareMock).toHaveBeenCalled();
      // Check the actual sorted result
      expect(result[0].name).toBe('document.pdf');
      expect(result[1].name).toBe('hero.png');
      expect(result[2].name).toBe('hero-1.png');
      expect(result[3].name).toBe('hero-2.png');
    });

    it('should sort by name field in descending order', () => {
      const result = sortAssets(mockAssets, { key: 'name', order: 'descending' });

      expect(result[0].name).toBe('hero-2.png');
      expect(result[1].name).toBe('hero-1.png');
      expect(result[2].name).toBe('hero.png');
      expect(result[3].name).toBe('document.pdf');
    });

    it('should sort by commit_author using name field', () => {
      const result = sortAssets(mockAssets, { key: 'commit_author', order: 'ascending' });

      // Check that compare was called
      expect(compareMock).toHaveBeenCalled();
      expect(result[0].commitAuthor?.name).toBe('Alice');
      expect(result[1].commitAuthor?.name).toBe('Bob');
      expect(result[2].commitAuthor?.name).toBe('Charlie');
      // Last one should use email since name is empty
      expect(result[3].commitAuthor?.email).toBe('david@example.com');
    });

    it('should sort by commit_author using login when name is not available', () => {
      const assetsWithLogin = /** @type {any[]} */ ([
        {
          ...mockAssets[0],
          commitAuthor: { name: '', login: 'zuser', email: 'z@example.com' },
        },
        {
          ...mockAssets[1],
          commitAuthor: { name: '', login: 'auser', email: 'a@example.com' },
        },
      ]);

      const result = sortAssets(assetsWithLogin, { key: 'commit_author', order: 'ascending' });

      expect(compareMock).toHaveBeenCalledWith('auser', 'zuser');
      expect(result[0].commitAuthor?.login).toBe('auser');
      expect(result[1].commitAuthor?.login).toBe('zuser');
    });

    it('should sort by commit_author using email when name and login are not available', () => {
      const result = sortAssets([mockAssets[3]], { key: 'commit_author', order: 'ascending' });

      expect(result[0].commitAuthor?.email).toBe('david@example.com');
    });

    it('should sort by commit_date in ascending order', () => {
      const result = sortAssets(mockAssets, { key: 'commit_date', order: 'ascending' });

      expect(result[0].commitDate?.getTime()).toBe(new Date('2023-01-01').getTime());
      expect(result[1].commitDate?.getTime()).toBe(new Date('2023-01-02').getTime());
      expect(result[2].commitDate?.getTime()).toBe(new Date('2023-01-03').getTime());
      expect(result[3].commitDate?.getTime()).toBe(new Date('2023-01-04').getTime());
    });

    it('should sort by commit_date in descending order', () => {
      const result = sortAssets(mockAssets, { key: 'commit_date', order: 'descending' });

      expect(result[0].commitDate?.getTime()).toBe(new Date('2023-01-04').getTime());
      expect(result[1].commitDate?.getTime()).toBe(new Date('2023-01-03').getTime());
      expect(result[2].commitDate?.getTime()).toBe(new Date('2023-01-02').getTime());
      expect(result[3].commitDate?.getTime()).toBe(new Date('2023-01-01').getTime());
    });

    it('should sort by numeric field (size) in ascending order', () => {
      const result = sortAssets(mockAssets, { key: 'size', order: 'ascending' });

      expect(result[0].size).toBe(256000);
      expect(result[1].size).toBe(512000);
      expect(result[2].size).toBe(1024000);
      expect(result[3].size).toBe(2048000);
    });

    it('should sort by numeric field (size) in descending order', () => {
      const result = sortAssets(mockAssets, { key: 'size', order: 'descending' });

      expect(result[0].size).toBe(2048000);
      expect(result[1].size).toBe(1024000);
      expect(result[2].size).toBe(512000);
      expect(result[3].size).toBe(256000);
    });

    it('should sort by string field (kind) using string comparison', () => {
      const result = sortAssets(mockAssets, { key: 'kind', order: 'ascending' });

      expect(compareMock).toHaveBeenCalledWith('document', 'image');
      expect(result[0].kind).toBe('document');
      expect(result[1].kind).toBe('image');
      expect(result[2].kind).toBe('image');
      expect(result[3].kind).toBe('image');
    });

    it('should handle undefined field values by using empty string', () => {
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
          customField: 'value',
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
          // customField is undefined
        },
      ]);

      const result = sortAssets(assetsWithUndefined, { key: 'customField', order: 'ascending' });

      expect(compareMock).toHaveBeenCalledWith('', 'value');
      // Asset without customField should come first (empty string sorts before 'value')
      expect(result[0].name).toBe('test2.jpg');
      expect(result[1].name).toBe('test1.jpg');
    });

    it('should not mutate original assets array', () => {
      const originalAssets = [...mockAssets];
      const result = sortAssets(mockAssets, { key: 'name', order: 'descending' });

      expect(mockAssets).toEqual(originalAssets);
      expect(result).not.toBe(mockAssets);
    });

    it('should handle empty assets array', () => {
      const result = sortAssets([], { key: 'name', order: 'ascending' });

      expect(result).toEqual([]);
    });

    it('should handle single asset', () => {
      const result = sortAssets([mockAssets[0]], { key: 'name', order: 'ascending' });

      expect(result).toEqual([mockAssets[0]]);
    });

    it('should determine type from first asset when no special key', () => {
      // Test with numeric field
      const result = sortAssets(mockAssets, { key: 'size', order: 'ascending' });

      // Should use numeric comparison, not string comparison
      expect(result[0].size).toBe(256000);
      expect(result[1].size).toBe(512000);
      expect(result[2].size).toBe(1024000);
      expect(result[3].size).toBe(2048000);
    });

    it('should handle default parameter values', () => {
      const result = sortAssets(mockAssets);

      expect(result).toEqual(mockAssets);
    });

    it('should properly exclude file extension from name sorting', () => {
      const numberedAssets = [
        { ...mockAssets[0], name: 'hero.png' },
        { ...mockAssets[1], name: 'hero-10.png' },
        { ...mockAssets[2], name: 'hero-2.png' },
      ];

      const result = sortAssets(numberedAssets, { key: 'name', order: 'ascending' });

      // Should sort by filename without extension: hero, hero-10, hero-2
      expect(compareMock).toHaveBeenCalled();
      // Verify the actual order (the exact comparison calls depend on the sorting algorithm)
      expect(result[0].name).toBe('hero.png');
      expect(result[1].name).toBe('hero-10.png');
      expect(result[2].name).toBe('hero-2.png');
    });

    it('should handle commit_author with only email', () => {
      const assetsWithEmailOnly = /** @type {any[]} */ ([
        {
          ...mockAssets[0],
          commitAuthor: { name: '', login: '', email: 'alice@example.com' },
        },
      ]);

      const result = sortAssets(assetsWithEmailOnly, { key: 'commit_author', order: 'ascending' });

      expect(result[0].commitAuthor?.email).toBe('alice@example.com');
    });

    it('should handle missing commitAuthor object', () => {
      const assetsWithoutAuthor = /** @type {any[]} */ ([
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
          // No commitAuthor property
        },
      ]);

      const result = sortAssets(assetsWithoutAuthor, { key: 'commit_author', order: 'ascending' });

      expect(result).toEqual(assetsWithoutAuthor);
    });
  });

  describe('getValue', () => {
    it('should return commit author name when key is commit_author', () => {
      /** @type {import('$lib/types/private').Asset} */
      const asset = {
        commitAuthor: { name: 'John Doe', login: 'johndoe', email: 'john@example.com' },
        name: 'test.jpg',
        path: '/images/test.jpg',
        sha: 'sha123',
        size: 1024,
        kind: 'image',
        folder: {
          collectionName: undefined,
          internalPath: '/images',
          publicPath: '/images',
          entryRelative: false,
          hasTemplateTags: false,
        },
      };

      const result = getValue(asset, 'commit_author');

      expect(result).toBe('John Doe');
    });

    it('should return commit author login when name is not available', () => {
      /** @type {import('$lib/types/private').Asset} */
      const asset = {
        commitAuthor: /** @type {any} */ ({ login: 'johndoe', email: 'john@example.com' }),
        name: 'test.jpg',
        path: '/images/test.jpg',
        sha: 'sha123',
        size: 1024,
        kind: 'image',
        folder: {
          collectionName: undefined,
          internalPath: '/images',
          publicPath: '/images',
          entryRelative: false,
          hasTemplateTags: false,
        },
      };

      const result = getValue(asset, 'commit_author');

      expect(result).toBe('johndoe');
    });

    it('should return commit author email when name and login are not available', () => {
      /** @type {import('$lib/types/private').Asset} */
      const asset = {
        commitAuthor: /** @type {any} */ ({ email: 'john@example.com' }),
        name: 'test.jpg',
        path: '/images/test.jpg',
        sha: 'sha123',
        size: 1024,
        kind: 'image',
        folder: {
          collectionName: undefined,
          internalPath: '/images',
          publicPath: '/images',
          entryRelative: false,
          hasTemplateTags: false,
        },
      };

      const result = getValue(asset, 'commit_author');

      expect(result).toBe('john@example.com');
    });

    it('should return undefined when commit author is not available', () => {
      /** @type {import('$lib/types/private').Asset} */
      const asset = {
        name: 'test.jpg',
        path: '/images/test.jpg',
        sha: 'sha123',
        size: 1024,
        kind: 'image',
        folder: {
          collectionName: undefined,
          internalPath: '/images',
          publicPath: '/images',
          entryRelative: false,
          hasTemplateTags: false,
        },
      };

      const result = getValue(asset, 'commit_author');

      expect(result).toBeUndefined();
    });

    it('should return commit date when key is commit_date', () => {
      const commitDate = new Date('2023-01-01');

      /** @type {import('$lib/types/private').Asset} */
      const asset = {
        commitDate,
        name: 'test.jpg',
        path: '/images/test.jpg',
        sha: 'sha123',
        size: 1024,
        kind: 'image',
        folder: {
          collectionName: undefined,
          internalPath: '/images',
          publicPath: '/images',
          entryRelative: false,
          hasTemplateTags: false,
        },
      };

      const result = getValue(asset, 'commit_date');

      expect(result).toBe(commitDate);
    });

    it('should return filename without extension when key is name', () => {
      /** @type {import('$lib/types/private').Asset} */
      const asset = {
        name: 'hero-image.png',
        path: '/images/hero-image.png',
        sha: 'sha123',
        size: 1024,
        kind: 'image',
        folder: {
          collectionName: undefined,
          internalPath: '/images',
          publicPath: '/images',
          entryRelative: false,
          hasTemplateTags: false,
        },
      };

      const result = getValue(asset, 'name');

      expect(result).toBe('hero-image');
    });

    it('should handle names with multiple dots correctly', () => {
      /** @type {import('$lib/types/private').Asset} */
      const asset = {
        name: 'my.file.name.tar.gz',
        path: '/files/my.file.name.tar.gz',
        sha: 'sha123',
        size: 1024,
        kind: 'document',
        folder: {
          collectionName: undefined,
          internalPath: '/files',
          publicPath: '/files',
          entryRelative: false,
          hasTemplateTags: false,
        },
      };

      const result = getValue(asset, 'name');

      expect(result).toBe('my');
    });

    it('should handle names without extension', () => {
      /** @type {import('$lib/types/private').Asset} */
      const asset = {
        name: 'filename',
        path: '/files/filename',
        sha: 'sha123',
        size: 1024,
        kind: 'document',
        folder: {
          collectionName: undefined,
          internalPath: '/files',
          publicPath: '/files',
          entryRelative: false,
          hasTemplateTags: false,
        },
      };

      const result = getValue(asset, 'name');

      expect(result).toBe('filename');
    });

    it('should return asset property value for other keys', () => {
      /** @type {import('$lib/types/private').Asset} */
      const asset = {
        name: 'test.jpg',
        path: '/images/test.jpg',
        size: 1024,
        kind: 'image',
        sha: 'abc123',
        folder: {
          collectionName: undefined,
          internalPath: '/images',
          publicPath: '/images',
          entryRelative: false,
          hasTemplateTags: false,
        },
      };

      expect(getValue(asset, 'size')).toBe(1024);
      expect(getValue(asset, 'kind')).toBe('image');
      expect(getValue(asset, 'sha')).toBe('abc123');
    });

    it('should return empty string for undefined properties', () => {
      /** @type {import('$lib/types/private').Asset} */
      const asset = {
        name: 'test.jpg',
        path: '/images/test.jpg',
        sha: 'sha123',
        size: 1024,
        kind: 'image',
        folder: {
          collectionName: undefined,
          internalPath: '/images',
          publicPath: '/images',
          entryRelative: false,
          hasTemplateTags: false,
        },
      };

      const result = getValue(asset, 'nonexistent');

      expect(result).toBe('');
    });

    it('should handle null values', () => {
      /** @type {any} */ // Using any to allow null size for testing edge case
      const asset = {
        name: 'test.jpg',
        path: '/images/test.jpg',
        size: null,
        sha: 'sha123',
        kind: 'image',
        folder: {
          collectionName: undefined,
          internalPath: '/images',
          publicPath: '/images',
          entryRelative: false,
          hasTemplateTags: false,
        },
      };

      const result = getValue(asset, 'size');

      expect(result).toBe('');
    });
  });
});
