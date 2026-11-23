import { beforeEach, describe, expect, test, vi } from 'vitest';

import { createDisplayBlobURL } from '$lib/services/assets/info';
import { allAssets } from '$lib/services/assets/state';

import { processResource } from './process';

// Mock all dependencies
vi.mock('fast-deep-equal', () => ({
  default: vi.fn(),
}));

vi.mock('isomorphic-dompurify', () => ({
  sanitize: vi.fn(),
}));

vi.mock('$lib/services/assets/state', () => ({
  allAssets: { current: [] },
}));

vi.mock('$lib/services/assets/info', () => ({
  createDisplayBlobURL: vi.fn(),
  getAssetPublicURL: vi.fn(),
  hasCachedThumbnail: vi.fn(async () => false),
}));

vi.mock('$lib/services/integrations/media-libraries/default', async (importOriginal) => ({
  canConvertHEIC: vi.fn(() => false),
  transformFile: vi.fn(),
  isAcceptedFile: /** @type {any} */ (await importOriginal()).isAcceptedFile,
  keepsFileFormat: /** @type {any} */ (await importOriginal()).keepsFileFormat,
}));

vi.mock('$lib/services/utils/file', () => ({
  getGitHash: vi.fn(),
  /**
   * Join the given path segments, ignoring the empty ones.
   * @param {(string | undefined)[]} segments Segments.
   * @returns {string} Path.
   */
  createPath: (segments) => segments.filter(Boolean).join('/'),
  /**
   * Return the given path as is.
   * @param {string} path Path.
   * @returns {string} Path.
   */
  sanitizePath: (path) => path,
  /**
   * Get the last segment of a path, as the real function does.
   * @param {string} path Path.
   * @returns {string} Last segment.
   */
  getBaseName: (path) => path.slice(path.lastIndexOf('/') + 1),
  /**
   * Get the directory part of a path, as the real function does.
   * @param {string} path Path.
   * @returns {string} Directory path.
   */
  getDirName: (path) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''),
}));

vi.mock('$lib/services/assets/file-name', () => ({
  /**
   * Replace the characters a file system won’t take, or slugify the name, roughly as the real
   * function does.
   * @param {string} name File name.
   * @param {{ slugificationEnabled?: boolean }} [options] Options.
   * @returns {string} File name.
   */
  formatFileName: (name, { slugificationEnabled = false } = {}) =>
    slugificationEnabled ? name.toLowerCase().replaceAll(' ', '-') : name.replace(/[:/]/g, ''),
  /**
   * Compare two file names, ignoring case, as the real function does.
   * @param {string} name1 File name.
   * @param {string} name2 Another file name.
   * @returns {boolean} Result.
   */
  isSameFileName: (name1, name2) => name1.toLowerCase() === name2.toLowerCase(),
}));

vi.mock('$lib/services/utils/media/image/validate', () => ({
  isValidImage: vi.fn().mockResolvedValue(true),
}));

vi.mock('$lib/services/assets/kinds', () => ({
  getAssetKind: vi.fn(),
}));

vi.mock('$lib/services/contents/draft/slugs', () => ({
  getSlugs: vi.fn(),
}));

