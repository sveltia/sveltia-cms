import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  browsedDirPath,
  canBrowseSubfolders,
  formatSubfolderName,
  getDirName,
  getRelativePath,
  getSubfolderPath,
  getSubfolders,
  getUploadDirPath,
  resolveAssetFolderPath,
  selectedSubfolderPath,
  validateSubfolderName,
} from './subfolders';

/**
 * @import { AssetFolderInfo } from '$lib/types/private';
 */

const { _allAssetFolders, _selectedAssetFolder, _gitConfigFiles, _config } = vi.hoisted(() => ({
  /** @type {{ current: any[] }} */
  _allAssetFolders: { current: [] },
  /** @type {{ current: any }} */
  _selectedAssetFolder: { current: undefined },
  /** @type {{ current: any[] }} */
  _gitConfigFiles: { current: [] },
  /** @type {Record<string, any>} */
  _config: {},
}));

vi.mock('$lib/services/assets/folders', () => ({
  allAssetFolders: _allAssetFolders,
  selectedAssetFolder: _selectedAssetFolder,
}));

vi.mock('$lib/services/backends/git/shared/config', () => ({
  gitConfigFiles: _gitConfigFiles,
}));

vi.mock('$lib/services/integrations/media-libraries/default', () => ({
  // eslint-disable-next-line jsdoc/require-jsdoc
  getDefaultMediaLibraryOptions: () => ({ enabled: true, config: _config }),
}));

/**
 * Create an asset folder.
 * @param {Partial<AssetFolderInfo>} [props] Properties.
 * @returns {AssetFolderInfo} Folder.
 */
const createFolder = (props = {}) => ({
  collectionName: undefined,
  internalPath: 'static/images',
  publicPath: '/images',
  entryRelative: false,
  hasTemplateTags: false,
  ...props,
});

/**
 * Create an asset.
 * @param {string} path Asset path.
 * @returns {any} Asset.
 */
const createAsset = (path) => ({ path, name: path.split('/').pop() });

