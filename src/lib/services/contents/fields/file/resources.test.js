import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  getAssetLibraryFolderMap,
  getDefaultAssetFolder,
} from '$lib/services/contents/fields/file/helpers';
import { processResource } from '$lib/services/contents/fields/file/process';
import {
  getMediaFieldAssetOptions,
  getRejectedFileNames,
  processResources,
  resolveSelectionResult,
  toFieldValue,
} from '$lib/services/contents/fields/file/resources';
import { allCloudStorageServices } from '$lib/services/integrations/media-libraries/cloud';
import { getDefaultMediaLibraryOptions } from '$lib/services/integrations/media-libraries/default';

/**
 * @import { ProcessResourceResult } from '$lib/services/contents/fields/file/process';
 */

vi.mock('$lib/services/contents/fields/file/helpers', () => ({
  getAssetLibraryFolderMap: vi.fn(),
  getDefaultAssetFolder: vi.fn(),
}));
vi.mock('$lib/services/contents/fields/file/process', () => ({ processResource: vi.fn() }));
vi.mock('$lib/services/integrations/media-libraries/cloud', () => ({
  allCloudStorageServices: {
    enabled: { isEnabled: vi.fn(() => true) },
    disabled: { isEnabled: vi.fn(() => false) },
    legacy: {},
  },
}));
vi.mock('$lib/services/integrations/media-libraries/default', () => ({
  getDefaultMediaLibraryOptions: vi.fn(),
}));

describe('getMediaFieldAssetOptions', () => {
  test('collects the folders and media library options for the field', () => {
    const folderMap = /** @type {any} */ ({ field: { folder: { internalPath: 'images' } } });
    const folder = /** @type {any} */ ({ internalPath: 'images' });
    const libraryConfig = /** @type {any} */ ({ max_file_size: 100 });
    const fieldConfig = /** @type {any} */ ({ name: 'image', widget: 'image' });

    vi.mocked(getAssetLibraryFolderMap).mockReturnValue(folderMap);
    vi.mocked(getDefaultAssetFolder).mockReturnValue(folder);
    vi.mocked(getDefaultMediaLibraryOptions).mockReturnValue({
      enabled: true,
      config: libraryConfig,
    });

    const options = getMediaFieldAssetOptions({
      collectionName: 'posts',
      fileName: undefined,
      isIndexFile: false,
      componentName: undefined,
      typedKeyPath: 'image',
      fieldConfig,
    });

    expect(getAssetLibraryFolderMap).toHaveBeenCalledWith({
      collectionName: 'posts',
      fileName: undefined,
      componentName: undefined,
      typedKeyPath: 'image',
      isIndexFile: false,
    });
    expect(getDefaultMediaLibraryOptions).toHaveBeenCalledWith({ fieldConfig });
    expect(allCloudStorageServices.enabled.isEnabled).toHaveBeenCalledWith(fieldConfig);
    expect(options).toEqual({
      folderMap,
      folder,
      enabled: true,
      libraryConfig,
      cloudServiceEntries: [
        ['enabled', allCloudStorageServices.enabled],
        ['legacy', allCloudStorageServices.legacy],
      ],
    });
  });
});

describe('processResources', () => {
  beforeEach(() => {
    vi.mocked(processResource).mockImplementation(async ({ resource }) => ({
      value: resource.url ?? 'blob:x',
      credit: '',
      oversizedFileName: undefined,
      invalidFileName: undefined,
    }));
  });

  test('gives a file without a folder the default one, and processes every resource', async () => {
    const draft = /** @type {any} */ ({});
    const folder = /** @type {any} */ ({ internalPath: 'images' });
    const ownFolder = /** @type {any} */ ({ internalPath: 'other' });
    const libraryConfig = /** @type {any} */ ({});
    const file = new File([''], 'a.png');

    const resources = /** @type {any[]} */ ([
      { file },
      { file, folder: ownFolder },
      { url: 'https://example.com/a.png' },
    ]);

    const accept = 'image/png';
    const locale = 'fr';

    const results = await processResources({
      draft,
      resources,
      folder,
      libraryConfig,
      accept,
      locale,
    });

    expect(resources.map((resource) => resource.folder)).toEqual([folder, ownFolder, undefined]);
    expect(processResource).toHaveBeenCalledTimes(3);
    expect(processResource).toHaveBeenCalledWith({
      draft,
      resource: resources[0],
      libraryConfig,
      accept,
      locale,
    });
    expect(results.map(({ value }) => value)).toEqual([
      'blob:x',
      'blob:x',
      'https://example.com/a.png',
    ]);
  });
});

describe('getRejectedFileNames', () => {
  test('collects the names of the oversized, invalid and mismatched files', () => {
    expect(
      getRejectedFileNames([
        { value: 'a', credit: '', oversizedFileName: undefined, invalidFileName: undefined },
        { value: undefined, credit: '', oversizedFileName: 'b.png', invalidFileName: undefined },
        { value: undefined, credit: '', oversizedFileName: undefined, invalidFileName: 'c.png' },
        {
          value: undefined,
          credit: '',
          oversizedFileName: undefined,
          invalidFileName: undefined,
          mismatchedFileName: 'd.png',
        },
      ]),
    ).toEqual({
      oversizedFileNames: ['b.png'],
      invalidFileNames: ['c.png'],
      mismatchedFileNames: ['d.png'],
    });
  });
});

describe('toFieldValue', () => {
  test('encodes spaces only in a rich text editor component', () => {
    expect(toFieldValue('/images/my photo.png', true)).toBe('/images/my%20photo.png');
    expect(toFieldValue('/images/my photo.png', false)).toBe('/images/my photo.png');
  });
});

describe('resolveSelectionResult', () => {
  /**
   * Create a processing result.
   * @param {Partial<ProcessResourceResult>} [props] Properties.
   * @returns {ProcessResourceResult} Result.
   */
  const result = (props = {}) => ({
    value: undefined,
    credit: '',
    oversizedFileName: undefined,
    invalidFileName: undefined,
    ...props,
  });

  test('takes the last usable resource for a single-file field', () => {
    expect(
      resolveSelectionResult({
        resources: [
          result({ value: '/a.png', credit: 'Photo A' }),
          result({ oversizedFileName: 'big.png' }),
          result({ value: '/my b.png', credit: 'Photo B' }),
        ],
        multiple: false,
        previousValue: '/old.png',
        inEditorComponent: true,
      }),
    ).toEqual({
      values: ['/a.png', '/my b.png'],
      value: '/my%20b.png',
      credit: 'Photo A\nPhoto B',
      rejected: {
        oversizedFileNames: ['big.png'],
        invalidFileNames: [],
        mismatchedFileNames: [],
      },
    });
  });

  test('restores the previous value of a single-file field without a usable resource', () => {
    const resources = [result({ invalidFileName: 'bad.png' })];

    expect(
      resolveSelectionResult({
        resources,
        multiple: false,
        previousValue: '/old.png',
        inEditorComponent: false,
      }),
    ).toMatchObject({ values: [], value: '/old.png', credit: '' });
    expect(
      resolveSelectionResult({
        resources,
        multiple: false,
        previousValue: undefined,
        inEditorComponent: false,
      }).value,
    ).toBe('');
  });

  test('leaves the value of a multiple-file field to the caller', () => {
    expect(
      resolveSelectionResult({
        resources: [result({ value: '/a.png' }), result({ value: '/b.png' })],
        multiple: true,
        previousValue: undefined,
        inEditorComponent: false,
      }),
    ).toMatchObject({ values: ['/a.png', '/b.png'], value: undefined });
  });
});
