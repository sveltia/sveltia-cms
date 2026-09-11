import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getAssetLibraryFolderMap,
  getDefaultAssetFolder,
} from '$lib/services/contents/fields/file/helpers';
import { processResource } from '$lib/services/contents/fields/file/process';
import { getDefaultMediaLibraryOptions } from '$lib/services/integrations/media-libraries/default';

import { addFileToDraft } from './files';

/**
 * @import { EntryDraft } from '$lib/types/private';
 * @import { CustomField } from '$lib/types/public';
 */

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

describe('contents/fields/custom/files', () => {
  beforeEach(() => {
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
});
