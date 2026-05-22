import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('$lib/services/assets', () => ({
  getDuplicateFiles: vi.fn(() => []),
}));

describe('Test checkDuplicates()', () => {
  /** @type {import('vitest').MockedFunction<any>} */
  let getDuplicateFilesMock;
  /** @type {typeof import('./duplicates.svelte').checkDuplicates} */
  let checkDuplicates;
  /** @type {typeof import('./duplicates.svelte').duplicates} */
  let duplicates;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    const assetsModule = await import('$lib/services/assets');

    getDuplicateFilesMock = vi.mocked(assetsModule.getDuplicateFiles);

    ({ checkDuplicates, duplicates } = await import('./duplicates.svelte'));
  });

  test('default resolve should be a no-op when state has not been activated', () => {
    expect(() => duplicates.resolve(undefined)).not.toThrow();
    expect(duplicates.showDialog).toBe(false);
  });

  test('should return false immediately when there are no duplicate files', async () => {
    getDuplicateFilesMock.mockReturnValue([]);

    const result = await checkDuplicates({ files: [], listedAssets: [] });

    expect(result).toBe(false);
    expect(duplicates.showDialog).toBe(false);
    expect(duplicates.count).toBe(0);
  });

  test('should set state with count and name of first duplicate when duplicates exist', async () => {
    const mockFiles = [new File(['a'], 'photo.jpg'), new File(['b'], 'video.mp4')];

    getDuplicateFilesMock.mockReturnValue(mockFiles);

    const resultPromise = checkDuplicates({ files: mockFiles, listedAssets: [] });

    // State is set synchronously before the promise awaits
    expect(duplicates.showDialog).toBe(true);
    expect(duplicates.count).toBe(2);
    expect(duplicates.name).toBe('photo.jpg');
    expect(typeof duplicates.resolve).toBe('function');

    duplicates.resolve(undefined);
    await resultPromise;
  });

  test('should return true when resolve is called with true (replace)', async () => {
    getDuplicateFilesMock.mockReturnValue([new File(['a'], 'image.png')]);

    const resultPromise = checkDuplicates({ files: [], listedAssets: [] });

    duplicates.resolve(true);

    expect(await resultPromise).toBe(true);
  });

  test('should return false when resolve is called with false (keep both)', async () => {
    getDuplicateFilesMock.mockReturnValue([new File(['a'], 'image.png')]);

    const resultPromise = checkDuplicates({ files: [], listedAssets: [] });

    duplicates.resolve(false);

    expect(await resultPromise).toBe(false);
  });

  test('should return undefined when resolve is called with undefined (cancel)', async () => {
    getDuplicateFilesMock.mockReturnValue([new File(['a'], 'image.png')]);

    const resultPromise = checkDuplicates({ files: [], listedAssets: [] });

    duplicates.resolve(undefined);

    expect(await resultPromise).toBeUndefined();
  });

  test('should reset state to defaults after promise resolves', async () => {
    getDuplicateFilesMock.mockReturnValue([new File(['a'], 'banner.jpg')]);

    const resultPromise = checkDuplicates({ files: [], listedAssets: [] });

    expect(duplicates.showDialog).toBe(true);

    duplicates.resolve(true);
    await resultPromise;

    expect(duplicates.showDialog).toBe(false);
    expect(duplicates.count).toBe(0);
    expect(duplicates.name).toBe('');
  });

  test('should use only the first duplicate name when multiple duplicates exist', async () => {
    const files = [
      new File(['a'], 'first.jpg'),
      new File(['b'], 'second.jpg'),
      new File(['c'], 'third.jpg'),
    ];

    getDuplicateFilesMock.mockReturnValue(files);

    const resultPromise = checkDuplicates({ files, listedAssets: [] });

    expect(duplicates.count).toBe(3);
    expect(duplicates.name).toBe('first.jpg');

    duplicates.resolve(undefined);
    await resultPromise;
  });
});
