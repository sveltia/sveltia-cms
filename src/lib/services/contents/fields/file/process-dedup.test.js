import { beforeEach, describe, expect, test, vi } from 'vitest';

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
  allAssets: /** @type {any} */ ({
    subscribe: vi.fn(),
    set: vi.fn(),
    update: vi.fn(),
  }),
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

describe('Test getExistingBlobURL() entry-relative folder handling', () => {
  /** @type {import('vitest').MockedFunction<any>} */
  let getHashMock;
  /** @type {import('vitest').MockedFunction<any>} */
  let equalMock;

  beforeEach(async () => {
    vi.resetAllMocks();

    const { getHash } = await import('@sveltia/utils/crypto');
    const equal = (await import('fast-deep-equal')).default;

    getHashMock = /** @type {any} */ (vi.mocked(getHash));
    equalMock = /** @type {any} */ (vi.mocked(equal));
  });

  test('should not deduplicate files across different entry-relative folders', async () => {
    const { getExistingBlobURL } = await import('./process');
    const mockFile = new File(['content'], 'test.jpg');
    const existingFile = new File(['content'], 'existing.jpg');
    const folder1 = { internalPath: 'images1', entryRelative: true };
    const folder2 = { internalPath: 'images2', entryRelative: true };

    // @ts-ignore - Simplified draft for testing
    const draft = {
      files: {
        'blob:url-1': { file: existingFile, folder: folder1 },
      },
    };

    // Same content hash but different entry-relative folders
    getHashMock.mockResolvedValueOnce('same-hash').mockResolvedValueOnce('same-hash');
    equalMock.mockReturnValue(false);

    // @ts-ignore - Simplified for testing
    const result = await getExistingBlobURL({ draft, file: mockFile, folder: folder2 });

    expect(result).toBeUndefined();
  });

  test('should deduplicate files in same entry-relative folder', async () => {
    const { getExistingBlobURL } = await import('./process');
    const mockFile = new File(['content'], 'test.jpg');
    const existingFile = new File(['content'], 'existing.jpg');
    const folder = { internalPath: 'images1', entryRelative: true };

    // @ts-ignore - Simplified draft for testing
    const draft = {
      files: {
        'blob:url-1': { file: existingFile, folder },
      },
    };

    getHashMock.mockResolvedValueOnce('same-hash').mockResolvedValueOnce('same-hash');
    equalMock.mockReturnValue(true);

    // @ts-ignore - Simplified for testing
    const result = await getExistingBlobURL({ draft, file: mockFile, folder });

    expect(result).toBe('blob:url-1');
  });

  test('should deduplicate files by hash only for non-entry-relative folders', async () => {
    const { getExistingBlobURL } = await import('./process');
    const mockFile = new File(['content'], 'test.jpg');
    const existingFile = new File(['content'], 'existing.jpg');
    const folder1 = { internalPath: 'images1', entryRelative: false };
    const folder2 = { internalPath: 'images2', entryRelative: false };

    // @ts-ignore - Simplified draft for testing
    const draft = {
      files: {
        'blob:url-1': { file: existingFile, folder: folder1 },
      },
    };

    // Same hash, different non-entry-relative folders - should still deduplicate
    getHashMock.mockResolvedValueOnce('same-hash').mockResolvedValueOnce('same-hash');

    // @ts-ignore - Simplified for testing
    const result = await getExistingBlobURL({ draft, file: mockFile, folder: folder2 });

    expect(result).toBe('blob:url-1');
  });

  test('should deduplicate files by hash only when no folder is provided', async () => {
    const { getExistingBlobURL } = await import('./process');
    const mockFile = new File(['content'], 'test.jpg');
    const existingFile = new File(['content'], 'existing.jpg');

    // @ts-ignore - Simplified draft for testing
    const draft = {
      files: {
        'blob:url-1': {
          file: existingFile,
          folder: { internalPath: 'images', entryRelative: true },
        },
      },
    };

    getHashMock.mockResolvedValueOnce('same-hash').mockResolvedValueOnce('same-hash');

    // @ts-ignore - Simplified for testing
    const result = await getExistingBlobURL({ draft, file: mockFile });

    expect(result).toBe('blob:url-1');
  });
});
