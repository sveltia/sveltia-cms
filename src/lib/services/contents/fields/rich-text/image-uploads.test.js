import { beforeEach, describe, expect, test, vi } from 'vitest';

import { cmsConfig } from '$lib/services/config/state';
import {
  getImageSrcFieldConfig,
  sortDroppedImages,
} from '$lib/services/contents/fields/rich-text/image-uploads';

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
