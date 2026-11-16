import { beforeEach, describe, expect, it, vi } from 'vitest';

import { publishedAssets } from '$lib/services/assets/state';
import { getListedAssetFolders } from '$lib/services/assets/view/folder-list';

import {
  findAssetMoveDestination,
  getAssetMoveDestinations,
  getMoveDestinationIcon,
  getMoveDestinationKey,
  isBelowMoveDestination,
  isSameMoveDestination,
} from './move-destinations.js';

vi.mock('$lib/services/assets', () => ({
  isAssetInFolder: vi.fn(
    (/** @type {any} */ asset, /** @type {any} */ folder) => asset.folder === folder,
  ),
}));

vi.mock('$lib/services/assets/folders', () => ({
  canCreateAsset: vi.fn((/** @type {any} */ folder) => !folder.entryRelative && !folder.readonly),
}));

vi.mock('$lib/services/assets/reserved', () => ({
  isCmsFolderPath: vi.fn((/** @type {string} */ path) =>
    /^static\/(?:uploads\/)?admin\b/.test(path),
  ),
}));

vi.mock('$lib/services/assets/state', () => ({
  publishedAssets: { current: [] },
}));

// List the immediate subfolders off the asset paths, as the real function does
vi.mock('$lib/services/assets/subfolders', () => ({
  getSubfolders: vi.fn(
    (/** @type {{ dirPath: string, assets: { path: string }[] }} */ { dirPath, assets }) => {
      const names = new Set(
        assets
          .filter(({ path }) => path.startsWith(`${dirPath}/`))
          .map(({ path }) => path.slice(dirPath.length + 1).split('/'))
          .filter((segments) => segments.length > 1)
          .map(([name]) => name),
      );

      return [...names].sort().map((name) => ({ name, path: `${dirPath}/${name}` }));
    },
  ),
}));

vi.mock('$lib/services/assets/view', () => ({
  getFolderLabelByCollection: vi.fn((/** @type {any} */ folder) => `Label: ${folder.internalPath}`),
}));

vi.mock('$lib/services/assets/view/folder-list', () => ({
  getAssetFolderIcon: vi.fn(() => 'photo_library'),
  getListedAssetFolders: vi.fn(() => []),
}));

const globalFolder = /** @type {any} */ ({
  internalPath: 'static/uploads',
  publicPath: '/uploads',
});

const projects = /** @type {any} */ ({ internalPath: 'static/projects', publicPath: '/projects' });
/**
 * Create an asset.
 * @param {string} path Path.
 * @param {any} folder Folder.
 * @returns {any} Asset.
 */
const createAsset = (path, folder) => ({ path, name: path.split('/').pop(), folder });

