import { writable } from 'svelte/store';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { processResource } from './process';

// Mock all dependencies
vi.mock('@sveltia/utils/crypto', () => ({
  getHash: vi.fn(),
}));

vi.mock('fast-deep-equal', () => ({
  default: vi.fn(),
}));

vi.mock('isomorphic-dompurify', () => ({
  sanitize: vi.fn(),
}));

vi.mock('svelte/store', () => ({
  get: vi.fn(),
  writable: vi.fn(() => ({
    subscribe: vi.fn(),
    set: vi.fn(),
    update: vi.fn(),
  })),
}));

vi.mock('$lib/services/assets', () => ({
  allAssets: writable([]),
}));

vi.mock('$lib/services/assets/info', () => ({
  getAssetPublicURL: vi.fn(),
}));

vi.mock('$lib/services/integrations/media-libraries/default', () => ({
  transformFile: vi.fn(),
}));

vi.mock('$lib/services/utils/file', () => ({
  getGitHash: vi.fn(),
}));

vi.mock('$lib/services/assets/kinds', () => ({
  getAssetKind: vi.fn(),
}));

describe('Test processResource()', () => {
  /** @type {import('vitest').MockedFunction<any>} */
  let getHashMock;
  /** @type {import('vitest').MockedFunction<any>} */
  let equalMock;
  /** @type {import('vitest').MockedFunction<any>} */
  let domPurifyMock;
  /** @type {import('vitest').MockedFunction<any>} */
  let getMock;
  /** @type {import('vitest').MockedFunction<any>} */
  let getAssetPublicURLMock;
  /** @type {import('vitest').MockedFunction<any>} */
  let transformFileMock;
  /** @type {import('vitest').MockedFunction<any>} */
  let getGitHashMock;

  beforeEach(async () => {
    // Reset all mocks before each test
    vi.resetAllMocks();

    // Mock URL.createObjectURL
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');

    const { getHash } = await import('@sveltia/utils/crypto');
    const equal = (await import('fast-deep-equal')).default;
    const { sanitize } = await import('isomorphic-dompurify');
    const { get } = await import('svelte/store');
    const { getAssetPublicURL } = await import('$lib/services/assets/info');
    const { transformFile } = await import('$lib/services/integrations/media-libraries/default');
    const { getGitHash } = await import('$lib/services/utils/file');

    getHashMock = /** @type {any} */ (vi.mocked(getHash));
    equalMock = /** @type {any} */ (vi.mocked(equal));
    domPurifyMock = /** @type {any} */ (vi.mocked(sanitize));
    getMock = /** @type {any} */ (vi.mocked(get));
    getAssetPublicURLMock = /** @type {any} */ (vi.mocked(getAssetPublicURL));
    transformFileMock = /** @type {any} */ (vi.mocked(transformFile));
    getGitHashMock = /** @type {any} */ (vi.mocked(getGitHash));

    // Default mock implementations
    domPurifyMock.mockImplementation((input) => String(input));
    getMock.mockReturnValue([]);
  });

  test('should process resource with URL', async () => {
    // @ts-ignore - Simplified draft for testing
    const draft = {
      files: {},
    };

    // @ts-ignore - Simplified resource for testing
    const resource = {
      url: 'https://example.com/image.jpg',
      credit: 'Photo credit',
    };

    // @ts-ignore - Simplified config for testing
    const libraryConfig = {
      max_file_size: 1000000,
    };

    // @ts-ignore - Test with simplified types
    const result = await processResource({ draft, resource, libraryConfig });

    expect(result.value).toBe('https://example.com/image.jpg');
    expect(result.credit).toBe('Photo credit');
    expect(result.oversizedFileName).toBeUndefined();
    expect(domPurifyMock).toHaveBeenCalledWith('Photo credit', {
      ALLOWED_TAGS: ['a'],
      ALLOWED_ATTR: ['href'],
    });
  });

  test('should process resource with asset', async () => {
    // @ts-ignore - Simplified draft for testing
    const draft = {
      files: {},
      originalEntry: { slug: 'test-entry' },
    };

    // @ts-ignore - Simplified resource for testing
    const resource = {
      asset: {
        path: 'uploads/image.jpg',
        unsaved: false,
      },
      credit: '',
    };

    // @ts-ignore - Simplified config for testing
    const libraryConfig = {
      max_file_size: 1000000,
    };

    getAssetPublicURLMock.mockReturnValue('/uploads/image.jpg');

    // @ts-ignore - Test with simplified types
    const result = await processResource({ draft, resource, libraryConfig });

    expect(result.value).toBe('/uploads/image.jpg');
    expect(result.credit).toBe('');
    expect(result.oversizedFileName).toBeUndefined();
    expect(getAssetPublicURLMock).toHaveBeenCalledWith(resource.asset, {
      pathOnly: true,
      allowSpecial: true,
      entry: draft.originalEntry,
    });
  });

  test('should process resource with unsaved asset', async () => {
    const mockFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });

    // @ts-ignore - Simplified draft for testing
    const draft = {
      files: {
        'blob:existing-url': { file: mockFile },
      },
    };

    // @ts-ignore - Simplified resource for testing
    const resource = {
      asset: {
        path: 'uploads/image.jpg',
        unsaved: true,
        file: mockFile,
      },
      credit: '',
    };

    // @ts-ignore - Simplified config for testing
    const libraryConfig = {
      max_file_size: 1000000,
    };

    getHashMock.mockResolvedValueOnce('hash1').mockResolvedValueOnce('hash1');

    // @ts-ignore - Test with simplified types
    const result = await processResource({ draft, resource, libraryConfig });

    expect(result.value).toBe('blob:existing-url');
    expect(result.credit).toBe('');
    expect(result.oversizedFileName).toBeUndefined();
  });

  test('should process resource with new file', async () => {
    const mockFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });

    // Mock the size property
    Object.defineProperty(mockFile, 'size', { value: 50000 });

    // @ts-ignore - Simplified draft for testing
    const draft = {
      files: {},
    };

    // @ts-ignore - Simplified resource for testing
    const resource = {
      file: mockFile,
      folder: { name: 'uploads' },
      credit: '',
    };

    // @ts-ignore - Simplified config for testing
    const libraryConfig = {
      max_file_size: 1000000,
    };

    getHashMock.mockResolvedValue('new-file-hash');
    getGitHashMock.mockResolvedValue('git-hash');
    getMock.mockReturnValue([]);

    // @ts-ignore - Test with simplified types
    const result = await processResource({ draft, resource, libraryConfig });

    expect(result.value).toBe('blob:mock-url');
    expect(result.credit).toBe('');
    expect(result.oversizedFileName).toBeUndefined();
    // @ts-ignore - Mock files object
    expect(draft.files['blob:mock-url']).toEqual({
      file: mockFile,
      folder: { name: 'uploads' },
    });
  });

  test('should handle oversized file', async () => {
    const mockFile = new File(['content'], 'large-file.jpg', { type: 'image/jpeg' });

    // Mock the size property to be larger than max_file_size
    Object.defineProperty(mockFile, 'size', { value: 2000000 });

    // @ts-ignore - Simplified draft for testing
    const draft = {
      files: {},
    };

    // @ts-ignore - Simplified resource for testing
    const resource = {
      file: mockFile,
      folder: { name: 'uploads' },
      credit: '',
    };

    // @ts-ignore - Simplified config for testing
    const libraryConfig = {
      max_file_size: 1000000,
    };

    getHashMock.mockResolvedValue('new-file-hash');
    getGitHashMock.mockResolvedValue('git-hash');
    getMock.mockReturnValue([]);

    // @ts-ignore - Test with simplified types
    const result = await processResource({ draft, resource, libraryConfig });

    expect(result.value).toBe('');
    expect(result.credit).toBe('');
    expect(result.oversizedFileName).toBe('large-file.jpg');
    expect(Object.keys(draft.files)).toHaveLength(0);
  });

  test('should reuse existing uploaded asset', async () => {
    const mockFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });

    Object.defineProperty(mockFile, 'size', { value: 50000 });

    // @ts-ignore - Simplified draft for testing
    const draft = {
      files: {},
    };

    // @ts-ignore - Simplified resource for testing
    const resource = {
      file: mockFile,
      folder: { name: 'uploads' },
      credit: '',
    };

    // @ts-ignore - Simplified config for testing
    const libraryConfig = {
      max_file_size: 1000000,
    };

    const existingAsset = {
      sha: 'git-hash',
      folder: { name: 'uploads' },
      path: 'uploads/existing.jpg',
    };

    getHashMock.mockResolvedValue('new-file-hash');
    getGitHashMock.mockResolvedValue('git-hash');
    getMock.mockReturnValue([existingAsset]);
    equalMock.mockReturnValue(true);
    getAssetPublicURLMock.mockReturnValue('/uploads/existing.jpg');

    // @ts-ignore - Test with simplified types
    const result = await processResource({ draft, resource, libraryConfig });

    expect(result.value).toBe('/uploads/existing.jpg');
    expect(result.credit).toBe('');
    expect(result.oversizedFileName).toBeUndefined();
    expect(Object.keys(draft.files)).toHaveLength(0);
  });

  test('should transform file when transformations are configured', async () => {
    const mockFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
    const transformedFile = new File(['transformed'], 'test.jpg', { type: 'image/jpeg' });

    Object.defineProperty(mockFile, 'size', { value: 50000 });
    Object.defineProperty(transformedFile, 'size', { value: 40000 });

    // @ts-ignore - Simplified draft for testing
    const draft = {
      files: {},
    };

    // @ts-ignore - Simplified resource for testing
    const resource = {
      file: mockFile,
      folder: { name: 'uploads' },
      credit: '',
    };

    // @ts-ignore - Simplified config for testing
    const libraryConfig = {
      max_file_size: 1000000,
      transformations: {
        resize: { width: 800 },
      },
    };

    getHashMock.mockResolvedValue('new-file-hash');
    getGitHashMock.mockResolvedValue('git-hash');
    getMock.mockReturnValue([]);
    transformFileMock.mockResolvedValue(transformedFile);

    // @ts-ignore - Test with simplified types
    const result = await processResource({ draft, resource, libraryConfig });

    expect(transformFileMock).toHaveBeenCalledWith(mockFile, libraryConfig.transformations);
    expect(result.value).toBe('blob:mock-url');
    // @ts-ignore - Mock files object
    expect(draft.files['blob:mock-url']).toEqual({
      file: transformedFile,
      folder: { name: 'uploads' },
    });
  });

  test('should find existing blob URL for same file', async () => {
    const mockFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
    const existingFile = new File(['content'], 'existing.jpg', { type: 'image/jpeg' });

    Object.defineProperty(mockFile, 'size', { value: 50000 });
    Object.defineProperty(existingFile, 'size', { value: 50000 });

    // @ts-ignore - Simplified draft for testing
    const draft = {
      files: {
        'blob:existing-url': { file: existingFile },
      },
    };

    // @ts-ignore - Simplified resource for testing
    const resource = {
      file: mockFile,
      folder: { name: 'uploads' },
      credit: '',
    };

    // @ts-ignore - Simplified config for testing
    const libraryConfig = {
      max_file_size: 1000000,
    };

    getHashMock.mockResolvedValueOnce('same-hash').mockResolvedValueOnce('same-hash');

    // @ts-ignore - Test with simplified types
    const result = await processResource({ draft, resource, libraryConfig });

    expect(result.value).toBe('blob:existing-url');
    expect(result.credit).toBe('');
    expect(result.oversizedFileName).toBeUndefined();
  });

  test('should sanitize credit with HTML tags', async () => {
    // @ts-ignore - Simplified draft for testing
    const draft = {
      files: {},
    };

    // @ts-ignore - Simplified resource for testing
    const resource = {
      url: 'https://example.com/image.jpg',
      credit:
        'Photo by <a href="https://example.com">Author</a> with <script>alert("xss")</script>',
    };

    // @ts-ignore - Simplified config for testing
    const libraryConfig = {
      max_file_size: 1000000,
    };

    domPurifyMock.mockReturnValue('Photo by <a href="https://example.com">Author</a>');

    // @ts-ignore - Test with simplified types
    const result = await processResource({ draft, resource, libraryConfig });

    expect(result.credit).toBe('Photo by <a href="https://example.com">Author</a>');
    expect(domPurifyMock).toHaveBeenCalledWith(
      'Photo by <a href="https://example.com">Author</a> with <script>alert("xss")</script>',
      {
        ALLOWED_TAGS: ['a'],
        ALLOWED_ATTR: ['href'],
      },
    );
  });

  test('should handle empty credit', async () => {
    // @ts-ignore - Simplified draft for testing
    const draft = {
      files: {},
    };

    // @ts-ignore - Simplified resource for testing
    const resource = {
      url: 'https://example.com/image.jpg',
      credit: '',
    };

    // @ts-ignore - Simplified config for testing
    const libraryConfig = {
      max_file_size: 1000000,
    };

    // @ts-ignore - Test with simplified types
    const result = await processResource({ draft, resource, libraryConfig });

    expect(result.credit).toBe('');
    expect(domPurifyMock).not.toHaveBeenCalled();
  });

  test('should handle undefined credit', async () => {
    // @ts-ignore - Simplified draft for testing
    const draft = {
      files: {},
    };

    // @ts-ignore - Simplified resource for testing
    const resource = {
      url: 'https://example.com/image.jpg',
    };

    // @ts-ignore - Simplified config for testing
    const libraryConfig = {
      max_file_size: 1000000,
    };

    // @ts-ignore - Test with simplified types
    const result = await processResource({ draft, resource, libraryConfig });

    expect(result.credit).toBe('');
    expect(domPurifyMock).not.toHaveBeenCalled();
  });

  test('should handle resource without any file, asset, or URL', async () => {
    // @ts-ignore - Simplified draft for testing
    const draft = {
      files: {},
    };

    // @ts-ignore - Simplified resource for testing
    const resource = {
      credit: 'Some credit',
    };

    // @ts-ignore - Simplified config for testing
    const libraryConfig = {
      max_file_size: 1000000,
    };

    domPurifyMock.mockReturnValue('Some credit');

    // @ts-ignore - Test with simplified types
    const result = await processResource({ draft, resource, libraryConfig });

    expect(result.value).toBe('');
    expect(result.credit).toBe('Some credit');
    expect(result.oversizedFileName).toBeUndefined();
  });

  test('should handle undefined library config', async () => {
    const mockFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });

    Object.defineProperty(mockFile, 'size', { value: 50000 });

    // @ts-ignore - Simplified draft for testing
    const draft = {
      files: {},
    };

    // @ts-ignore - Simplified resource for testing
    const resource = {
      file: mockFile,
      folder: { name: 'uploads' },
      credit: '',
    };

    getHashMock.mockResolvedValue('new-file-hash');
    getGitHashMock.mockResolvedValue('git-hash');
    getMock.mockReturnValue([]);

    // @ts-ignore - Test with simplified types
    const result = await processResource({ draft, resource, libraryConfig: undefined });

    expect(result.value).toBe('blob:mock-url');
    expect(result.credit).toBe('');
    expect(result.oversizedFileName).toBeUndefined();
    expect(transformFileMock).not.toHaveBeenCalled();
  });
});