describe('assets/subfolders', () => {
  beforeEach(() => {
    _allAssetFolders.current = [];
    _selectedAssetFolder.current = undefined;
    _gitConfigFiles.current = [];
    _config.slugify_filename = false;
    selectedSubfolderPath.current = '';
  });

  describe('getDirName', () => {
    it('should return the directory of a file path', () => {
      expect(getDirName('static/images/photo.jpg')).toBe('static/images');
      expect(getDirName('static/photo.jpg')).toBe('static');
    });

    it('should return an empty string for a file at the root', () => {
      expect(getDirName('photo.jpg')).toBe('');
    });
  });

  describe('canBrowseSubfolders', () => {
    it('should allow a plain folder when folder support is enabled', () => {
      expect(canBrowseSubfolders(createFolder())).toBe(true);
      expect(canBrowseSubfolders(createFolder({ internalPath: '' }))).toBe(true);
    });

    it('should not allow the All Assets folder', () => {
      expect(canBrowseSubfolders(undefined)).toBe(false);
      expect(canBrowseSubfolders(createFolder({ internalPath: undefined }))).toBe(false);
    });

    it('should not allow an entry-relative folder or one with template tags', () => {
      expect(canBrowseSubfolders(createFolder({ entryRelative: true }))).toBe(false);
      expect(canBrowseSubfolders(createFolder({ hasTemplateTags: true }))).toBe(false);
    });
  });

  describe('getRelativePath', () => {
    it('should return the path below the base directory', () => {
      expect(getRelativePath('static/images/2024/photo.jpg', 'static/images')).toBe(
        '2024/photo.jpg',
      );
      expect(getRelativePath('static/images', 'static/images')).toBe('');
      expect(getRelativePath('static/imagesets/photo.jpg', 'static/images')).toBe('');
    });

    it('should return the whole path below the repository root', () => {
      expect(getRelativePath('images/photo.jpg', '')).toBe('images/photo.jpg');
    });
  });

  describe('getSubfolderPath', () => {
    it('should return the path below the folder', () => {
      const folder = createFolder();

      expect(getSubfolderPath(folder, 'static/images')).toBe('');
      expect(getSubfolderPath(folder, 'static/images/2024')).toBe('2024');
      expect(getSubfolderPath(folder, 'static/images/2024/summer')).toBe('2024/summer');
    });

    it('should return the whole path for a folder at the repository root', () => {
      expect(getSubfolderPath(createFolder({ internalPath: '' }), 'images/2024')).toBe(
        'images/2024',
      );
    });

    it('should return an empty string for a path outside the folder', () => {
      expect(getSubfolderPath(createFolder(), 'static/imagesets/2024')).toBe('');
      expect(getSubfolderPath(createFolder(), 'content')).toBe('');
    });

    it('should return an empty string for a folder that cannot be browsed', () => {
      expect(getSubfolderPath(createFolder({ entryRelative: true }), 'static/images/2024')).toBe(
        '',
      );
    });
  });

  describe('resolveAssetFolderPath', () => {
    const allAssets = createFolder({ internalPath: undefined, publicPath: undefined });
    const global = createFolder();
    const posts = createFolder({ collectionName: 'posts', internalPath: 'static/images/posts' });

    const relative = createFolder({
      collectionName: 'docs',
      internalPath: 'content/docs',
      entryRelative: true,
    });

    beforeEach(() => {
      _allAssetFolders.current = [allAssets, global, posts, relative];
    });

    it('should prefer the folder passed as history state', () => {
      expect(resolveAssetFolderPath('static/images/2024', relative)).toEqual({
        folder: relative,
        subfolderPath: '',
      });
      expect(resolveAssetFolderPath('static/images/2024', global)).toEqual({
        folder: global,
        subfolderPath: '2024',
      });
    });

    it('should find the All Assets folder', () => {
      expect(resolveAssetFolderPath('-/all')).toEqual({ folder: allAssets, subfolderPath: '' });
    });

    it('should find a folder by its exact path first', () => {
      expect(resolveAssetFolderPath('static/images')).toEqual({
        folder: global,
        subfolderPath: '',
      });
      // A folder nested in another is matched exactly, not as a subfolder of the outer one
      expect(resolveAssetFolderPath('static/images/posts')).toEqual({
        folder: posts,
        subfolderPath: '',
      });
    });

    it('should find the deepest folder containing a subfolder path', () => {
      expect(resolveAssetFolderPath('static/images/2024/summer')).toEqual({
        folder: global,
        subfolderPath: '2024/summer',
      });
      expect(resolveAssetFolderPath('static/images/posts/2024')).toEqual({
        folder: posts,
        subfolderPath: '2024',
      });
    });

    it('should find a folder at the repository root', () => {
      const root = createFolder({ internalPath: '' });

      _allAssetFolders.current = [root];
      expect(resolveAssetFolderPath('uploads/2024')).toEqual({
        folder: root,
        subfolderPath: 'uploads/2024',
      });
    });

    it('should return undefined for an unknown path', () => {
      expect(resolveAssetFolderPath('content/posts')).toBeUndefined();
      expect(resolveAssetFolderPath('static/imagesets')).toBeUndefined();
    });

    it('should not match a subfolder of a folder that cannot be browsed', () => {
      _allAssetFolders.current = [relative];
      expect(resolveAssetFolderPath('content/docs')).toEqual({
        folder: relative,
        subfolderPath: '',
      });
      expect(resolveAssetFolderPath('content/docs/2024')).toBeUndefined();
    });
  });

  describe('browsedDirPath', () => {
    it('should be undefined when no folder is selected', () => {
      expect(browsedDirPath.current).toBeUndefined();
    });

    it('should be undefined for a folder that cannot be browsed', () => {
      _selectedAssetFolder.current = createFolder({ entryRelative: true });
      selectedSubfolderPath.current = '2024';
      expect(browsedDirPath.current).toBeUndefined();
    });

    it('should join the folder path and the subfolder path', () => {
      _selectedAssetFolder.current = createFolder();
      expect(browsedDirPath.current).toBe('static/images');

      selectedSubfolderPath.current = '2024/summer';
      expect(browsedDirPath.current).toBe('static/images/2024/summer');
    });

    it('should be the subfolder path for a folder at the repository root', () => {
      _selectedAssetFolder.current = createFolder({ internalPath: '' });
      expect(browsedDirPath.current).toBe('');

      selectedSubfolderPath.current = 'uploads';
      expect(browsedDirPath.current).toBe('uploads');
    });
  });

  describe('getSubfolders', () => {
    it('should list the immediate subfolders from the asset paths, sorted by name', () => {
      const assets = [
        'static/images/photo.jpg',
        'static/images/b/photo.jpg',
        'static/images/a/photo.jpg',
        'static/images/a/deep/photo.jpg',
        'static/images/10/photo.jpg',
        'static/images/2/photo.jpg',
      ].map(createAsset);

      expect(getSubfolders({ dirPath: 'static/images', assets })).toEqual([
        { name: '2', path: 'static/images/2' },
        { name: '10', path: 'static/images/10' },
        { name: 'a', path: 'static/images/a' },
        { name: 'b', path: 'static/images/b' },
      ]);
      expect(getSubfolders({ dirPath: 'static/images/a', assets })).toEqual([
        { name: 'deep', path: 'static/images/a/deep' },
      ]);
      expect(getSubfolders({ dirPath: 'static/images/b', assets })).toEqual([]);
    });

    it('should list an empty folder kept with a Git config file', () => {
      _gitConfigFiles.current = [
        { path: '.gitattributes' },
        { path: 'static/images/empty/.gitkeep' },
        { path: 'content/.gitkeep' },
      ];

      expect(getSubfolders({ dirPath: 'static/images', assets: [] })).toEqual([
        { name: 'empty', path: 'static/images/empty' },
      ]);
    });

    it('should list the subfolders of the repository root', () => {
      _gitConfigFiles.current = [{ path: '.gitattributes' }, { path: 'content/.gitkeep' }];

      const assets = ['photo.jpg', 'uploads/photo.jpg'].map(createAsset);

      expect(getSubfolders({ dirPath: '', assets })).toEqual([
        { name: 'content', path: 'content' },
        { name: 'uploads', path: 'uploads' },
      ]);
    });

    it('should not list an asset folder nested in the folder for its Git config file', () => {
      const global = createFolder();
      const posts = createFolder({ collectionName: 'posts', internalPath: 'static/images/posts' });

      _allAssetFolders.current = [global, posts];
      _gitConfigFiles.current = [
        { path: 'static/images/empty/.gitkeep' },
        { path: 'static/images/posts/.gitkeep' },
        { path: 'static/images/posts/2024/.gitkeep' },
      ];

      // The assets of the nested folder aren’t the outer folder’s either
      expect(getSubfolders({ dirPath: 'static/images', assets: [] })).toEqual([
        { name: 'empty', path: 'static/images/empty' },
      ]);
      // The nested folder lists its own
      expect(getSubfolders({ dirPath: 'static/images/posts', assets: [] })).toEqual([
        { name: '2024', path: 'static/images/posts/2024' },
      ]);
    });

    it('should not take a folder with a longer name for a subfolder', () => {
      const assets = ['static/imagesets/photo.jpg'].map(createAsset);

      expect(getSubfolders({ dirPath: 'static/images', assets })).toEqual([]);
    });
  });

  describe('getUploadDirPath', () => {
    it('should join the folder path and the subfolder path', () => {
      expect(getUploadDirPath({ folder: createFolder(), files: [] })).toBe('static/images');
      expect(getUploadDirPath({ folder: createFolder(), subfolderPath: '2024', files: [] })).toBe(
        'static/images/2024',
      );
      expect(
        getUploadDirPath({
          folder: createFolder({ internalPath: '' }),
          subfolderPath: '2024',
          files: [],
        }),
      ).toBe('2024');
    });

    it('should be undefined when the folder has no path', () => {
      expect(getUploadDirPath({ folder: undefined, files: [] })).toBeUndefined();
      expect(
        getUploadDirPath({ folder: createFolder({ internalPath: undefined }), files: [] }),
      ).toBeUndefined();
    });
  });

  describe('formatSubfolderName', () => {
    it('should sanitize the name', () => {
      expect(formatSubfolderName('  Summer  Photos ')).toBe('Summer Photos');
      expect(formatSubfolderName('a/b\\c:d')).toBe('abcd');
    });

    it('should slugify the whole name when the option is enabled', () => {
      _config.slugify_filename = true;
      expect(formatSubfolderName('Summer Photos')).toBe('summer-photos');
      // A dot doesn’t start an extension, which a file name would keep as is, space and all
      expect(formatSubfolderName('Release 2.0 Assets')).toBe('release-2.0-assets');
      // Nothing usable is left, rather than a random fallback
      expect(formatSubfolderName('???')).toBe('');
    });
  });

  describe('validateSubfolderName', () => {
    const takenNames = ['2024', 'Photo.jpg'];

    it('should accept a new name', () => {
      expect(validateSubfolderName({ name: 'summer', takenNames })).toBeUndefined();
      expect(validateSubfolderName({ name: ' summer 2024 ', takenNames })).toBeUndefined();
    });

    it('should reject an empty name', () => {
      expect(validateSubfolderName({ name: '', takenNames })).toBe('empty');
      expect(validateSubfolderName({ name: '   ', takenNames })).toBe('empty');
    });

    it('should reject a name with a slash, a leading dot or nothing usable', () => {
      expect(validateSubfolderName({ name: 'a/b', takenNames })).toBe('invalid');
      expect(validateSubfolderName({ name: '.hidden', takenNames })).toBe('invalid');
      expect(validateSubfolderName({ name: '???', takenNames })).toBe('invalid');
    });

    it('should reject a name taken by a folder or file, regardless of case', () => {
      expect(validateSubfolderName({ name: '2024', takenNames })).toBe('duplicate');
      expect(validateSubfolderName({ name: 'photo.JPG', takenNames })).toBe('duplicate');
    });
  });
});
