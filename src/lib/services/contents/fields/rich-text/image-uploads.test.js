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

vi.mock('$lib/services/contents/fields/file/process', () => ({ processResource: vi.fn() }));
vi.mock('$lib/services/contents/fields/file/resources', async (importOriginal) => ({
  .../** @type {object} */ (await importOriginal()),
  processResources: vi.fn(),
}));

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