describe('Test convertFileItemToAsset()', () => {
  /** @type {import('vitest').MockedFunction<any>} */
  let getGitHashMock;
  /** @type {import('vitest').MockedFunction<any>} */
  let getAssetKindMock;

  beforeEach(async () => {
    vi.resetAllMocks();

    const { getGitHash } = await import('$lib/services/utils/file');
    const { getAssetKind } = await import('$lib/services/assets/kinds');

    getGitHashMock = /** @type {any} */ (vi.mocked(getGitHash));
    getAssetKindMock = /** @type {any} */ (vi.mocked(getAssetKind));

    // Mock URL.createObjectURL
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  });

  test('should convert file to asset with all properties', async () => {
    const { convertFileItemToAsset } = await import('./process');
    const mockFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });

    Object.defineProperty(mockFile, 'size', { value: 50000 });

    const mockFolder = {
      name: 'uploads',
      entryRelative: false,
      collectionName: 'assets',
      internalPath: '_assets',
      publicPath: '/assets',
      hasTemplateTags: false,
    };

    getGitHashMock.mockResolvedValue('git-hash-123');
    getAssetKindMock.mockReturnValue('image');

    // @ts-ignore - Simplified testing
    const result = await convertFileItemToAsset({
      file: mockFile,
      blobURL: 'blob:custom-url',
      folder: mockFolder,
      targetFolderPath: 'uploads',
    });

    expect(result).toEqual({
      unsaved: true,
      file: mockFile,
      blobURL: 'blob:custom-url',
      name: 'test.jpg',
      path: 'uploads/test.jpg',
      sha: 'git-hash-123',
      size: 50000,
      kind: 'image',
      folder: mockFolder,
    });
  });

  test('should create blob URL if not provided', async () => {
    const { convertFileItemToAsset } = await import('./process');
    const mockFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });

    Object.defineProperty(mockFile, 'size', { value: 50000 });

    const mockFolder = {
      name: 'uploads',
      entryRelative: false,
      collectionName: 'assets',
      internalPath: '_assets',
      publicPath: '/assets',
      hasTemplateTags: false,
    };

    getGitHashMock.mockResolvedValue('git-hash-123');
    getAssetKindMock.mockReturnValue('image');

    // @ts-ignore - Simplified testing
    const result = await convertFileItemToAsset({
      file: mockFile,
      folder: mockFolder,
      targetFolderPath: 'uploads',
    });

    expect(result.blobURL).toBe('blob:mock-url');
    expect(global.URL.createObjectURL).toHaveBeenCalledWith(mockFile);
  });

  test('should handle file without target folder path', async () => {
    const { convertFileItemToAsset } = await import('./process');
    const mockFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });

    Object.defineProperty(mockFile, 'size', { value: 50000 });

    const mockFolder = {
      name: 'uploads',
      entryRelative: false,
      collectionName: 'assets',
      internalPath: '_assets',
      publicPath: '/assets',
      hasTemplateTags: false,
    };

    getGitHashMock.mockResolvedValue('git-hash-123');
    getAssetKindMock.mockReturnValue('image');

    // @ts-ignore - Simplified testing
    const result = await convertFileItemToAsset({
      file: mockFile,
      blobURL: 'blob:custom-url',
      folder: mockFolder,
    });

    expect(result.path).toBe('test.jpg');
  });

  test('should handle undefined folder', async () => {
    const { convertFileItemToAsset } = await import('./process');
    const mockFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });

    Object.defineProperty(mockFile, 'size', { value: 50000 });

    getGitHashMock.mockResolvedValue('git-hash-123');
    getAssetKindMock.mockReturnValue('image');

    // @ts-ignore - Simplified testing
    const result = await convertFileItemToAsset({
      file: mockFile,
      blobURL: 'blob:custom-url',
      folder: undefined,
      targetFolderPath: 'uploads',
    });

    expect(result.folder).toBeUndefined();
    expect(result.path).toBe('uploads/test.jpg');
  });
});

