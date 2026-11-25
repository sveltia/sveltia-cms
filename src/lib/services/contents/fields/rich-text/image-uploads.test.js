import { beforeEach, describe, expect, test, vi } from 'vitest';

import { cmsConfig } from '$lib/services/config/state';
import { processResource } from '$lib/services/contents/fields/file/process';
import { processResources } from '$lib/services/contents/fields/file/resources';
import {
  getImageSrcFieldConfig,
  insertInlineImages,
  insertSelectedImages,
  sortDroppedImages,
} from '$lib/services/contents/fields/rich-text/image-uploads';
import { getGitHash } from '$lib/services/utils/file';

vi.mock('$lib/services/contents/fields/file/process', () => ({ processResource: vi.fn() }));
vi.mock('$lib/services/contents/fields/file/resources', async (importOriginal) => ({
  .../** @type {object} */ (await importOriginal()),
  processResources: vi.fn(),
}));
vi.mock('$lib/services/utils/file', { spy: true });

/**
 * @import { MediaFieldAssetOptions } from '$lib/services/contents/fields/file/resources';
 */

describe('getImageSrcFieldConfig()', () => {
  test('returns the `src` field of the image component', () => {
    const src = { name: 'src', widget: 'image' };

    expect(
      getImageSrcFieldConfig(
        /** @type {any} */ ({ fields: [{ name: 'alt', widget: 'string' }, src] }),
      ),
    ).toBe(src);
    expect(getImageSrcFieldConfig(undefined)).toBeUndefined();
    expect(getImageSrcFieldConfig(/** @type {any} */ ({}))).toBeUndefined();
  });
});

describe('sortDroppedImages()', () => {
  const file = new File(['x'], 'photo.png', { type: 'image/png' });
  const images = [{ file, alt: 'Photo' }, { src: 'https://example.com/remote.png' }];

  /**
   * Build the asset options.
   * @param {Partial<MediaFieldAssetOptions>} [options] Options to override.
   * @returns {MediaFieldAssetOptions} Options.
   */
  const getAssetOptions = (options = {}) =>
    /** @type {MediaFieldAssetOptions} */ ({
      folderMap: /** @type {any} */ ({}),
      folder: /** @type {any} */ ({ internalPath: 'static/uploads' }),
      enabled: true,
      libraryConfig: /** @type {any} */ ({}),
      cloudServiceEntries: /** @type {any} */ ([['aws_s3', { upload: vi.fn() }]]),
      ...options,
    });

  beforeEach(() => {
    cmsConfig.current = /** @type {any} */ ({});
  });

  test('inserts every image right away when files go to the repository', () => {
    expect(
      sortDroppedImages({ images, srcFieldConfig: undefined, assetOptions: getAssetOptions() }),
    ).toEqual({ inlineImages: images, uploadFiles: [], rejected: false });
  });

  test('uploads the files to the cloud service marked as the default', () => {
    cmsConfig.current = /** @type {any} */ ({ media_libraries: { aws_s3: { default: true } } });

    expect(
      sortDroppedImages({ images, srcFieldConfig: undefined, assetOptions: getAssetOptions() }),
    ).toEqual({ inlineImages: [images[1]], uploadFiles: [file], rejected: false });
  });

  test('rejects the files when no location can take them', () => {
    expect(
      sortDroppedImages({
        images,
        srcFieldConfig: undefined,
        assetOptions: getAssetOptions({ enabled: false, cloudServiceEntries: [] }),
      }),
    ).toEqual({ inlineImages: [images[1]], uploadFiles: [], rejected: true });
    expect(
      sortDroppedImages({
        images: [images[1]],
        srcFieldConfig: undefined,
        assetOptions: getAssetOptions({ enabled: false, cloudServiceEntries: [] }),
      }),
    ).toEqual({ inlineImages: [images[1]], uploadFiles: [], rejected: false });
  });
});

