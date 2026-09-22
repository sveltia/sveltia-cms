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
  toFieldValue,
} from '$lib/services/contents/fields/file/resources';
import { allCloudStorageServices } from '$lib/services/integrations/media-libraries/cloud';
import { getDefaultMediaLibraryOptions } from '$lib/services/integrations/media-libraries/default';

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

    const results = await processResources({ draft, resources, folder, libraryConfig });

    expect(resources.map((resource) => resource.folder)).toEqual([folder, ownFolder, undefined]);
    expect(processResource).toHaveBeenCalledTimes(3);
    expect(processResource).toHaveBeenCalledWith({ draft, resource: resources[0], libraryConfig });
    expect(results.map(({ value }) => value)).toEqual([
      'blob:x',
      'blob:x',
      'https://example.com/a.png',
    ]);
  });
});

describe('getRejectedFileNames', () => {
  test('collects the names of the oversized and invalid files', () => {
    expect(
      getRejectedFileNames([
        { value: 'a', credit: '', oversizedFileName: undefined, invalidFileName: undefined },
        { value: undefined, credit: '', oversizedFileName: 'b.png', invalidFileName: undefined },
        { value: undefined, credit: '', oversizedFileName: undefined, invalidFileName: 'c.png' },
      ]),
    ).toEqual({ oversizedFileNames: ['b.png'], invalidFileNames: ['c.png'] });
  });
});

describe('toFieldValue', () => {
  test('encodes spaces only in a rich text editor component', () => {
    expect(toFieldValue('/images/my photo.png', true)).toBe('/images/my%20photo.png');
    expect(toFieldValue('/images/my photo.png', false)).toBe('/images/my photo.png');
  });
});
