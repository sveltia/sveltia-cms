import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('$lib/services/assets', () => ({
  getDuplicateFiles: vi.fn(() => []),
}));

describe('Test checkDuplicates()', () => {
  /** @type {import('vitest').MockedFunction<any>} */
  let getDuplicateFilesMock;
  /** @type {typeof import('./duplicates.svelte').checkDuplicates} */
  let checkDuplicates;
  /** @type {typeof import('./duplicates.svelte').duplicatesRequest} */
  let duplicatesRequest;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    const assetsModule = await import('$lib/services/assets');

    getDuplicateFilesMock = vi.mocked(assetsModule.getDuplicateFiles);

    ({ checkDuplicates, duplicatesRequest } = await import('./duplicates.svelte'));
  });

  test('should have no pending request initially', () => {
    expect(duplicatesRequest.current).toBeUndefined();
  });

  test('should return false immediately when there are no duplicate files', async () => {
    getDuplicateFilesMock.mockReturnValue([]);

    const result = await checkDuplicates({ files: [], listedAssets: [] });

    expect(result).toBe(false);
    expect(duplicatesRequest.current).toBeUndefined();
  });

  test('should set state with count and name of first duplicate when duplicates exist', async () => {
    const mockFiles = [new File(['a'], 'photo.jpg'), new File(['b'], 'video.mp4')];

    getDuplicateFilesMock.mockReturnValue(mockFiles);

    const resultPromise = checkDuplicates({ files: mockFiles, listedAssets: [] });

    // State is set synchronously before the promise awaits
    expect(duplicatesRequest.current?.count).toBe(2);
    expect(duplicatesRequest.current?.name).toBe('photo.jpg');
    expect(typeof duplicatesRequest.current?.respond).toBe('function');

    duplicatesRequest.current?.respond(undefined);
    await resultPromise;
  });

  test('should return true when resolve is answered with true (replace)', async () => {
    getDuplicateFilesMock.mockReturnValue([new File(['a'], 'image.png')]);

    const resultPromise = checkDuplicates({ files: [], listedAssets: [] });

    duplicatesRequest.current?.respond(true);

    expect(await resultPromise).toBe(true);
  });

  test('should return false when resolve is answered with false (keep both)', async () => {
    getDuplicateFilesMock.mockReturnValue([new File(['a'], 'image.png')]);

    const resultPromise = checkDuplicates({ files: [], listedAssets: [] });

    duplicatesRequest.current?.respond(false);

    expect(await resultPromise).toBe(false);
  });

  test('should return undefined when resolve is answered with undefined (cancel)', async () => {
    getDuplicateFilesMock.mockReturnValue([new File(['a'], 'image.png')]);

    const resultPromise = checkDuplicates({ files: [], listedAssets: [] });

    duplicatesRequest.current?.respond(undefined);

    expect(await resultPromise).toBeUndefined();
  });

  test('should take down the request once answered', async () => {
    getDuplicateFilesMock.mockReturnValue([new File(['a'], 'banner.jpg')]);

    const resultPromise = checkDuplicates({ files: [], listedAssets: [] });

    expect(duplicatesRequest.current).toBeDefined();

    duplicatesRequest.current?.respond(true);
    await resultPromise;

    expect(duplicatesRequest.current).toBeUndefined();
  });

  test('should use only the first duplicate name when multiple duplicates exist', async () => {
    const files = [
      new File(['a'], 'first.jpg'),
      new File(['b'], 'second.jpg'),
      new File(['c'], 'third.jpg'),
    ];

    getDuplicateFilesMock.mockReturnValue(files);

    const resultPromise = checkDuplicates({ files, listedAssets: [] });

    expect(duplicatesRequest.current?.count).toBe(3);
    expect(duplicatesRequest.current?.name).toBe('first.jpg');

    duplicatesRequest.current?.respond(undefined);
    await resultPromise;
  });

  test('should cancel a pending request once another one comes in', async () => {
    getDuplicateFilesMock.mockReturnValueOnce([new File(['a'], 'first.jpg')]);
    getDuplicateFilesMock.mockReturnValueOnce([new File(['b'], 'second.jpg')]);

    const firstPromise = checkDuplicates({ files: [], listedAssets: [] });
    const secondPromise = checkDuplicates({ files: [], listedAssets: [] });

    // The stale request is cancelled rather than left hanging, and the new one stays up
    expect(await firstPromise).toBeUndefined();
    expect(duplicatesRequest.current?.name).toBe('second.jpg');

    duplicatesRequest.current?.respond(true);

    expect(await secondPromise).toBe(true);
    expect(duplicatesRequest.current).toBeUndefined();
  });
});