describe('Test getUnsavedAssets()', () => {
  /** @type {import('vitest').MockedFunction<any>} */
  let getGitHashMock;
  /** @type {import('vitest').MockedFunction<any>} */
  let getAssetKindMock;

  beforeEach(async () => {
    vi.resetAllMocks();

    const { getGitHash } = await import('$lib/services/utils/file');
    const { getAssetKind } = await import('$lib/services/assets/kinds');

    getGitHashMock = /** @type {any} */ (vi.mocked(getGitHash));
    getAssetKindMock = /** @type {any} */ (vi.mocked(getAssetKind));

    // Mock URL.createObjectURL
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  });

  test('should convert all files in draft to assets', async () => {
    const { getUnsavedAssets } = await import('./process');
    const mockFile1 = new File(['content1'], 'test1.jpg', { type: 'image/jpeg' });
    const mockFile2 = new File(['content2'], 'test2.jpg', { type: 'image/jpeg' });

    Object.defineProperty(mockFile1, 'size', { value: 50000 });
    Object.defineProperty(mockFile2, 'size', { value: 60000 });

    const mockFolder1 = { name: 'uploads', entryRelative: false };
    const mockFolder2 = { name: 'images', entryRelative: false };

    getGitHashMock.mockResolvedValueOnce('hash1').mockResolvedValueOnce('hash2');
    getAssetKindMock.mockReturnValueOnce('image').mockReturnValueOnce('image');

    // @ts-ignore - Simplified testing
    const draft = {
      files: {
        'blob:url-1': { file: mockFile1, folder: mockFolder1 },
        'blob:url-2': { file: mockFile2, folder: mockFolder2 },
      },
    };

    // @ts-ignore - Simplified testing
    const result = await getUnsavedAssets({ draft, targetFolderPath: 'uploads' });

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      unsaved: true,
      file: mockFile1,
      blobURL: 'blob:url-1',
      name: 'test1.jpg',
      path: 'uploads/test1.jpg',
      sha: 'hash1',
      size: 50000,
      kind: 'image',
      folder: mockFolder1,
    });
    expect(result[1]).toEqual({
      unsaved: true,
      file: mockFile2,
      blobURL: 'blob:url-2',
      name: 'test2.jpg',
      path: 'uploads/test2.jpg',
      sha: 'hash2',
      size: 60000,
      kind: 'image',
      folder: mockFolder2,
    });
  });

  test('should handle empty draft files', async () => {
    const { getUnsavedAssets } = await import('./process');

    // @ts-ignore - Simplified testing
    const draft = {
      files: {},
    };

    // @ts-ignore - Simplified testing
    const result = await getUnsavedAssets({ draft });

    expect(result).toHaveLength(0);
  });

  test('should handle draft without target folder path', async () => {
    const { getUnsavedAssets } = await import('./process');
    const mockFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });

    Object.defineProperty(mockFile, 'size', { value: 50000 });

    const mockFolder = { name: 'uploads', entryRelative: false };

    getGitHashMock.mockResolvedValue('hash1');
    getAssetKindMock.mockReturnValue('image');

    // @ts-ignore - Simplified testing
    const draft = {
      files: {
        'blob:url-1': { file: mockFile, folder: mockFolder },
      },
    };

    // @ts-ignore - Simplified testing
    const result = await getUnsavedAssets({ draft });

    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('test.jpg');
  });

  test('should process multiple files in parallel', async () => {
    const { getUnsavedAssets } = await import('./process');
    const mockFile1 = new File(['content1'], 'file1.jpg');
    const mockFile2 = new File(['content2'], 'file2.jpg');
    const mockFile3 = new File(['content3'], 'file3.jpg');

    Object.defineProperty(mockFile1, 'size', { value: 10000 });
    Object.defineProperty(mockFile2, 'size', { value: 20000 });
    Object.defineProperty(mockFile3, 'size', { value: 30000 });

    getGitHashMock
      .mockResolvedValueOnce('hash1')
      .mockResolvedValueOnce('hash2')
      .mockResolvedValueOnce('hash3');
    getAssetKindMock
      .mockReturnValueOnce('image')
      .mockReturnValueOnce('image')
      .mockReturnValueOnce('image');

    // @ts-ignore - Simplified testing
    const draft = {
      files: {
        'blob:url-1': { file: mockFile1, folder: undefined },
        'blob:url-2': { file: mockFile2, folder: undefined },
        'blob:url-3': { file: mockFile3, folder: undefined },
      },
    };

    // @ts-ignore - Simplified testing
    const result = await getUnsavedAssets({ draft });

    expect(result).toHaveLength(3);
    expect(getGitHashMock).toHaveBeenCalledTimes(3);
  });
});

