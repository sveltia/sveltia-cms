import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getAssetByPath } from '$lib/services/assets';
import { getAssetBlob } from '$lib/services/assets/info';
import {
  getAssetLibraryFolderMap,
  getDefaultAssetFolder,
} from '$lib/services/contents/fields/file/helpers';
import { processResource } from '$lib/services/contents/fields/file/process';
import { allCloudStorageServices } from '$lib/services/integrations/media-libraries/cloud';
import { getDefaultMediaLibraryOptions } from '$lib/services/integrations/media-libraries/default';

import {
  addFileToDraft,
  getCustomFieldAssetOptions,
  getPickedAssetKind,
  resolvePickedResources,
} from './files';

/**
 * @import { EntryDraft } from '$lib/types/private';
 * @import { CustomField } from '$lib/types/public';
 */

vi.mock('$lib/services/assets', () => ({
  getAssetByPath: vi.fn(),
}));

vi.mock('$lib/services/assets/info', () => ({
  getAssetBlob: vi.fn(),
}));

vi.mock('$lib/services/integrations/media-libraries/cloud', () => ({
  allCloudStorageServices: {
    cloudinary: { serviceId: 'cloudinary', isEnabled: vi.fn() },
    'azure-blob-storage': { serviceId: 'azure-blob-storage', isEnabled: vi.fn() },
    legacy: { serviceId: 'legacy' },
  },
}));

vi.mock('$lib/services/contents/fields/file/helpers', () => ({
  getAssetLibraryFolderMap: vi.fn(),
  getDefaultAssetFolder: vi.fn(),
}));

vi.mock('$lib/services/contents/fields/file/process', () => ({
  processResource: vi.fn(),
}));

vi.mock('$lib/services/integrations/media-libraries/default', () => ({
  getDefaultMediaLibraryOptions: vi.fn(),
}));

/** @type {EntryDraft} */
const draft = /** @type {any} */ ({
  collectionName: 'posts',
  fileName: undefined,
  isIndexFile: false,
  originalEntry: { id: 'entry' },
  files: {},
});

/** @type {CustomField} */
const fieldConfig = { name: 'photo', widget: 'derived-image', media_folder: '/static/photos' };
const folderMap = { field: { folder: { internalPath: 'static/photos' }, enabled: true } };
const folder = { internalPath: 'static/photos', publicPath: '/photos' };
const libraryConfig = { max_file_size: 1024, transformations: undefined };

/**
 * Call `addFileToDraft()` with the common arguments.
 * @param {File | Blob} file File to be added.
 * @param {{ name?: string }} [options] Options.
 * @returns {Promise<string>} Blob URL.
 */
const addFile = (file, options) =>
  addFileToDraft({ draft, fieldConfig, typedKeyPath: 'photo', file, options });

/**
 * Call `resolvePickedResources()` with the common arguments.
 * @param {import('$lib/types/private').SelectedResource[]} resources Resources.
 * @returns {ReturnType<typeof resolvePickedResources>} Result.
 */
const resolvePicked = (resources) =>
  resolvePickedResources({ draft, fieldConfig, typedKeyPath: 'photo', resources });