describe('image insertion', () => {
  const file = new File(['x'], 'photo.png', { type: 'image/png' });
  /** @type {any} */
  const draft = { id: 'draft' };
  /** @type {any} */
  const folder = { internalPath: 'static/uploads' };
  /** @type {any} */
  const libraryConfig = { max_file_size: 1000 };
  const insertImage = vi.fn();

  /**
   * Build the arguments shared by both functions.
   * @param {() => boolean} [isCurrent] Function to check whether the content is still shown.
   * @returns {any} Arguments.
   */
  const getArgs = (isCurrent = () => true) => ({
    draft,
    folder,
    libraryConfig,
    locale: 'en',
    isCurrent,
    insertImage,
  });

  describe('insertInlineImages()', () => {
    test('saves files and inserts every image in order', async () => {
      vi.mocked(processResource).mockResolvedValue(
        /** @type {any} */ ({ value: '/uploads/a.png' }),
      );

      const done = await insertInlineImages({
        ...getArgs(),
        images: [{ file, alt: 'A' }, { src: 'https://example.com/b.png' }, { src: '' }],
      });

      expect(done).toBe(true);
      expect(processResource).toHaveBeenCalledExactlyOnceWith({
        draft,
        resource: { file, folder },
        libraryConfig,
        locale: 'en',
      });
      expect(insertImage.mock.calls).toEqual([
        ['/uploads/a.png', 'A'],
        ['https://example.com/b.png', ''],
      ]);
    });

    test('skips a file that couldn’t be saved', async () => {
      vi.mocked(processResource).mockResolvedValue(/** @type {any} */ ({ value: undefined }));

      expect(await insertInlineImages({ ...getArgs(), images: [{ file }] })).toBe(true);
      expect(insertImage).not.toHaveBeenCalled();
    });

    test('stops once the editor shows other content', async () => {
      vi.mocked(processResource).mockResolvedValue(
        /** @type {any} */ ({ value: '/uploads/a.png' }),
      );

      const done = await insertInlineImages({
        ...getArgs(() => false),
        images: [{ file }, { src: 'https://example.com/b.png' }],
      });

      expect(done).toBe(false);
      expect(insertImage).not.toHaveBeenCalled();
    });
    test('processes a few files at a time and inserts them in order', async () => {
      const files = [...Array(6).keys()].map((i) => new File([`${i}`], `${i}.png`));
      /** @type {Map<File, (value: any) => void>} */
      const resolvers = new Map();
      let inFlight = 0;
      let maxInFlight = 0;

      vi.mocked(processResource).mockImplementation(
        ({ resource }) =>
          new Promise((resolve) => {
            inFlight += 1;
            maxInFlight = Math.max(maxInFlight, inFlight);
            resolvers.set(/** @type {File} */ (resource.file), (value) => {
              inFlight -= 1;
              resolve(value);
            });
          }),
      );

      const promise = insertInlineImages({
        ...getArgs(),
        images: files.map((f) => ({ file: f, alt: f.name })),
      });

      await vi.waitFor(() => expect(resolvers.size).toBe(4));
      // The later files finish first, but nothing is inserted before the first one is done
      [3, 2, 1].forEach((i) => {
        /** @type {any} */ (resolvers.get(files[i]))({ value: `/uploads/${i}.png` });
      });
      await vi.waitFor(() => expect(resolvers.size).toBe(6));
      expect(insertImage).not.toHaveBeenCalled();
      [5, 4, 0].forEach((i) => {
        /** @type {any} */ (resolvers.get(files[i]))({ value: `/uploads/${i}.png` });
      });

      expect(await promise).toBe(true);
      expect(maxInFlight).toBe(4);
      expect(insertImage.mock.calls).toEqual(files.map((f, i) => [`/uploads/${i}.png`, f.name]));
    });

    test('processes identical files once and inserts each of them', async () => {
      const copy = new File(['x'], 'copy.png', { type: 'image/png' });

      vi.mocked(processResource).mockResolvedValue(/** @type {any} */ ({ value: 'blob:a' }));

      const done = await insertInlineImages({
        ...getArgs(),
        images: [
          { file, alt: 'A' },
          { file: copy, alt: 'B' },
        ],
      });

      expect(done).toBe(true);
      expect(processResource).toHaveBeenCalledOnce();
      expect(insertImage.mock.calls).toEqual([
        ['blob:a', 'A'],
        ['blob:a', 'B'],
      ]);
    });

    test('processes each file that can’t be read on its own', async () => {
      const copy = new File(['x'], 'copy.png', { type: 'image/png' });

      vi.mocked(getGitHash)
        .mockRejectedValueOnce(new Error('NotReadableError'))
        .mockRejectedValueOnce(new Error('NotReadableError'));
      vi.mocked(processResource).mockResolvedValue(/** @type {any} */ ({ value: undefined }));

      expect(await insertInlineImages({ ...getArgs(), images: [{ file }, { file: copy }] })).toBe(
        true,
      );
      expect(processResource).toHaveBeenCalledTimes(2);
      expect(insertImage).not.toHaveBeenCalled();
    });

    test('doesn’t process the files left once the editor shows other content', async () => {
      let current = true;
      const files = [...Array(6).keys()].map((i) => new File([`${i}`], `${i}.png`));

      vi.mocked(processResource).mockImplementation(async () => {
        await Promise.resolve();
        current = false;

        return /** @type {any} */ ({ value: '/uploads/a.png' });
      });

      const done = await insertInlineImages({
        ...getArgs(() => current),
        images: files.map((f) => ({ file: f })),
      });

      expect(done).toBe(false);
      // The first four had started by then
      expect(processResource).toHaveBeenCalledTimes(4);
      expect(insertImage).not.toHaveBeenCalled();
    });

    test('throws the first failure without leaving the later ones unhandled', async () => {
      const other = new File(['y'], 'other.png', { type: 'image/png' });

      vi.mocked(processResource)
        .mockRejectedValueOnce(new Error('first'))
        .mockRejectedValueOnce(new Error('second'));

      await expect(
        insertInlineImages({ ...getArgs(), images: [{ file }, { file: other }] }),
      ).rejects.toThrow('first');
    });
  });

  describe('insertSelectedImages()', () => {
    /** @type {any[]} */
    const resources = [{ file }, { url: 'https://example.com/c.png' }];

    test('processes the resources and inserts the images that have a URL', async () => {
      vi.mocked(processResources).mockResolvedValue(
        /** @type {any} */ ([{ value: '/uploads/a.png' }, { value: undefined }]),
      );

      await insertSelectedImages({ ...getArgs(), resources });

      expect(processResources).toHaveBeenCalledExactlyOnceWith({
        draft,
        resources,
        folder,
        libraryConfig,
        locale: 'en',
      });
      expect(insertImage.mock.calls).toEqual([['/uploads/a.png', '']]);
    });

    test('inserts nothing once the editor shows other content', async () => {
      vi.mocked(processResources).mockResolvedValue(
        /** @type {any} */ ([{ value: '/uploads/a.png' }]),
      );

      await insertSelectedImages({ ...getArgs(() => false), resources });

      expect(insertImage).not.toHaveBeenCalled();
    });
  });
});