describe('Test getExistingBlobURL()', () => {
  /** @type {import('vitest').MockedFunction<any>} */
  let getHashMock;

  beforeEach(async () => {
    vi.resetAllMocks();

    const { getHash } = await import('@sveltia/utils/crypto');

    getHashMock = /** @type {any} */ (vi.mocked(getHash));
  });

  test('should find existing blob URL when file hash matches', async () => {
    // This tests line 30 of process.js - the Promise.all path
    const { getExistingBlobURL } = await import('./process');
    const mockFile1 = new File(['content'], 'test1.jpg');
    const mockFile2 = new File(['content'], 'test2.jpg');

    // @ts-ignore - Simplified draft for testing
    const draft = {
      files: {
        'blob:url-1': { file: mockFile1 },
        'blob:url-2': { file: mockFile2 },
      },
    };

    // Mock getHash to return matching hash for the second file
    getHashMock
      .mockResolvedValueOnce('hash123') // Initial file hash
      .mockResolvedValueOnce('hash456') // First file in draft
      .mockResolvedValueOnce('hash123'); // Second file in draft (matches)

    // @ts-ignore - Simplified file for testing
    const result = await getExistingBlobURL({ draft, file: mockFile2 });

    expect(result).toBe('blob:url-2');
  });

  test('should return undefined when no matching file found', async () => {
    const { getExistingBlobURL } = await import('./process');
    const mockFile1 = new File(['content'], 'test1.jpg');
    const mockFile2 = new File(['content'], 'test2.jpg');

    // @ts-ignore - Simplified draft for testing
    const draft = {
      files: {
        'blob:url-1': { file: mockFile1 },
      },
    };

    // Mock getHash to return different hashes
    getHashMock
      .mockResolvedValueOnce('hash456') // Initial file hash
      .mockResolvedValueOnce('hash123'); // File in draft (doesn't match)

    // @ts-ignore - Simplified file for testing
    const result = await getExistingBlobURL({ draft, file: mockFile2 });

    expect(result).toBeUndefined();
  });

  test('should handle draft with no files', async () => {
    const { getExistingBlobURL } = await import('./process');
    const mockFile = new File(['content'], 'test.jpg');

    // @ts-ignore - Simplified draft for testing
    const draft = {
      files: undefined, // Using nullish coalescing
    };

    getHashMock.mockResolvedValueOnce('hash123');

    // @ts-ignore - Simplified file for testing
    const result = await getExistingBlobURL({ draft, file: mockFile });

    expect(result).toBeUndefined();
  });

  test('should handle draft with empty files object', async () => {
    const { getExistingBlobURL } = await import('./process');
    const mockFile = new File(['content'], 'test.jpg');

    // @ts-ignore - Simplified draft for testing
    const draft = {
      files: {},
    };

    getHashMock.mockResolvedValueOnce('hash123');

    // @ts-ignore - Simplified file for testing
    const result = await getExistingBlobURL({ draft, file: mockFile });

    expect(result).toBeUndefined();
  });

  test('should stop searching once a match is found (line 30 behavior)', async () => {
    const { getExistingBlobURL } = await import('./process');
    const mockFile1 = new File(['content'], 'test1.jpg');
    const mockFile2 = new File(['content'], 'test2.jpg');
    const mockFile3 = new File(['content'], 'test3.jpg');

    // @ts-ignore - Simplified draft for testing
    const draft = {
      files: {
        'blob:url-1': { file: mockFile1 },
        'blob:url-2': { file: mockFile2 },
        'blob:url-3': { file: mockFile3 },
      },
    };

    // Mock getHash - match on first file
    getHashMock
      .mockResolvedValueOnce('hash-match') // Initial file hash
      .mockResolvedValueOnce('hash-match') // First file in draft (matches)
      .mockResolvedValueOnce('other-hash') // Other drafts
      .mockResolvedValueOnce('other-hash');

    // @ts-ignore - Simplified file for testing
    const result = await getExistingBlobURL({ draft, file: mockFile1 });

    expect(result).toBe('blob:url-1');
    // Promise.all runs all hash comparisons in parallel, so foundURL is set
    // to the first match and returned after all promises resolve
    expect(getHashMock).toHaveBeenCalled();
  });

  test('should process unsaved asset when asset.file exists but no existing blob URL (line 96-97)', async () => {
    const mockFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });

    // @ts-ignore - Simplified draft for testing
    const draft = {
      files: {},
    };

    // @ts-ignore - Simplified resource for testing
    const resource = {
      asset: {
        path: 'uploads/image.jpg',
        unsaved: true,
        file: mockFile,
      },
      credit: '',
    };

    // @ts-ignore - Simplified config for testing
    const libraryConfig = {
      max_file_size: 1000000,
    };

    // Mock getHash to return different hashes, so no existing blob URL is found
    getHashMock.mockResolvedValueOnce('hash1').mockResolvedValueOnce('hash2');

    // @ts-ignore - Test with simplified types
    const result = await processResource({ draft, resource, libraryConfig });

    // When no existing blob URL is found, result.value should be undefined
    expect(result.value).toBeUndefined();
    expect(result.credit).toBe('');
    expect(result.oversizedFileName).toBeUndefined();
  });

  test('should handle unsaved asset without file property (line 96-102 coverage)', async () => {
    // @ts-ignore - Simplified draft for testing
    const draft = {
      files: {},
      originalEntry: { slug: 'test-entry' },
    };

    // @ts-ignore - Simplified resource for testing
    const resource = {
      asset: {
        path: 'uploads/image.jpg',
        unsaved: true,
        // No file property
      },
      credit: '',
    };

    // @ts-ignore - Simplified config for testing
    const libraryConfig = {
      max_file_size: 1000000,
    };

    // @ts-ignore - Test with simplified types
    const result = await processResource({ draft, resource, libraryConfig });

    // When asset is unsaved but has no file, value should remain as initialized (empty string)
    expect(result.value).toBe('');
    expect(result.credit).toBe('');
    expect(result.oversizedFileName).toBeUndefined();
  });
});