describe('contents/fields/custom/files', () => {
  beforeEach(() => {
    draft.files = {};
    vi.mocked(getAssetLibraryFolderMap).mockReturnValue(/** @type {any} */ (folderMap));
    vi.mocked(getDefaultAssetFolder).mockReturnValue(/** @type {any} */ (folder));
    vi.mocked(getDefaultMediaLibraryOptions).mockReturnValue({
      enabled: true,
      config: /** @type {any} */ (libraryConfig),
    });
    vi.mocked(processResource).mockResolvedValue({
      value: 'blob:http://localhost/abc',
      credit: '',
      oversizedFileName: undefined,
      invalidFileName: undefined,
    });
  });

  it('adds a File to the draft through the same path as a File/Image field', async () => {
    const file = new File(['x'], 'photo.webp', { type: 'image/webp' });

    await expect(addFile(file)).resolves.toBe('blob:http://localhost/abc');

    expect(getAssetLibraryFolderMap).toHaveBeenCalledWith({
      collectionName: 'posts',
      fileName: undefined,
      componentName: undefined,
      typedKeyPath: 'photo',
      isIndexFile: false,
    });
    expect(getDefaultAssetFolder).toHaveBeenCalledWith(folderMap);
    expect(getDefaultMediaLibraryOptions).toHaveBeenCalledWith({ fieldConfig });
    expect(processResource).toHaveBeenCalledWith({
      draft,
      resource: { file, folder },
      libraryConfig,
    });
  });

  it('passes the enclosing rich text editor component name for the folder lookup', async () => {
    const file = new File(['x'], 'photo.webp', { type: 'image/webp' });

    await addFileToDraft({
      draft,
      fieldConfig,
      typedKeyPath: 'photo',
      componentName: 'gallery',
      file,
    });

    expect(getAssetLibraryFolderMap).toHaveBeenCalledWith(
      expect.objectContaining({ componentName: 'gallery' }),
    );
  });

  it('wraps a Blob in a File with the given name', async () => {
    const blob = new Blob(['x'], { type: 'image/webp' });

    await addFile(blob, { name: 'tiny.webp' });

    const { file } = vi.mocked(processResource).mock.calls[0][0].resource;

    expect(file).toBeInstanceOf(File);
    expect(file?.name).toBe('tiny.webp');
    expect(file?.type).toBe('image/webp');
    expect(await file?.text()).toBe('x');
  });

  it('renames a File when the name option is given', async () => {
    const original = new File(['x'], 'blob', { type: 'image/webp' });

    await addFile(original, { name: 'optimized.webp' });

    const { file } = vi.mocked(processResource).mock.calls[0][0].resource;

    expect(file).not.toBe(original);
    expect(file?.name).toBe('optimized.webp');
    expect(file?.type).toBe('image/webp');
  });

  it('rejects a Blob given without a name', async () => {
    await expect(addFile(new Blob(['x']))).rejects.toThrow(TypeError);
    expect(processResource).not.toHaveBeenCalled();
  });

  it('rejects anything that is not a Blob', async () => {
    await expect(addFile(/** @type {any} */ ('photo.webp'))).rejects.toThrow(TypeError);
    await expect(addFile(/** @type {any} */ (undefined), { name: 'a.webp' })).rejects.toThrow(
      TypeError,
    );
    expect(processResource).not.toHaveBeenCalled();
  });

  it('rejects a file that cannot be decoded', async () => {
    vi.mocked(processResource).mockResolvedValue({
      value: undefined,
      credit: '',
      oversizedFileName: undefined,
      invalidFileName: 'photo.webp',
    });

    await expect(addFile(new File(['x'], 'photo.webp'))).rejects.toThrow(
      'The file "photo.webp" is corrupt or mislabeled and cannot be used',
    );
  });

  it('rejects a file that exceeds the size limit', async () => {
    vi.mocked(processResource).mockResolvedValue({
      value: '',
      credit: '',
      oversizedFileName: 'photo.webp',
      invalidFileName: undefined,
    });

    await expect(addFile(new File(['x'], 'photo.webp'))).rejects.toThrow(
      'The file "photo.webp" exceeds the maximum size of 1024 bytes',
    );
  });

  describe('getCustomFieldAssetOptions', () => {
    it('resolves the folders, library config and cloud services for the field', () => {
      const { cloudinary, 'azure-blob-storage': azure } = allCloudStorageServices;

      vi.mocked(cloudinary.isEnabled ?? vi.fn()).mockReturnValue(true);
      vi.mocked(azure.isEnabled ?? vi.fn()).mockReturnValue(false);

      const options = getCustomFieldAssetOptions({
        draft,
        fieldConfig,
        typedKeyPath: 'photo',
        componentName: 'gallery',
      });

      expect(getAssetLibraryFolderMap).toHaveBeenCalledWith({
        collectionName: 'posts',
        fileName: undefined,
        componentName: 'gallery',
        typedKeyPath: 'photo',
        isIndexFile: false,
      });
      expect(cloudinary.isEnabled).toHaveBeenCalledWith(fieldConfig);
      expect(options).toEqual({
        folderMap,
        folder,
        enabled: true,
        libraryConfig,
        // A service without `isEnabled` is always available
        cloudServiceEntries: [
          ['cloudinary', cloudinary],
          ['legacy', allCloudStorageServices.legacy],
        ],
      });
    });
  });

  describe('getPickedAssetKind', () => {
    it('prefers the explicit kind', () => {
      expect(getPickedAssetKind({ kind: 'image', accept: '.pdf' })).toBe('image');
      expect(getPickedAssetKind({ kind: 'file', accept: 'image/*' })).toBeUndefined();
    });

    it('limits the pick to images when only image types are accepted', () => {
      expect(getPickedAssetKind({ accept: 'image/*' })).toBe('image');
      expect(getPickedAssetKind({ accept: 'image/png, image/webp' })).toBe('image');
      expect(getPickedAssetKind({ accept: 'image/*,.pdf' })).toBeUndefined();
      expect(getPickedAssetKind({ accept: '.png' })).toBeUndefined();
    });

    it('offers any file by default', () => {
      expect(getPickedAssetKind({})).toBeUndefined();
      expect(getPickedAssetKind({ accept: '' })).toBeUndefined();
    });
  });

  describe('resolvePickedResources', () => {
    it('resolves an existing asset to its public path and bytes', async () => {
      const asset = /** @type {any} */ ({ path: 'static/photos/a.webp', unsaved: false });
      const blob = new Blob(['a'], { type: 'image/webp' });

      vi.mocked(processResource).mockResolvedValue({
        value: '/photos/a.webp',
        credit: '',
        oversizedFileName: undefined,
        invalidFileName: undefined,
      });
      vi.mocked(getAssetBlob).mockResolvedValue(blob);

      await expect(resolvePicked([{ asset }])).resolves.toEqual({
        files: [{ value: '/photos/a.webp', file: blob, credit: undefined }],
        oversizedFileNames: [],
        invalidFileNames: [],
      });

      expect(processResource).toHaveBeenCalledWith({ draft, resource: { asset }, libraryConfig });
      expect(getAssetBlob).toHaveBeenCalledWith(asset);
      expect(getAssetByPath).not.toHaveBeenCalled();
    });

    it('resolves an uploaded file to its blob URL and the processed file cached in the draft', async () => {
      const original = new File(['x'], 'photo.png', { type: 'image/png' });
      const processed = new File(['y'], 'photo.webp', { type: 'image/webp' });
      const blobURL = 'blob:http://localhost/abc';

      vi.mocked(processResource).mockImplementation(async ({ draft: d, resource }) => {
        // The file is cached in the draft, the way the real implementation does it
        d.files[blobURL] = { file: processed, folder: resource.folder, replace: false };

        return {
          value: blobURL,
          credit: '',
          oversizedFileName: undefined,
          invalidFileName: undefined,
        };
      });

      const { files } = await resolvePicked([{ file: original }]);

      expect(files).toEqual([{ value: blobURL, file: processed, credit: undefined }]);
      // The field’s folder is set for an upload that doesn’t come with one
      expect(processResource).toHaveBeenCalledWith({
        draft,
        resource: { file: original, folder },
        libraryConfig,
      });
      expect(getAssetBlob).not.toHaveBeenCalled();
    });

    it('keeps the folder a stock photo is downloaded to', async () => {
      const file = new File(['x'], 'stock.jpg', { type: 'image/jpeg' });
      const stockFolder = /** @type {any} */ ({ internalPath: 'static/stock' });

      vi.mocked(processResource).mockResolvedValue({
        value: 'blob:http://localhost/stock',
        credit: '<a href="https://example.com">Photographer</a>',
        oversizedFileName: undefined,
        invalidFileName: undefined,
      });

      const { files } = await resolvePicked([{ file, folder: stockFolder, credit: 'x' }]);

      expect(processResource).toHaveBeenCalledWith({
        draft,
        resource: { file, folder: stockFolder, credit: 'x' },
        libraryConfig,
      });
      expect(files[0].credit).toBe('<a href="https://example.com">Photographer</a>');
      // The processed file is looked up in the draft, so nothing is returned if it’s not there
      expect(files[0].file).toBeUndefined();
    });

    it('resolves a file identical to an existing asset to that asset', async () => {
      const file = new File(['x'], 'photo.webp', { type: 'image/webp' });
      const asset = /** @type {any} */ ({ path: 'static/photos/photo.webp' });
      const blob = new Blob(['x'], { type: 'image/webp' });

      vi.mocked(processResource).mockResolvedValue({
        value: '/photos/photo.webp',
        credit: '',
        oversizedFileName: undefined,
        invalidFileName: undefined,
      });
      vi.mocked(getAssetByPath).mockReturnValue(asset);
      vi.mocked(getAssetBlob).mockResolvedValue(blob);

      const { files } = await resolvePickedResources({
        draft,
        fieldConfig,
        typedKeyPath: 'photo',
        componentName: 'gallery',
        resources: [{ file }],
      });

      expect(getAssetByPath).toHaveBeenCalledWith({
        value: '/photos/photo.webp',
        entry: draft.originalEntry,
        collectionName: 'posts',
        fileName: undefined,
        componentName: 'gallery',
        typedKeyPath: 'photo',
      });
      expect(files).toEqual([{ value: '/photos/photo.webp', file: blob, credit: undefined }]);
    });

    it('falls back to no bytes when a deduplicated file cannot be located', async () => {
      vi.mocked(processResource).mockResolvedValue({
        value: '/photos/photo.webp',
        credit: '',
        oversizedFileName: undefined,
        invalidFileName: undefined,
      });
      vi.mocked(getAssetByPath).mockReturnValue(undefined);

      const { files } = await resolvePicked([{ file: new File(['x'], 'photo.webp') }]);

      expect(files[0].file).toBeUndefined();
      expect(getAssetBlob).not.toHaveBeenCalled();
    });

    it('resolves a URL as is, without bytes', async () => {
      vi.mocked(processResource).mockResolvedValue({
        value: 'https://example.com/a.png',
        credit: '',
        oversizedFileName: undefined,
        invalidFileName: undefined,
      });

      await expect(resolvePicked([{ url: 'https://example.com/a.png' }])).resolves.toEqual({
        files: [{ value: 'https://example.com/a.png', file: undefined, credit: undefined }],
        oversizedFileNames: [],
        invalidFileNames: [],
      });
      expect(getAssetBlob).not.toHaveBeenCalled();
    });

    it('reports rejected files and keeps the usable ones in order', async () => {
      const good = new File(['x'], 'good.webp', { type: 'image/webp' });
      const big = new File(['x'], 'big.webp', { type: 'image/webp' });
      const bad = new File(['x'], 'bad.webp', { type: 'image/webp' });

      vi.mocked(processResource).mockImplementation(async ({ resource }) => {
        const name = resource.file?.name;

        if (name === 'big.webp') {
          return { value: '', credit: '', oversizedFileName: name, invalidFileName: undefined };
        }

        if (name === 'bad.webp') {
          return {
            value: undefined,
            credit: '',
            oversizedFileName: undefined,
            invalidFileName: name,
          };
        }

        return {
          value: `blob:${name}`,
          credit: '',
          oversizedFileName: undefined,
          invalidFileName: undefined,
        };
      });

      await expect(resolvePicked([{ file: big }, { file: good }, { file: bad }])).resolves.toEqual({
        files: [{ value: 'blob:good.webp', file: undefined, credit: undefined }],
        oversizedFileNames: ['big.webp'],
        invalidFileNames: ['bad.webp'],
      });
    });

    it('rejects when the bytes of a picked asset cannot be retrieved', async () => {
      vi.mocked(processResource).mockResolvedValue({
        value: '/photos/a.webp',
        credit: '',
        oversizedFileName: undefined,
        invalidFileName: undefined,
      });
      vi.mocked(getAssetBlob).mockRejectedValue(new Error('Failed to retrieve blob'));

      await expect(resolvePicked([{ asset: /** @type {any} */ ({}) }])).rejects.toThrow(
        'Failed to retrieve blob',
      );
    });
  });
});