describe('assets/data/move-destinations', () => {
  beforeEach(() => {
    /** @type {any} */ (publishedAssets).current = [];
    vi.mocked(getListedAssetFolders).mockReturnValue([]);
  });

  describe('getAssetMoveDestinations', () => {
    it('lists the folders files can be added to, each with its subfolders', () => {
      const all = { internalPath: undefined };
      const shared = { internalPath: 'static/uploads', isAssetCollection: true };
      const entryRelative = { internalPath: 'content/posts', entryRelative: true };
      const readonly = { internalPath: 'static/docs', readonly: true };
      const cms = { internalPath: 'static/admin' };

      vi.mocked(getListedAssetFolders).mockReturnValue(
        /** @type {any} */ ([all, globalFolder, projects, shared, entryRelative, readonly, cms]),
      );
      /** @type {any} */ (publishedAssets).current = [
        createAsset('static/uploads/a.png', globalFolder),
        createAsset('static/uploads/2024/b.png', globalFolder),
        createAsset('static/uploads/2024/06/c.png', globalFolder),
        createAsset('static/uploads/admin/config.yml', globalFolder),
        createAsset('static/projects/d.png', projects),
      ];

      expect(getAssetMoveDestinations()).toEqual([
        {
          folder: globalFolder,
          dirPath: 'static/uploads',
          label: 'Label: static/uploads',
          children: [
            {
              folder: globalFolder,
              dirPath: 'static/uploads/2024',
              label: '2024',
              children: [
                {
                  folder: globalFolder,
                  dirPath: 'static/uploads/2024/06',
                  label: '06',
                  children: [],
                },
              ],
            },
          ],
        },
        {
          folder: projects,
          dirPath: 'static/projects',
          label: 'Label: static/projects',
          children: [],
        },
      ]);
    });
  });

  describe('findAssetMoveDestination', () => {
    const deep = { folder: globalFolder, dirPath: 'static/uploads/2024', label: '', children: [] };
    const root = { folder: globalFolder, dirPath: 'static/uploads', label: '', children: [deep] };
    const other = { folder: projects, dirPath: 'static/projects', label: '', children: [] };

    it('finds a destination at any depth', () => {
      expect(findAssetMoveDestination([root, other], 'static/uploads')).toBe(root);
      expect(findAssetMoveDestination([root, other], 'static/uploads/2024')).toBe(deep);
      expect(findAssetMoveDestination([root, other], 'static/projects')).toBe(other);
    });

    it('returns `undefined` for a directory not in the tree', () => {
      expect(findAssetMoveDestination([root, other], 'static/nowhere')).toBeUndefined();
    });
  });

  describe('findAssetMoveDestination on a service', () => {
    const service = /** @type {any} */ ({ serviceId: 'aws_s3' });
    const trips = { service, dirPath: 'trips', label: 'trips', children: [] };
    const bucket = { service, dirPath: '', label: 'S3', children: [trips] };
    const root = { folder: globalFolder, dirPath: '', label: '', children: [] };

    it('tells a service folder from a repository directory of the same path', () => {
      expect(findAssetMoveDestination([root, bucket], '')).toBe(root);
      expect(findAssetMoveDestination([root, bucket], '', 'aws_s3')).toBe(bucket);
      expect(findAssetMoveDestination([root, bucket], 'trips', 'aws_s3')).toBe(trips);
      expect(findAssetMoveDestination([root, bucket], 'trips')).toBeUndefined();
    });
  });

  describe('destination helpers', () => {
    const s3 = /** @type {any} */ ({ serviceId: 'aws_s3' });
    const r2 = /** @type {any} */ ({ serviceId: 'cloudflare_r2' });
    /**
     * Create a destination.
     * @param {object} props Properties.
     * @returns {any} Destination.
     */
    const dest = (props) => ({ dirPath: '', label: '', children: [], ...props });

    it('tells whether two destinations are the same directory', () => {
      // A proxied copy of the folder is the same folder
      expect(
        isSameMoveDestination(
          dest({ folder: globalFolder, dirPath: 'static/uploads' }),
          dest({ folder: { ...globalFolder }, dirPath: 'static/uploads' }),
        ),
      ).toBe(true);
      expect(
        isSameMoveDestination(
          dest({ folder: globalFolder, dirPath: 'static/uploads' }),
          dest({ folder: projects, dirPath: 'static/uploads' }),
        ),
      ).toBe(false);
      expect(isSameMoveDestination(dest({ service: s3 }), dest({ service: s3 }))).toBe(true);
      expect(isSameMoveDestination(dest({ service: s3 }), dest({ service: r2 }))).toBe(false);
      expect(isSameMoveDestination(dest({ service: s3 }), dest({ folder: globalFolder }))).toBe(
        false,
      );
      expect(isSameMoveDestination(dest({ service: s3 }), undefined)).toBe(false);
    });

    it('tells whether a destination is below another', () => {
      const bucket = dest({ service: s3 });

      expect(isBelowMoveDestination(bucket, dest({ service: s3, dirPath: 'a/b' }))).toBe(true);
      expect(isBelowMoveDestination(bucket, dest({ service: s3 }))).toBe(false);
      expect(isBelowMoveDestination(bucket, dest({ service: r2, dirPath: 'a' }))).toBe(false);
      expect(isBelowMoveDestination(bucket, undefined)).toBe(false);

      const root = dest({ folder: globalFolder, dirPath: 'static/uploads' });

      expect(
        isBelowMoveDestination(root, dest({ folder: globalFolder, dirPath: 'static/uploads/a' })),
      ).toBe(true);
      // Not a subfolder, though the path starts the same way
      expect(
        isBelowMoveDestination(root, dest({ folder: globalFolder, dirPath: 'static/uploads2' })),
      ).toBe(false);
    });

    it('gives each kind of destination its icon', () => {
      expect(getMoveDestinationIcon(dest({ service: s3 }))).toBe('cloud');
      expect(getMoveDestinationIcon(dest({ service: s3, dirPath: 'trips' }))).toBe('folder');
      expect(
        getMoveDestinationIcon(dest({ folder: globalFolder, dirPath: 'static/uploads' })),
      ).toBe('photo_library');
      expect(
        getMoveDestinationIcon(dest({ folder: globalFolder, dirPath: 'static/uploads/2024' })),
      ).toBe('folder');
    });

    it('keys a service folder apart from a repository directory', () => {
      expect(getMoveDestinationKey(dest({ service: s3, dirPath: 'a' }))).toBe('aws_s3:a');
      expect(getMoveDestinationKey(dest({ folder: globalFolder, dirPath: 'a' }))).toBe(':a');
    });
  });
});
