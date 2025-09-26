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

    getHashMock = vi.mocked(getHash);
    equalMock = vi.mocked(equal);
    domPurifyMock = vi.mocked(sanitize);
    getMock = vi.mocked(get);
    getAssetPublicURLMock = vi.mocked(getAssetPublicURL);
    transformFileMock = vi.mocked(transformFile);
    getGitHashMock = vi.mocked(getGitHash);

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
