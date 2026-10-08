import { beforeEach, describe, expect, it, vi } from 'vitest';

import { checkRootDirPaths } from '$lib/services/config/parser/root-dir';

/**
 * @import { AssetFolderInfo, ConfigParserCollectors, EntryFolderInfo } from '$lib/types/private';
 */

const mockGetRootDir = vi.hoisted(() => vi.fn(() => 'apps/blog'));

vi.mock('$lib/services/backends/root-dir', () => ({ getRootDir: mockGetRootDir }));
vi.mock('@sveltia/i18n', () => ({
  _: vi.fn((key, { values } = {}) => `${key}:${values.path}`),
}));

/**
 * Create the collectors.
 * @returns {ConfigParserCollectors} Collectors.
 */
const createCollectors = () => ({
  errors: new Set(),
  warnings: new Set(),
  mediaFields: new Set(),
  relationFields: new Set(),
});

/**
 * Create an asset folder.
 * @param {Partial<AssetFolderInfo>} props Properties.
 * @returns {AssetFolderInfo} Asset folder.
 */
const createAssetFolder = (props) => ({
  collectionName: undefined,
  internalPath: undefined,
  publicPath: undefined,
  entryRelative: false,
  hasTemplateTags: false,
  ...props,
});

/**
 * Check the given folders.
 * @param {object} args Arguments.
 * @param {any} [args.config] CMS configuration.
 * @param {Partial<EntryFolderInfo>[]} [args.entryFolders] Entry folders.
 * @param {Partial<AssetFolderInfo>[]} [args.assetFolders] Asset folders.
 * @returns {string[]} Errors.
 */
const check = ({ config = {}, entryFolders = [], assetFolders = [] }) => {
  const collectors = createCollectors();

  checkRootDirPaths({
    config,
    entryFolders: /** @type {EntryFolderInfo[]} */ (entryFolders),
    assetFolders: assetFolders.map(createAssetFolder),
    collectors,
  });

  return [...collectors.errors];
};

describe('checkRootDirPaths()', () => {
  beforeEach(() => {
    mockGetRootDir.mockReturnValue('apps/blog');
  });

  it('should accept paths within the root directory', () => {
    expect(
      check({
        entryFolders: [
          { collectionName: 'posts', folderPath: 'content/posts' },
          { collectionName: 'about', filePathMap: { _default: 'content/about.md' } },
          // Climbing back down is fine
          { collectionName: 'news', folderPath: 'content/../news' },
          { collectionName: 'misc', folderPath: './misc' },
        ],
        assetFolders: [{ internalPath: 'static/images' }, { internalPath: undefined }],
      }),
    ).toEqual([]);
  });

  it('should report an entry folder or file outside the root directory', () => {
    expect(
      check({
        entryFolders: [
          { collectionName: 'posts', folderPath: '../shared/posts' },
          {
            collectionName: 'pages',
            folderPath: 'content/pages',
            folderPathMap: { en: 'content/pages/en', ja: '../../ja/pages' },
          },
          { collectionName: 'about', filePathMap: { _default: '../about.md' } },
          { collectionName: 'misc', folderPath: './../misc' },
        ],
      }),
    ).toEqual([
      'config.error.path_outside_root_dir:../shared/posts',
      'config.error.path_outside_root_dir:../../ja/pages',
      'config.error.path_outside_root_dir:../about.md',
      'config.error.path_outside_root_dir:./../misc',
    ]);
  });

  it('should report an asset folder outside the root directory once', () => {
    expect(
      check({
        assetFolders: [
          { internalPath: '../shared/images' },
          { collectionName: 'posts', internalPath: '../shared/images' },
        ],
      }),
    ).toEqual(['config.error.path_outside_root_dir:../shared/images']);
  });

  describe('entry-relative media folders', () => {
    const config = {
      collections: [
        { divider: true },
        { name: 'posts', folder: 'posts' },
        { name: 'docs', folder: 'docs', path: '{{slug}}/index' },
        { name: 'news', folder: 'news', i18n: true },
        { name: 'wiki', folder: 'wiki', nested: { depth: 10 } },
        { name: 'pages', files: [] },
      ],
    };

    it('should accept a folder within the root directory', () => {
      expect(
        check({
          config,
          assetFolders: [
            {
              collectionName: 'posts',
              internalPath: 'posts',
              internalSubPath: '../images',
              entryRelative: true,
            },
            { collectionName: 'posts', internalPath: 'posts', entryRelative: true },
          ],
        }),
      ).toEqual([]);
    });

    it('should report a folder that leaves the root directory from every entry', () => {
      expect(
        check({
          config,
          assetFolders: [
            {
              collectionName: 'posts',
              internalPath: 'posts',
              internalSubPath: '../../images',
              entryRelative: true,
            },
            // A file is where it’s configured to be
            {
              collectionName: 'pages',
              fileName: 'about',
              internalPath: '',
              internalSubPath: '../images',
              entryRelative: true,
            },
            {
              collectionName: '_singletons',
              internalPath: 'data',
              internalSubPath: '../../images',
              entryRelative: true,
            },
          ],
        }),
      ).toEqual([
        'config.error.path_outside_root_dir:posts/../../images',
        'config.error.path_outside_root_dir:../images',
        'config.error.path_outside_root_dir:data/../../images',
      ]);
    });

    it('should allow for the subfolders an entry path or i18n can put an entry in', () => {
      expect(
        check({
          config,
          assetFolders: [
            {
              collectionName: 'docs',
              internalPath: 'docs',
              internalSubPath: '../../images',
              entryRelative: true,
            },
            {
              collectionName: 'news',
              internalPath: 'news',
              internalSubPath: '../../images',
              entryRelative: true,
            },
          ],
        }),
      ).toEqual([]);

      expect(
        check({
          config: { ...config, i18n: { locales: ['en', 'ja'] } },
          assetFolders: [
            {
              collectionName: 'posts',
              internalPath: 'posts',
              internalSubPath: '../../images',
              entryRelative: true,
            },
          ],
        }),
      ).toEqual([]);
    });

    it('should leave a folder alone when the depth of the entries can’t be told', () => {
      expect(
        check({
          config,
          assetFolders: [
            // A nested collection
            {
              collectionName: 'wiki',
              internalPath: 'wiki',
              internalSubPath: '../../images',
              entryRelative: true,
            },
            // An editor component used anywhere
            { internalPath: '', internalSubPath: '../images', entryRelative: true },
          ],
        }),
      ).toEqual([]);
    });
  });

  it('should do nothing without a root directory', () => {
    mockGetRootDir.mockReturnValue('');

    expect(check({ assetFolders: [{ internalPath: '../shared/images' }] })).toEqual([]);
  });
});