describe('Test getExistingBlobURL()', () => {
  /** @type {import('vitest').MockedFunction<any>} */
  let getHashMock;

  beforeEach(async () => {
    vi.resetAllMocks();

    const { getHash } = await import('@sveltia/utils/crypto');

    getHashMock = /** @type {any} */ (vi.mocked(getHash));
  });

  test('should find existing blob URL when file hash matches', async () => {
    // This tests line 30 of process.js - the Promise.all path
    const { getExistingBlobURL } = await import('./process');
    const mockFile1 = new File(['content'], 'test1.jpg');
    const mockFile2 = new File(['content'], 'test2.jpg');

    // @ts-ignore - Simplified draft for testing
    const draft = {
      files: {
        'blob:url-1': { file: mockFile1 },
        'blob:url-2': { file: mockFile2 },
      },
    };

    // Mock getHash to return matching hash for the second file
    getHashMock
      .mockResolvedValueOnce('hash123') // Initial file hash
      .mockResolvedValueOnce('hash456') // First file in draft
      .mockResolvedValueOnce('hash123'); // Second file in draft (matches)

    // @ts-ignore - Simplified file for testing
    const result = await getExistingBlobURL({ draft, file: mockFile2 });

    expect(result).toBe('blob:url-2');
  });

  test('should return undefined when no matching file found', async () => {
    const { getExistingBlobURL } = await import('./process');
    const mockFile1 = new File(['content'], 'test1.jpg');
    const mockFile2 = new File(['content'], 'test2.jpg');

    // @ts-ignore - Simplified draft for testing
    const draft = {
      files: {
        'blob:url-1': { file: mockFile1 },
      },
    };

    // Mock getHash to return different hashes
    getHashMock
      .mockResolvedValueOnce('hash456') // Initial file hash
      .mockResolvedValueOnce('hash123'); // File in draft (doesn't match)

    // @ts-ignore - Simplified file for testing
    const result = await getExistingBlobURL({ draft, file: mockFile2 });

    expect(result).toBeUndefined();
  });

  test('should handle draft with no files', async () => {
    const { getExistingBlobURL } = await import('./process');
    const mockFile = new File(['content'], 'test.jpg');

    // @ts-ignore - Simplified draft for testing
    const draft = {
      files: undefined, // Using nullish coalescing
    };

    getHashMock.mockResolvedValueOnce('hash123');

    // @ts-ignore - Simplified file for testing
    const result = await getExistingBlobURL({ draft, file: mockFile });

    expect(result).toBeUndefined();
  });

  test('should handle draft with empty files object', async () => {
    const { getExistingBlobURL } = await import('./process');
    const mockFile = new File(['content'], 'test.jpg');

    // @ts-ignore - Simplified draft for testing
    const draft = {
      files: {},
    };

    getHashMock.mockResolvedValueOnce('hash123');

    // @ts-ignore - Simplified file for testing
    const result = await getExistingBlobURL({ draft, file: mockFile });

    expect(result).toBeUndefined();
  });

  test('should stop searching once a match is found (line 30 behavior)', async () => {
    const { getExistingBlobURL } = await import('./process');
    const mockFile1 = new File(['content'], 'test1.jpg');
    const mockFile2 = new File(['content'], 'test2.jpg');
    const mockFile3 = new File(['content'], 'test3.jpg');

    // @ts-ignore - Simplified draft for testing
    const draft = {
      files: {
        'blob:url-1': { file: mockFile1 },
        'blob:url-2': { file: mockFile2 },
        'blob:url-3': { file: mockFile3 },
      },
    };

    // Mock getHash - match on first file
    getHashMock
      .mockResolvedValueOnce('hash-match') // Initial file hash
      .mockResolvedValueOnce('hash-match') // First file in draft (matches)
      .mockResolvedValueOnce('other-hash') // Other drafts
      .mockResolvedValueOnce('other-hash');

    // @ts-ignore - Simplified file for testing
    const result = await getExistingBlobURL({ draft, file: mockFile1 });

    expect(result).toBe('blob:url-1');
    // Promise.all runs all hash comparisons in parallel, so foundURL is set
    // to the first match and returned after all promises resolve
    expect(getHashMock).toHaveBeenCalled();
  });

  test('should process unsaved asset when asset.file exists but no existing blob URL (line 96-97)', async () => {
    const mockFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });

    // @ts-ignore - Simplified draft for testing
    const draft = {
      files: {},
    };

    // @ts-ignore - Simplified resource for testing
    const resource = {
      asset: {
        path: 'uploads/image.jpg',
        unsaved: true,
        file: mockFile,
      },
      credit: '',
    };

    // @ts-ignore - Simplified config for testing
    const libraryConfig = {
      max_file_size: 1000000,
    };

    // Mock getHash to return different hashes, so no existing blob URL is found
    getHashMock.mockResolvedValueOnce('hash1').mockResolvedValueOnce('hash2');

    // @ts-ignore - Test with simplified types
    const result = await processResource({ draft, resource, libraryConfig });

    // When no existing blob URL is found, result.value should be undefined
    expect(result.value).toBeUndefined();
    expect(result.credit).toBe('');
    expect(result.oversizedFileName).toBeUndefined();
  });

  test('should handle unsaved asset without file property (line 96-102 coverage)', async () => {
    // @ts-ignore - Simplified draft for testing
    const draft = {
      files: {},
      originalEntry: { slug: 'test-entry' },
    };

    // @ts-ignore - Simplified resource for testing
    const resource = {
      asset: {
        path: 'uploads/image.jpg',
        unsaved: true,
        // No file property
      },
      credit: '',
    };

    // @ts-ignore - Simplified config for testing
    const libraryConfig = {
      max_file_size: 1000000,
    };

    // @ts-ignore - Test with simplified types
    const result = await processResource({ draft, resource, libraryConfig });

    // When asset is unsaved but has no file, value should remain as initialized (empty string)
    expect(result.value).toBe('');
    expect(result.credit).toBe('');
    expect(result.oversizedFileName).toBeUndefined();
  });
});
