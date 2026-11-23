import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('$lib/services/assets', () => ({
  getDuplicateFiles: vi.fn(() => []),
}));

/**
 * Wait for the request to be posted, once the files have been read.
 */
const waitForRequest = async () => {
  const { duplicatesRequest } = await import('./duplicates.svelte');

  await vi.waitFor(() => expect(duplicatesRequest.current).toBeDefined());
};

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

    await waitForRequest();

    expect(duplicatesRequest.current?.count).toBe(2);
    expect(duplicatesRequest.current?.name).toBe('photo.jpg');
    expect(typeof duplicatesRequest.current?.respond).toBe('function');

    duplicatesRequest.current?.respond(undefined);
    await resultPromise;
  });

  test('should return true when resolve is answered with true (replace)', async () => {
    getDuplicateFilesMock.mockReturnValue([new File(['a'], 'image.png')]);

    const resultPromise = checkDuplicates({ files: [], listedAssets: [] });

    await waitForRequest();

    duplicatesRequest.current?.respond(true);

    expect(await resultPromise).toBe(true);
  });

  test('should return false when resolve is answered with false (keep both)', async () => {
    getDuplicateFilesMock.mockReturnValue([new File(['a'], 'image.png')]);

    const resultPromise = checkDuplicates({ files: [], listedAssets: [] });

    await waitForRequest();

    duplicatesRequest.current?.respond(false);

    expect(await resultPromise).toBe(false);
  });

  test('should return undefined when resolve is answered with undefined (cancel)', async () => {
    getDuplicateFilesMock.mockReturnValue([new File(['a'], 'image.png')]);

    const resultPromise = checkDuplicates({ files: [], listedAssets: [] });

    await waitForRequest();

    duplicatesRequest.current?.respond(undefined);

    expect(await resultPromise).toBeUndefined();
  });

  test('should take down the request once answered', async () => {
    getDuplicateFilesMock.mockReturnValue([new File(['a'], 'banner.jpg')]);

    const resultPromise = checkDuplicates({ files: [], listedAssets: [] });

    await waitForRequest();

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

    await waitForRequest();

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
    await waitForRequest();
    expect(duplicatesRequest.current?.name).toBe('second.jpg');

    duplicatesRequest.current?.respond(true);

    expect(await secondPromise).toBe(true);
    expect(duplicatesRequest.current).toBeUndefined();
  });

  test('should not count a file identical to the asset with the same name', async () => {
    const same = new File(['same'], 'photo.jpg');
    const other = new File(['other'], 'banner.jpg');
    const { getGitHash } = await import('$lib/services/utils/file');

    /** @type {any[]} */
    const listedAssets = [
      { name: 'Photo.jpg', sha: await getGitHash(new File(['same'], 'x')) },
      { name: 'banner.jpg', sha: await getGitHash(new File(['old'], 'x')) },
    ];

    getDuplicateFilesMock.mockReturnValue([same]);

    // The only file with a taken name is the same file, so there is nothing to ask
    expect(await checkDuplicates({ files: [same], listedAssets })).toBe(false);
    expect(duplicatesRequest.current).toBeUndefined();

    getDuplicateFilesMock.mockReturnValue([same, other]);

    const resultPromise = checkDuplicates({ files: [same, other], listedAssets });

    await waitForRequest();

    // Only the file that differs from the existing one is a conflict
    expect(duplicatesRequest.current?.count).toBe(1);
    expect(duplicatesRequest.current?.name).toBe('banner.jpg');

    duplicatesRequest.current?.respond(false);

    expect(await resultPromise).toBe(false);
  });

  test('should keep asking for a check followed by one without conflicts', async () => {
    getDuplicateFilesMock.mockReturnValueOnce([new File(['a'], 'first.jpg')]);
    getDuplicateFilesMock.mockReturnValueOnce([]);

    const firstPromise = checkDuplicates({ files: [], listedAssets: [] });
    const secondPromise = checkDuplicates({ files: [], listedAssets: [] });

    expect(await secondPromise).toBe(false);
    await waitForRequest();
    expect(duplicatesRequest.current?.name).toBe('first.jpg');

    duplicatesRequest.current?.respond(true);

    expect(await firstPromise).toBe(true);
  });

  test('should count a file that can no longer be read as a conflict', async () => {
    const file = new File(['a'], 'photo.jpg');

    vi.spyOn(file, 'arrayBuffer').mockRejectedValue(new DOMException('', 'NotFoundError'));
    vi.spyOn(file, 'stream').mockImplementation(() => {
      throw new DOMException('', 'NotFoundError');
    });
    getDuplicateFilesMock.mockReturnValue([file]);

    const resultPromise = checkDuplicates({
      files: [file],
      listedAssets: /** @type {any[]} */ ([{ name: 'photo.jpg', sha: 'x' }]),
    });

    await waitForRequest();

    expect(duplicatesRequest.current?.name).toBe('photo.jpg');

    duplicatesRequest.current?.respond(false);

    expect(await resultPromise).toBe(false);
  });

  test('should not let a failed check hold up the later ones', async () => {
    getDuplicateFilesMock.mockImplementationOnce(() => {
      throw new Error('failed');
    });

    await expect(checkDuplicates({ files: [], listedAssets: [] })).rejects.toThrow('failed');

    getDuplicateFilesMock.mockReturnValue([]);

    expect(await checkDuplicates({ files: [], listedAssets: [] })).toBe(false);
  });
});