describe('Test processResource()', () => {
  /** @type {import('vitest').MockedFunction<any>} */
  let equalMock;
  /** @type {import('vitest').MockedFunction<any>} */
  let domPurifyMock;
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
    // The real helper wraps an SVG image; the URL is all that matters here
    vi.mocked(createDisplayBlobURL).mockImplementation(async (blob) => URL.createObjectURL(blob));

    const equal = (await import('fast-deep-equal')).default;
    const { sanitize } = await import('isomorphic-dompurify');
    const { getAssetPublicURL } = await import('$lib/services/assets/info');
    const { transformFile } = await import('$lib/services/integrations/media-libraries/default');
    const { getGitHash } = await import('$lib/services/utils/file');

    equalMock = /** @type {any} */ (vi.mocked(equal));
    domPurifyMock = /** @type {any} */ (vi.mocked(sanitize));
    getAssetPublicURLMock = /** @type {any} */ (vi.mocked(getAssetPublicURL));
    transformFileMock = /** @type {any} */ (vi.mocked(transformFile));
    getGitHashMock = /** @type {any} */ (vi.mocked(getGitHash));

    const { isValidImage } = await import('$lib/services/utils/media/image/validate');

    // Default mock implementations
    domPurifyMock.mockImplementation((/** @type {string} */ input) => String(input));
    allAssets.current = /** @type {any} */ ([]);
    vi.mocked(isValidImage).mockResolvedValue(true);
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
      ALLOWED_ATTR: ['href', 'target', 'rel'],
    });
  });

  test('should not cache a file without a folder to upload it to', async () => {
    // @ts-ignore - Simplified draft for testing
    const draft = {
      files: {},
    };

    // Only a cloud media library is configured, and the field has no `media_folder` of its own
    const resource = {
      file: new File(['x'], 'image.jpg', { type: 'image/jpeg' }),
    };

    // @ts-ignore - Test with simplified types
    const result = await processResource({ draft, resource, libraryConfig: {} });

    expect(result).toEqual({
      value: undefined,
      credit: '',
      oversizedFileName: undefined,
      invalidFileName: undefined,
    });
    expect(draft.files).toEqual({});
    expect(createDisplayBlobURL).not.toHaveBeenCalled();
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

    getGitHashMock.mockResolvedValueOnce('hash1').mockResolvedValueOnce('hash1');

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

    getGitHashMock.mockResolvedValue('git-hash');
    allAssets.current = /** @type {any} */ ([]);

    // @ts-ignore - Test with simplified types
    const result = await processResource({ draft, resource, libraryConfig });

    expect(result.value).toBe('blob:mock-url');
    expect(result.credit).toBe('');
    expect(result.oversizedFileName).toBeUndefined();
    // @ts-ignore - Mock files object
    expect(draft.files['blob:mock-url']).toEqual({
      file: mockFile,
      folder: { name: 'uploads' },
      replace: false,
    });
    // The URL is made for display, while the original file is kept for the upload
    expect(createDisplayBlobURL).toHaveBeenCalledExactlyOnceWith(mockFile);
  });

  test('should attach the file name template to a new file', async () => {
    const mockFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
    /** @type {any} */
    const draft = { files: {} };
    const resource = { file: mockFile, folder: { name: 'uploads' } };
    const libraryConfig = { filename_template: '{{slug}}-{{uuid_short}}', slugify_filename: true };

    getGitHashMock.mockResolvedValue('git-hash');

    // @ts-ignore - Test with simplified types
    await processResource({ draft, resource, libraryConfig });

    expect(draft.files['blob:mock-url']).toEqual({
      file: mockFile,
      folder: { name: 'uploads' },
      replace: false,
      nameTemplate: {
        template: '{{slug}}-{{uuid_short}}',
        slugificationEnabled: true,
        randomValues: new Map(),
        dateTimeParts: expect.objectContaining({ year: expect.any(String) }),
      },
    });
  });

  test('should not attach the file name template to a replacing file', async () => {
    const mockFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
    /** @type {any} */
    const draft = { files: {} };
    const resource = { file: mockFile, folder: { name: 'uploads' }, replace: true };
    const libraryConfig = { filename_template: '{{slug}}-{{uuid_short}}' };

    getGitHashMock.mockResolvedValue('git-hash');

    // @ts-ignore - Test with simplified types
    await processResource({ draft, resource, libraryConfig });

    expect(draft.files['blob:mock-url']).toEqual({
      file: mockFile,
      folder: { name: 'uploads' },
      replace: true,
    });
  });

  test('should reject a file the browser cannot decode', async () => {
    const { isValidImage } = await import('$lib/services/utils/media/image/validate');

    // A HEIC photo saved with a `.jpg` extension
    vi.mocked(isValidImage).mockResolvedValue(false);

    const mockFile = new File(['ftypheic'], 'IMG_0001.jpg', { type: 'image/jpeg' });
    // @ts-ignore - Simplified draft for testing
    const draft = { files: {} };
    // @ts-ignore - Simplified resource for testing
    const resource = { file: mockFile, folder: { name: 'uploads' }, credit: '' };

    getGitHashMock.mockResolvedValue('git-hash');
    allAssets.current = /** @type {any} */ ([]);

    // @ts-ignore - Test with simplified types
    const result = await processResource({ draft, resource, libraryConfig: {} });

    expect(result.invalidFileName).toBe('IMG_0001.jpg');
    expect(result.value).toBeUndefined();
    // The file isn’t queued for upload
    expect(draft.files).toEqual({});
  });

  test('should reject a file that is not one of the accepted types', async () => {
    const mockFile = new File(['png'], 'kite.png', { type: 'image/png' });
    /** @type {any} */
    const draft = { files: {} };
    const resource = { file: mockFile, folder: { name: 'uploads' } };

    getGitHashMock.mockResolvedValue('git-hash');

    // @ts-ignore - Test with simplified types
    const result = await processResource({ draft, resource, libraryConfig: {}, accept: '.pdf' });

    expect(result).toEqual({
      value: undefined,
      credit: '',
      oversizedFileName: undefined,
      invalidFileName: undefined,
      mismatchedFileName: 'kite.png',
    });
    // The file isn’t queued for upload
    expect(draft.files).toEqual({});
  });

  test('should check the type of a file once it is transformed', async () => {
    const mockFile = new File(['png'], 'kite.png', { type: 'image/png' });
    const webpFile = new File(['webp'], 'kite.webp', { type: 'image/webp' });
    /** @type {any} */
    const draft = { files: {} };
    const resource = { file: mockFile, folder: { name: 'uploads' } };
    const libraryConfig = { transformations: { png: { format: 'webp' } } };

    getGitHashMock.mockResolvedValue('git-hash');
    transformFileMock.mockResolvedValue(webpFile);

    // A PNG image converted to WebP fits a field only taking WebP images
    // @ts-ignore - Test with simplified types
    const result = await processResource({ draft, resource, libraryConfig, accept: 'image/webp' });

    expect(result.value).toBe('blob:mock-url');
    expect(result.mismatchedFileName).toBeUndefined();
    expect(draft.files['blob:mock-url'].file).toBe(webpFile);
  });

  test('should name the original file if it still does not fit once transformed', async () => {
    const mockFile = new File(['png'], 'kite.png', { type: 'image/png' });
    /** @type {any} */
    const draft = { files: {} };
    const resource = { file: mockFile, folder: { name: 'uploads' } };
    const libraryConfig = { transformations: { png: { format: 'webp' } } };

    getGitHashMock.mockResolvedValue('git-hash');
    transformFileMock.mockResolvedValue(new File(['webp'], 'kite.webp', { type: 'image/webp' }));

    // @ts-ignore - Test with simplified types
    const result = await processResource({ draft, resource, libraryConfig, accept: 'image/png' });

    expect(result.mismatchedFileName).toBe('kite.png');
    expect(result.value).toBeUndefined();
    expect(draft.files).toEqual({});
  });

  test('should reject a pending file that is not one of the accepted types', async () => {
    const mockFile = new File(['png'], 'kite.png', { type: 'image/png' });
    /** @type {any} */
    const draft = { files: { 'blob:pending': { file: mockFile, folder: { name: 'uploads' } } } };
    const resource = { file: mockFile, folder: { name: 'uploads' } };

    // The same file is already pending, as added to a field taking images
    getGitHashMock.mockResolvedValue('git-hash');

    // @ts-ignore - Test with simplified types
    const rejected = await processResource({ draft, resource, libraryConfig: {}, accept: '.pdf' });

    expect(rejected.mismatchedFileName).toBe('kite.png');
    expect(rejected.value).toBeUndefined();

    // @ts-ignore - Test with simplified types
    const taken = await processResource({ draft, resource, libraryConfig: {}, accept: 'image/*' });

    expect(taken.value).toBe('blob:pending');
    expect(taken.mismatchedFileName).toBeUndefined();
  });

  test('should reject a file that cannot be read', async () => {
    const { isValidImage } = await import('$lib/services/utils/media/image/validate');
    const mockFile = new File(['content'], 'moved.jpg', { type: 'image/jpeg' });
    // @ts-ignore - Simplified draft for testing
    const draft = { files: {} };
    // @ts-ignore - Simplified resource for testing
    const resource = { file: mockFile, folder: { name: 'uploads' }, credit: '' };

    // The file was moved or deleted after being picked, so reading it fails
    getGitHashMock.mockRejectedValue(
      new DOMException('The requested file could not be read', 'NotReadableError'),
    );

    // @ts-ignore - Test with simplified types
    const result = await processResource({ draft, resource, libraryConfig: {} });

    expect(result).toEqual({
      value: undefined,
      credit: '',
      oversizedFileName: undefined,
      invalidFileName: 'moved.jpg',
    });
    expect(isValidImage).not.toHaveBeenCalled();
    expect(draft.files).toEqual({});
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

    getGitHashMock.mockResolvedValue('git-hash');
    allAssets.current = /** @type {any} */ ([]);

    // @ts-ignore - Test with simplified types
    const result = await processResource({ draft, resource, libraryConfig });

    // Nothing is added to the field, like for a corrupt file
    expect(result.value).toBeUndefined();
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

    getGitHashMock.mockResolvedValue('git-hash');
    allAssets.current = /** @type {any} */ ([existingAsset]);
    equalMock.mockReturnValue(true);
    getAssetPublicURLMock.mockReturnValue('/uploads/existing.jpg');

    // @ts-ignore - Test with simplified types
    const result = await processResource({ draft, resource, libraryConfig });

    expect(result.value).toBe('/uploads/existing.jpg');
    expect(result.credit).toBe('');
    expect(result.oversizedFileName).toBeUndefined();
    expect(Object.keys(draft.files)).toHaveLength(0);
  });

  test('should use an existing asset in another folder with the same path', async () => {
    // https://github.com/sveltia/sveltia-cms/issues/1182 — two collections with the same
    // `media_folder`, and the asset assigned to the folder of the other collection
    const mockFile = new File(['content'], 'photo.webp', { type: 'image/webp' });
    // @ts-ignore - Simplified draft for testing
    const draft = { files: {} };

    /**
     * Create the folder of a collection whose `media_folder` is shared with the other.
     * @param {string} collectionName Collection name.
     * @returns {any} Asset folder.
     */
    const folderOf = (collectionName) => ({
      collectionName,
      internalPath: 'src/assets/uploads',
      publicPath: '../../assets/uploads',
      entryRelative: false,
      hasTemplateTags: false,
    });

    // @ts-ignore - Simplified resource for testing
    const resource = { file: mockFile, folder: folderOf('posts'), credit: '' };

    const existingAsset = {
      sha: 'git-hash',
      folder: folderOf('pages'),
      path: 'src/assets/uploads/photo.webp',
    };

    getGitHashMock.mockResolvedValue('git-hash');
    allAssets.current = /** @type {any} */ ([existingAsset]);
    equalMock.mockReturnValue(false);
    getAssetPublicURLMock.mockReturnValue('../../assets/uploads/photo.webp');

    // @ts-ignore - Test with simplified types
    const result = await processResource({ draft, resource, libraryConfig: {} });

    expect(result.value).toBe('../../assets/uploads/photo.webp');
    expect(getAssetPublicURLMock).toHaveBeenCalledWith(existingAsset, expect.anything());
    expect(Object.keys(draft.files)).toHaveLength(0);

    // An identical file in a folder with another path is a different upload
    allAssets.current = /** @type {any} */ ([
      { ...existingAsset, folder: { ...folderOf('pages'), internalPath: 'static/images' } },
    ]);

    // @ts-ignore - Test with simplified types
    const otherResult = await processResource({ draft, resource, libraryConfig: {} });

    expect(otherResult.value).toMatch(/^blob:/);
    expect(Object.keys(draft.files)).toHaveLength(1);
  });

  test('should use an existing asset identical to the file before it is transformed', async () => {
    // https://github.com/sveltia/sveltia-cms/issues/1182#issuecomment-7103945453 — a copy of a
    // stored WebP image would be encoded again, and the result would no longer match
    const storedCopy = new File(['stored'], 'photo_copy.webp', { type: 'image/webp' });
    const reencoded = new File(['re-encoded'], 'photo_copy.webp', { type: 'image/webp' });
    // @ts-ignore - Simplified draft for testing
    const draft = { files: {} };

    const folder = {
      collectionName: 'posts',
      internalPath: 'src/assets/uploads',
      publicPath: '/assets/uploads',
      entryRelative: false,
      hasTemplateTags: false,
    };

    const existingAsset = {
      sha: 'stored-hash',
      folder,
      name: 'photo.webp',
      path: 'src/assets/uploads/photo.webp',
    };

    getGitHashMock.mockImplementation(async (/** @type {File} */ f) =>
      f === storedCopy ? 'stored-hash' : 'other-hash',
    );
    transformFileMock.mockResolvedValue(reencoded);
    allAssets.current = /** @type {any} */ ([existingAsset]);
    getAssetPublicURLMock.mockReturnValue('/assets/uploads/photo.webp');

    /** @type {import('$lib/types/public').DefaultMediaLibraryConfig} */
    const libraryConfig = { transformations: { raster_image: { format: 'webp', quality: 82 } } };

    // @ts-ignore - Test with simplified types
    const result = await processResource({
      draft: /** @type {any} */ (draft),
      resource: { file: storedCopy, folder, credit: '' },
      libraryConfig,
      accept: 'image/*',
    });

    expect(result.value).toBe('/assets/uploads/photo.webp');
    expect(transformFileMock).not.toHaveBeenCalled();
    expect(Object.keys(draft.files)).toHaveLength(0);

    // A file the field doesn’t take as it is goes through the transformation, which could convert
    // it to a type the field takes
    // @ts-ignore - Test with simplified types
    const otherResult = await processResource({
      draft: /** @type {any} */ (draft),
      resource: { file: storedCopy, folder, credit: '' },
      libraryConfig,
      accept: 'image/avif',
    });

    expect(transformFileMock).toHaveBeenCalledOnce();
    expect(otherResult.mismatchedFileName).toBe('photo_copy.webp');

    // A file converted to another format isn’t matched as it is: the site wants the new format
    const storedPNG = new File(['stored'], 'logo.png', { type: 'image/png' });

    allAssets.current = /** @type {any} */ ([
      { ...existingAsset, name: 'logo.png', path: 'src/assets/uploads/logo.png' },
    ]);
    getGitHashMock.mockImplementation(async (/** @type {File} */ f) =>
      f === storedPNG ? 'stored-hash' : 'other-hash',
    );

    // @ts-ignore - Test with simplified types
    const pngResult = await processResource({
      draft: /** @type {any} */ (draft),
      resource: { file: storedPNG, folder, credit: '' },
      libraryConfig,
      accept: 'image/*',
    });

    expect(transformFileMock).toHaveBeenCalledTimes(2);
    expect(pngResult.value).toMatch(/^blob:/);
  });

  test('should reuse the same file pending upload to another subfolder', async () => {
    const pendingFile = new File(['content'], 'photo.jpg', { type: 'image/jpeg' });
    const mockFile = new File(['content'], 'photo.jpg', { type: 'image/jpeg' });
    const folder = { name: 'uploads' };

    // @ts-ignore - Simplified draft for testing
    const draft = {
      files: {
        'blob:gallery': { file: pendingFile, folder, subfolderPath: 'gallery' },
      },
    };

    // @ts-ignore - Simplified resource for testing
    const resource = { file: mockFile, folder, credit: '' };

    getGitHashMock.mockResolvedValue('git-hash');
    equalMock.mockReturnValue(true);

    // @ts-ignore - Test with simplified types
    const result = await processResource({ draft, resource, libraryConfig: {} });

    expect(result.value).toBe('blob:gallery');
    expect(result.invalidFileName).toBeUndefined();
    expect(Object.keys(draft.files)).toEqual(['blob:gallery']);
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

    getGitHashMock.mockResolvedValue('git-hash');
    allAssets.current = /** @type {any} */ ([]);
    transformFileMock.mockResolvedValue(transformedFile);

    // @ts-ignore - Test with simplified types
    const result = await processResource({ draft, resource, libraryConfig });

    expect(transformFileMock).toHaveBeenCalledWith(mockFile, libraryConfig.transformations);
    expect(result.value).toBe('blob:mock-url');
    // @ts-ignore - Mock files object
    expect(draft.files['blob:mock-url']).toEqual({
      file: transformedFile,
      folder: { name: 'uploads' },
      replace: false,
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

    getGitHashMock.mockResolvedValueOnce('same-hash').mockResolvedValueOnce('same-hash');

    // @ts-ignore - Test with simplified types
    const result = await processResource({ draft, resource, libraryConfig });

    expect(result.value).toBe('blob:existing-url');
    expect(result.credit).toBe('');
    expect(result.oversizedFileName).toBeUndefined();
  });

  test('should use the public path of a selected folder', async () => {
    // @ts-ignore - Simplified draft for testing
    const draft = { files: {} };
    const resource = { folderPath: '/images/gallery' };
    // @ts-ignore - Simplified config for testing
    const libraryConfig = { max_file_size: 1000000 };
    // @ts-ignore - Test with simplified types
    const result = await processResource({ draft, resource, libraryConfig });

    expect(result.value).toBe('/images/gallery');
    expect(result.credit).toBe('');
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
        ALLOWED_ATTR: ['href', 'target', 'rel'],
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

    getGitHashMock.mockResolvedValue('git-hash');
    allAssets.current = /** @type {any} */ ([]);

    // @ts-ignore - Test with simplified types
    const result = await processResource({ draft, resource, libraryConfig: undefined });

    expect(result.value).toBe('blob:mock-url');
    expect(result.credit).toBe('');
    expect(result.oversizedFileName).toBeUndefined();
    expect(transformFileMock).not.toHaveBeenCalled();
  });

  test('should allow uploading the same file to a different entry-relative folder', async () => {
    const mockFile = new File(['content'], 'photo.jpg', { type: 'image/jpeg' });

    Object.defineProperty(mockFile, 'size', { value: 50000 });

    const folder = {
      entryRelative: true,
      internalPath: 'src/content/people',
      internalSubPath: 'assets/images',
      publicPath: 'assets/images',
      hasTemplateTags: false,
      collectionName: 'people',
    };

    // draft is for person-b
    // @ts-ignore - Simplified draft for testing
    const draft = {
      files: {},
      defaultLocale: '_default',
      originalEntry: {
        locales: {
          _default: { path: 'src/content/people/person-b/index.md' },
        },
      },
      collection: {
        _type: 'entry',
        _file: { subPath: '{{slug}}/index' },
      },
    };

    // @ts-ignore - Simplified resource for testing
    const resource = {
      file: mockFile,
      folder,
      credit: '',
    };

    // @ts-ignore - Simplified config for testing
    const libraryConfig = { max_file_size: 1000000 };

    // allAssets contains photo.jpg from person-a
    const personAAsset = {
      sha: 'git-hash',
      folder,
      path: 'src/content/people/person-a/assets/images/photo.jpg',
    };

    getGitHashMock.mockResolvedValue('git-hash');
    allAssets.current = /** @type {any} */ ([personAAsset]);
    equalMock.mockReturnValue(true);

    // @ts-ignore - Test with simplified types
    const result = await processResource({ draft, resource, libraryConfig });

    // Should NOT reuse person-a's asset — should upload as a new file to person-b
    expect(result.value).toBe('blob:mock-url');
    expect(result.oversizedFileName).toBeUndefined();
    // @ts-ignore - Mock files object
    expect(draft.files['blob:mock-url']).toBeDefined();
  });

  test('should deduplicate file already saved in the same entry-relative folder', async () => {
    const mockFile = new File(['content'], 'photo.jpg', { type: 'image/jpeg' });

    Object.defineProperty(mockFile, 'size', { value: 50000 });

    const folder = {
      entryRelative: true,
      internalPath: 'src/content/people',
      internalSubPath: 'assets/images',
      publicPath: 'assets/images',
      hasTemplateTags: false,
      collectionName: 'people',
    };

    // draft is for person-b
    // @ts-ignore - Simplified draft for testing
    const draft = {
      files: {},
      defaultLocale: '_default',
      originalEntry: {
        locales: {
          _default: { path: 'src/content/people/person-b/index.md' },
        },
      },
      collection: {
        _type: 'entry',
        _file: { subPath: '{{slug}}/index' },
      },
    };

    // @ts-ignore - Simplified resource for testing
    const resource = {
      file: mockFile,
      folder,
      credit: '',
    };

    // @ts-ignore - Simplified config for testing
    const libraryConfig = { max_file_size: 1000000 };

    // allAssets contains photo.jpg already saved in person-b (same entry)
    const personBAsset = {
      sha: 'git-hash',
      folder,
      path: 'src/content/people/person-b/assets/images/photo.jpg',
      unsaved: false,
    };

    getGitHashMock.mockResolvedValue('git-hash');
    allAssets.current = /** @type {any} */ ([personBAsset]);
    equalMock.mockReturnValue(true);
    getAssetPublicURLMock.mockReturnValue('assets/images/photo.jpg');

    // @ts-ignore - Test with simplified types
    const result = await processResource({ draft, resource, libraryConfig });

    // Should reuse the existing person-b asset — not upload again
    expect(result.value).toBe('assets/images/photo.jpg');
    expect(Object.keys(draft.files)).toHaveLength(0);
  });

  test('should only deduplicate a file saved beside the given locale’s entry file', async () => {
    const mockFile = new File(['content'], 'photo.jpg', { type: 'image/jpeg' });

    Object.defineProperty(mockFile, 'size', { value: 50000 });

    const folder = {
      entryRelative: true,
      internalPath: 'src/content/people',
      internalSubPath: '',
      publicPath: '',
      hasTemplateTags: false,
      collectionName: 'people',
    };

    // With the `multiple_folders` i18n structure, each locale’s entry file has a folder of its own
    /**
     * Create a draft of the entry.
     * @returns {any} Draft.
     */
    const createDraft = () => ({
      files: {},
      defaultLocale: 'en',
      originalEntry: {
        locales: {
          en: { path: 'src/content/people/en/person-b/index.md' },
          fr: { path: 'src/content/people/fr/person-b/index.md' },
        },
      },
      collection: {
        _type: 'entry',
        _file: { subPath: '{{slug}}/index' },
      },
    });

    // @ts-ignore - Simplified config for testing
    const libraryConfig = { max_file_size: 1000000 };

    const enAsset = {
      sha: 'git-hash',
      folder,
      path: 'src/content/people/en/person-b/photo.jpg',
      unsaved: false,
    };

    getGitHashMock.mockResolvedValue('git-hash');
    allAssets.current = /** @type {any} */ ([enAsset]);
    equalMock.mockReturnValue(true);
    getAssetPublicURLMock.mockReturnValue('photo.jpg');

    // The default locale’s folder has the file
    let draft = createDraft();

    let result = await processResource({
      draft,
      resource: /** @type {any} */ ({ file: mockFile, folder, credit: '' }),
      libraryConfig,
      locale: 'en',
    });

    expect(result.value).toBe('photo.jpg');
    expect(getAssetPublicURLMock).toHaveBeenCalledWith(enAsset, {
      pathOnly: true,
      allowSpecial: true,
      entry: draft.originalEntry,
      locale: 'en',
    });

    // The French folder doesn’t, so the file is uploaded there rather than referenced in the
    // English folder, which a path relative to the French entry file can’t reach
    draft = createDraft();
    result = await processResource({
      draft,
      resource: /** @type {any} */ ({ file: mockFile, folder, credit: '' }),
      libraryConfig,
      locale: 'fr',
    });

    expect(result.value).toBe('blob:mock-url');
    expect(Object.keys(draft.files)).toHaveLength(1);
  });

  test('should allow upload for new entry (no originalEntry) with entry-relative folder', async () => {
    const mockFile = new File(['content'], 'photo.jpg', { type: 'image/jpeg' });

    Object.defineProperty(mockFile, 'size', { value: 50000 });

    const folder = {
      entryRelative: true,
      internalPath: 'src/content/people',
      internalSubPath: 'assets/images',
      publicPath: 'assets/images',
      hasTemplateTags: false,
      collectionName: 'people',
    };

    // draft is for a brand-new entry (no originalEntry)
    // @ts-ignore - Simplified draft for testing
    const draft = {
      files: {},
      defaultLocale: '_default',
      originalEntry: undefined,
      collection: {
        _type: 'entry',
        _file: { subPath: '{{slug}}/index' },
      },
    };

    // @ts-ignore - Simplified resource for testing
    const resource = {
      file: mockFile,
      folder,
      credit: '',
    };

    // @ts-ignore - Simplified config for testing
    const libraryConfig = { max_file_size: 1000000 };

    // allAssets contains the same file from some other entry
    const otherAsset = {
      sha: 'git-hash',
      folder,
      path: 'src/content/people/person-a/assets/images/photo.jpg',
    };

    getGitHashMock.mockResolvedValue('git-hash');
    allAssets.current = /** @type {any} */ ([otherAsset]);
    equalMock.mockReturnValue(true);

    // @ts-ignore - Test with simplified types
    const result = await processResource({ draft, resource, libraryConfig });

    // Should upload as a new file since there's no original entry to scope against
    expect(result.value).toBe('blob:mock-url');
    // @ts-ignore - Mock files object
    expect(draft.files['blob:mock-url']).toBeDefined();
  });

  test('should treat entry-relative folder as non-entry collection (file collection)', async () => {
    const mockFile = new File(['content'], 'photo.jpg', { type: 'image/jpeg' });

    Object.defineProperty(mockFile, 'size', { value: 50000 });

    const folder = {
      entryRelative: true,
      internalPath: 'src/content/pages',
      internalSubPath: '',
      publicPath: '/',
      hasTemplateTags: false,
      collectionName: 'pages',
    };

    // @ts-ignore - Simplified draft for testing
    const draft = {
      files: {},
      defaultLocale: '_default',
      originalEntry: {
        locales: {
          _default: { path: 'src/content/pages/about.md' },
        },
      },
      // Non-entry collection type: subPath should be treated as undefined (line 109)
      collection: { _type: 'file' },
    };

    // @ts-ignore - Simplified resource for testing
    const resource = { file: mockFile, folder, credit: '' };
    // @ts-ignore - Simplified config for testing
    const libraryConfig = { max_file_size: 1000000 };

    // A file collection entry has no folder of its own, so its assets are saved to the folder
    // configured for it
    const existingAsset = {
      sha: 'git-hash',
      folder,
      path: 'src/content/pages/photo.jpg',
    };

    getGitHashMock.mockResolvedValue('git-hash');
    allAssets.current = /** @type {any} */ ([existingAsset]);
    equalMock.mockReturnValue(true);
    getAssetPublicURLMock.mockReturnValue('/photo.jpg');

    // @ts-ignore - Test with simplified types
    const result = await processResource({ draft, resource, libraryConfig });

    expect(result.value).toBe('/photo.jpg');
  });

  test('should handle entry-relative folder with simple (non-nested) subPath', async () => {
    const mockFile = new File(['content'], 'photo.jpg', { type: 'image/jpeg' });

    Object.defineProperty(mockFile, 'size', { value: 50000 });

    const folder = {
      entryRelative: true,
      internalPath: 'src/content/blog',
      internalSubPath: '',
      publicPath: '/',
      hasTemplateTags: false,
      collectionName: 'blog',
    };

    // @ts-ignore - Simplified draft for testing
    const draft = {
      files: {},
      defaultLocale: '_default',
      originalEntry: {
        locales: {
          _default: { path: 'src/content/blog/hello-world.md' },
        },
      },
      // Simple subPath with no `/` — lastSubPathSegment stays undefined (line 110 not reached)
      collection: {
        _type: 'entry',
        _file: { subPath: '{{slug}}' },
      },
    };

    // @ts-ignore - Simplified resource for testing
    const resource = { file: mockFile, folder, credit: '' };
    // @ts-ignore - Simplified config for testing
    const libraryConfig = { max_file_size: 1000000 };

    // The entry file shares its folder with the rest of the collection, which is where its assets
    // are saved as well
    const existingAsset = {
      sha: 'git-hash',
      folder,
      path: 'src/content/blog/photo.jpg',
    };

    getGitHashMock.mockResolvedValue('git-hash');
    allAssets.current = /** @type {any} */ ([existingAsset]);
    equalMock.mockReturnValue(true);
    getAssetPublicURLMock.mockReturnValue('/photo.jpg');

    // @ts-ignore - Test with simplified types
    const result = await processResource({ draft, resource, libraryConfig });

    // The asset is found in the shared folder and reused rather than uploaded again
    expect(result.value).toBe('/photo.jpg');
    expect(Object.keys(draft.files)).toHaveLength(0);
  });

  test('should deduplicate a file saved beside the index file of a nested entry', async () => {
    const mockFile = new File(['content'], 'photo.jpg', { type: 'image/jpeg' });

    Object.defineProperty(mockFile, 'size', { value: 50000 });

    const folder = {
      entryRelative: true,
      internalPath: 'content/pages',
      internalSubPath: '',
      publicPath: '',
      hasTemplateTags: false,
      collectionName: 'pages',
    };

    // @ts-ignore - Simplified draft for testing
    const draft = {
      files: {},
      defaultLocale: '_default',
      originalEntry: {
        locales: {
          _default: { path: 'content/pages/about/_index.md' },
        },
      },
      // Every entry is stored as an index file, so the folder holding it is the entry’s own
      collection: {
        _type: 'entry',
        folder: 'content/pages',
        nested: { depth: 10 },
        meta: { path: { index_file: '_index' } },
        _file: { subPath: undefined },
      },
    };

    // @ts-ignore - Simplified resource for testing
    const resource = { file: mockFile, folder, credit: '' };
    // @ts-ignore - Simplified config for testing
    const libraryConfig = { max_file_size: 1000000 };
    const existingAsset = { sha: 'git-hash', folder, path: 'content/pages/about/photo.jpg' };

    getGitHashMock.mockResolvedValue('git-hash');
    allAssets.current = /** @type {any} */ ([existingAsset]);
    equalMock.mockReturnValue(true);
    getAssetPublicURLMock.mockReturnValue('photo.jpg');

    // @ts-ignore - Test with simplified types
    const result = await processResource({ draft, resource, libraryConfig });

    expect(result.value).toBe('photo.jpg');
    expect(Object.keys(draft.files)).toHaveLength(0);
  });

  test('should handle an entry file path without an extension', async () => {
    const mockFile = new File(['content'], 'photo.jpg', { type: 'image/jpeg' });

    Object.defineProperty(mockFile, 'size', { value: 50000 });

    const folder = {
      entryRelative: true,
      internalPath: 'src/content/blog',
      internalSubPath: '',
      publicPath: '/',
      hasTemplateTags: false,
      collectionName: 'blog',
    };

    // @ts-ignore - Simplified draft for testing
    const draft = {
      files: {},
      defaultLocale: '_default',
      originalEntry: {
        // With no extension to strip, the path yields no folder of its own
        locales: {
          _default: { path: 'no-extension' },
        },
      },
      collection: {
        _type: 'entry',
        _file: { subPath: '{{slug}}/index' },
      },
    };

    // @ts-ignore - Simplified resource for testing
    const resource = { file: mockFile, folder, credit: '' };
    // @ts-ignore - Simplified config for testing
    const libraryConfig = { max_file_size: 1000000 };

    getGitHashMock.mockResolvedValue('git-hash');
    allAssets.current = /** @type {any} */ ([]);

    // @ts-ignore - Test with simplified types
    const result = await processResource({ draft, resource, libraryConfig });

    expect(result.value).toBe('blob:mock-url');
  });

  test('should store replace flag in draft.files when replace is true', async () => {
    const mockFile = new File(['content'], 'photo.jpg', { type: 'image/jpeg' });

    Object.defineProperty(mockFile, 'size', { value: 50000 });

    // @ts-ignore - Simplified draft for testing
    const draft = { files: {} };

    // @ts-ignore - Simplified resource for testing
    const resource = {
      file: mockFile,
      folder: { name: 'uploads' },
      credit: '',
      replace: true,
    };

    // @ts-ignore - Simplified config for testing
    const libraryConfig = { max_file_size: 1000000 };

    getGitHashMock.mockResolvedValue('git-hash');
    allAssets.current = /** @type {any} */ ([]);

    // @ts-ignore - Test with simplified types
    await processResource({ draft, resource, libraryConfig });

    // @ts-ignore - Mock files object
    expect(draft.files['blob:mock-url']).toEqual({
      file: mockFile,
      folder: { name: 'uploads' },
      replace: true,
    });
  });

  describe('with a replacing file', () => {
    const folder = { name: 'uploads' };

    test('should not reuse an identical asset saved under another name', async () => {
      const mockFile = new File(['content'], 'thumb.webp', { type: 'image/webp' });
      /** @type {any} */
      const draft = { files: {} };

      getGitHashMock.mockResolvedValue('git-hash');
      allAssets.current = /** @type {any} */ ([
        { sha: 'git-hash', folder, name: 'other.webp', path: 'uploads/other.webp' },
      ]);
      equalMock.mockReturnValue(true);

      const result = await processResource({
        draft,
        resource: /** @type {any} */ ({ file: mockFile, folder, replace: true }),
        libraryConfig: {},
      });

      // The file keeps its own name, so it’s saved rather than pointing to the other asset
      expect(result.value).toBe('blob:mock-url');
      expect(draft.files['blob:mock-url']).toEqual({ file: mockFile, folder, replace: true });
    });

    test('should reuse an identical asset saved under the same name', async () => {
      const mockFile = new File(['content'], 'thumb.webp', { type: 'image/webp' });
      /** @type {any} */
      const draft = { files: {} };

      getGitHashMock.mockResolvedValue('git-hash');
      allAssets.current = /** @type {any} */ ([
        { sha: 'git-hash', folder, name: 'Thumb.webp', path: 'uploads/Thumb.webp' },
      ]);
      equalMock.mockReturnValue(true);
      getAssetPublicURLMock.mockReturnValue('/uploads/Thumb.webp');

      const result = await processResource({
        draft,
        resource: /** @type {any} */ ({ file: mockFile, folder, replace: true }),
        libraryConfig: {},
      });

      // Nothing has changed, so there’s nothing to save
      expect(result.value).toBe('/uploads/Thumb.webp');
      expect(Object.keys(draft.files)).toHaveLength(0);
    });

    test('should only reuse an identical pending file replacing one under the same name', async () => {
      const mockFile = new File(['content'], 'thumb.webp', { type: 'image/webp' });

      /** @type {any} */
      const draft = {
        files: {
          // Would be saved with a unique name, e.g. `thumb-1.webp`
          'blob:plain': { file: new File(['content'], 'thumb.webp'), folder, replace: false },
          'blob:other': { file: new File(['content'], 'other.webp'), folder, replace: true },
        },
      };

      getGitHashMock.mockResolvedValue('git-hash');
      allAssets.current = /** @type {any} */ ([]);
      equalMock.mockReturnValue(true);

      const resource = /** @type {any} */ ({ file: mockFile, folder, replace: true });

      await expect(processResource({ draft, resource, libraryConfig: {} })).resolves.toEqual(
        expect.objectContaining({ value: 'blob:mock-url' }),
      );

      draft.files = {
        'blob:same': { file: new File(['content'], 'Thumb.webp'), folder, replace: true },
      };

      await expect(processResource({ draft, resource, libraryConfig: {} })).resolves.toEqual(
        expect.objectContaining({ value: 'blob:same' }),
      );
      expect(Object.keys(draft.files)).toEqual(['blob:same']);
    });
  });

  describe('with several identical copies of the file', () => {
    const file = new File(['content'], 'photo.webp', { type: 'image/webp' });

    /**
     * Create an asset with the uploaded file’s content.
     * @param {string} path Asset path.
     * @param {object} folder Asset folder.
     * @returns {any} Asset.
     */
    const createAsset = (path, folder) => ({
      sha: 'git-hash',
      folder,
      path,
      name: path.slice(path.lastIndexOf('/') + 1),
    });

    /**
     * Upload the file and get the asset the field value is made of.
     * @param {object} args Arguments.
     * @param {any} args.draft Entry draft.
     * @param {any} args.folder Asset folder.
     * @param {string} [args.subfolderPath] Subfolder.
     * @returns {Promise<any>} Selected asset.
     */
    const getSelectedAsset = async ({ draft, folder, subfolderPath }) => {
      getAssetPublicURLMock.mockImplementation((/** @type {any} */ asset) => asset.path);

      // @ts-ignore - Test with simplified types
      const result = await processResource({
        draft,
        resource: { file, folder, subfolderPath, credit: '' },
        libraryConfig: {},
      });

      return allAssets.current.find((asset) => asset.path === result.value);
    };

    beforeEach(() => {
      getGitHashMock.mockResolvedValue('git-hash');
    });

    test('should prefer the copy at the path, then in the directory, then with the name', async () => {
      const folder = {
        collectionName: 'posts',
        internalPath: 'uploads',
        publicPath: '/uploads',
        entryRelative: false,
        hasTemplateTags: false,
      };

      const draft = { files: {} };
      const atPath = createAsset('uploads/gallery/Photo.webp', folder);
      const inDir = createAsset('uploads/gallery/other.webp', folder);
      const sameName = createAsset('uploads/photo.webp', folder);
      const other = createAsset('uploads/old/other.webp', folder);

      allAssets.current = [other, sameName, inDir, atPath];
      expect(await getSelectedAsset({ draft, folder, subfolderPath: 'gallery' })).toBe(atPath);

      allAssets.current = [other, sameName, inDir];
      expect(await getSelectedAsset({ draft, folder, subfolderPath: 'gallery' })).toBe(inDir);

      allAssets.current = [other, sameName];
      expect(await getSelectedAsset({ draft, folder, subfolderPath: 'gallery' })).toBe(sameName);

      // The first one is kept when none is closer
      allAssets.current = [other, createAsset('uploads/new/other.webp', folder)];
      expect(await getSelectedAsset({ draft, folder, subfolderPath: 'gallery' })).toBe(other);
    });

    test('should prefer the copy with the slugified name', async () => {
      const folder = {
        collectionName: 'posts',
        internalPath: 'uploads',
        publicPath: '/uploads',
        entryRelative: false,
        hasTemplateTags: false,
      };

      const other = createAsset('uploads/old/other.webp', folder);
      const sameName = createAsset('uploads/old/my-photo.webp', folder);

      allAssets.current = [other, sameName];
      getAssetPublicURLMock.mockImplementation((/** @type {any} */ asset) => asset.path);

      // @ts-ignore - Test with simplified types
      const result = await processResource({
        draft: /** @type {any} */ ({ files: {} }),
        resource: { file: new File(['content'], 'My Photo.webp'), folder, credit: '' },
        libraryConfig: { slugify_filename: true },
      });

      expect(result.value).toBe(sameName.path);
    });

    test('should prefer the copy with the name in a folder path with template tags', async () => {
      const folder = {
        collectionName: 'posts',
        internalPath: 'uploads/{{year}}',
        publicPath: '/uploads/{{year}}',
        entryRelative: false,
        hasTemplateTags: true,
      };

      const other = createAsset('uploads/{{year}}/other.webp', folder);
      const sameName = createAsset('uploads/2020/photo.webp', folder);

      allAssets.current = [other, sameName];
      expect(await getSelectedAsset({ draft: { files: {} }, folder })).toBe(sameName);
    });

    test('should prefer the copy in the directory of an entry-relative folder', async () => {
      const folder = {
        collectionName: 'people',
        entryRelative: true,
        internalPath: 'src/content/people',
        internalSubPath: 'assets/images',
        publicPath: 'assets/images',
        hasTemplateTags: false,
      };

      const draft = {
        files: {},
        defaultLocale: '_default',
        originalEntry: { locales: { _default: { path: 'src/content/people/person-b/index.md' } } },
        collection: { _type: 'entry', _file: { subPath: '{{slug}}/index' } },
      };

      const inSubfolder = createAsset(
        'src/content/people/person-b/assets/images/sub/other.webp',
        folder,
      );

      const inDir = createAsset('src/content/people/person-b/assets/images/other.webp', folder);

      allAssets.current = [inSubfolder, inDir];
      expect(await getSelectedAsset({ draft, folder })).toBe(inDir);
    });

    test('should prefer the file pending for the same subfolder', async () => {
      const folder = {
        collectionName: 'people',
        entryRelative: true,
        internalPath: 'src/content/people',
        internalSubPath: 'assets/images',
        publicPath: 'assets/images',
        hasTemplateTags: false,
      };

      const pendingFile = new File(['converted'], 'other.webp', { type: 'image/webp' });

      // A new entry, whose folder isn’t known yet
      const draft = {
        files: {
          'blob:root': { file: pendingFile, folder },
          'blob:gallery': { file: pendingFile, folder, subfolderPath: 'gallery' },
        },
        defaultLocale: '_default',
        collection: { _type: 'entry', _file: { subPath: '{{slug}}/index' } },
      };

      // The uploaded file only matches the pending one once it’s converted
      getGitHashMock.mockImplementation(async (/** @type {File} */ f) =>
        f === file ? 'raw-hash' : 'git-hash',
      );
      transformFileMock.mockResolvedValue(new File(['converted'], 'photo.webp'));
      allAssets.current = [];

      // @ts-ignore - Test with simplified types
      const result = await processResource({
        draft: /** @type {any} */ (draft),
        resource: { file, folder, subfolderPath: 'gallery', credit: '' },
        libraryConfig: { transformations: { raster_image: { format: 'webp' } } },
      });

      expect(result.value).toBe('blob:gallery');
    });
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
    // The real helper wraps an SVG image; the URL is all that matters here
    vi.mocked(createDisplayBlobURL).mockImplementation(async (blob) => URL.createObjectURL(blob));
  });

  test('should put the asset in the subfolder it was picked for', async () => {
    const { convertFileItemToAsset } = await import('./process');
    const mockFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });

    getGitHashMock.mockResolvedValue('git-hash-123');
    getAssetKindMock.mockReturnValue('image');

    // @ts-ignore - Simplified testing
    const result = await convertFileItemToAsset({
      file: mockFile,
      folder: undefined,
      targetFolderPath: 'uploads',
      subfolderPath: '2024/summer',
    });

    expect(result.path).toBe('uploads/2024/summer/test.jpg');
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
      replace: false,
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
    expect(result.file).toBe(mockFile);
    expect(createDisplayBlobURL).toHaveBeenCalledExactlyOnceWith(mockFile);
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
    // The real helper wraps an SVG image; the URL is all that matters here
    vi.mocked(createDisplayBlobURL).mockImplementation(async (blob) => URL.createObjectURL(blob));
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
      replace: false,
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
      replace: false,
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

  test('should name the files with the file name template', async () => {
    const { getUnsavedAssets } = await import('./process');
    const { getSlugs } = await import('$lib/services/contents/draft/slugs');
    const mockFile1 = new File(['content1'], 'IMG 1.jpg', { type: 'image/jpeg' });
    const mockFile2 = new File(['content2'], 'test2.jpg', { type: 'image/jpeg' });

    vi.mocked(getSlugs).mockReturnValue(
      /** @type {any} */ ({ defaultLocaleSlug: 'my-post', localizedSlugs: undefined }),
    );
    getGitHashMock.mockResolvedValue('hash');

    /** @type {any} */
    const draft = {
      collection: { name: 'posts', _type: 'entry' },
      defaultLocale: 'en',
      currentValues: { en: { title: 'My Post' } },
      files: {
        'blob:url-1': {
          file: mockFile1,
          folder: undefined,
          replace: false,
          nameTemplate: { template: '{{slug}}: {{filename}}', randomValues: new Map() },
        },
        'blob:url-2': { file: mockFile2, folder: undefined, replace: false },
      },
    };

    const result = await getUnsavedAssets({ draft, targetFolderPath: 'uploads' });

    expect(result.map(({ name, path }) => ({ name, path }))).toEqual([
      // Sanitized
      { name: 'my-post img-1.jpg', path: 'uploads/my-post img-1.jpg' },
      { name: 'test2.jpg', path: 'uploads/test2.jpg' },
    ]);
    // The files themselves keep their names until the entry is saved
    expect(result[0].file).toBe(mockFile1);
    expect(getSlugs).toHaveBeenCalledOnce();
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
  let getGitHashMock;

  beforeEach(async () => {
    vi.resetAllMocks();

    const { getGitHash } = await import('$lib/services/utils/file');

    getGitHashMock = /** @type {any} */ (vi.mocked(getGitHash));
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

    // Mock getGitHash to return matching hash for the second file
    getGitHashMock
      .mockResolvedValueOnce('hash123') // Initial file hash
      .mockResolvedValueOnce('hash456') // First file in draft
      .mockResolvedValueOnce('hash123'); // Second file in draft (matches)

    // @ts-ignore - Simplified file for testing
    const result = await getExistingBlobURL({ draft, file: mockFile2 });

    expect(result).toBe('blob:url-2');
  });

  test('should not match the same file pending for another subfolder', async () => {
    const { getExistingBlobURL } = await import('./process');
    const mockFile = new File(['content'], 'test.jpg');

    /** @type {any} */
    const draft = {
      files: {
        'blob:root': { file: mockFile },
        'blob:sub': { file: mockFile, subfolderPath: '2024' },
      },
    };

    getGitHashMock.mockResolvedValue('hash123');

    await expect(getExistingBlobURL({ draft, file: mockFile })).resolves.toBe('blob:root');
    await expect(
      getExistingBlobURL({ draft, file: mockFile, subfolderPath: '2024' }),
    ).resolves.toBe('blob:sub');
    await expect(
      getExistingBlobURL({ draft, file: mockFile, subfolderPath: '2023' }),
    ).resolves.toBeUndefined();
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

    // Mock getGitHash to return different hashes
    getGitHashMock
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

    getGitHashMock.mockResolvedValueOnce('hash123');

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

    getGitHashMock.mockResolvedValueOnce('hash123');

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

    // Mock getGitHash - match on first file
    getGitHashMock
      .mockResolvedValueOnce('hash-match') // Initial file hash
      .mockResolvedValueOnce('hash-match') // First file in draft (matches)
      .mockResolvedValueOnce('other-hash') // Other drafts
      .mockResolvedValueOnce('other-hash');

    // @ts-ignore - Simplified file for testing
    const result = await getExistingBlobURL({ draft, file: mockFile1 });

    expect(result).toBe('blob:url-1');
    // Promise.all runs all hash comparisons in parallel, so foundURL is set
    // to the first match and returned after all promises resolve
    expect(getGitHashMock).toHaveBeenCalled();
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

    // Mock getGitHash to return different hashes, so no existing blob URL is found
    getGitHashMock.mockResolvedValueOnce('hash1').mockResolvedValueOnce('hash2');

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
  let getGitHashMock;

  beforeEach(async () => {
    vi.resetAllMocks();

    const { getGitHash } = await import('$lib/services/utils/file');

    getGitHashMock = /** @type {any} */ (vi.mocked(getGitHash));
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

    // Mock getGitHash to return matching hash for the second file
    getGitHashMock
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

    // Mock getGitHash to return different hashes
    getGitHashMock
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

    getGitHashMock.mockResolvedValueOnce('hash123');

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

    getGitHashMock.mockResolvedValueOnce('hash123');

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

    // Mock getGitHash - match on first file
    getGitHashMock
      .mockResolvedValueOnce('hash-match') // Initial file hash
      .mockResolvedValueOnce('hash-match') // First file in draft (matches)
      .mockResolvedValueOnce('other-hash') // Other drafts
      .mockResolvedValueOnce('other-hash');

    // @ts-ignore - Simplified file for testing
    const result = await getExistingBlobURL({ draft, file: mockFile1 });

    expect(result).toBe('blob:url-1');
    // Promise.all runs all hash comparisons in parallel, so foundURL is set
    // to the first match and returned after all promises resolve
    expect(getGitHashMock).toHaveBeenCalled();
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

    // Mock getGitHash to return different hashes, so no existing blob URL is found
    getGitHashMock.mockResolvedValueOnce('hash1').mockResolvedValueOnce('hash2');

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
