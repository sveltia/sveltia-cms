import { beforeEach, describe, expect, it, vi } from 'vitest';

import { selectedExternalAssets } from '$lib/services/assets/external';
import { assetsLocked, hasReadonlyAsset } from '$lib/services/assets/folders';
import { selectedAssets } from '$lib/services/assets/state';

import {
  canMoveAssets,
  canMoveAssetsTo,
  canMoveExternalAssets,
  canMoveRequestTo,
  canMoveToService,
  getDraggedAssets,
  getDraggedExternalAssets,
  getMovableAssets,
  getMovableExternalAssets,
} from './movable.js';

vi.mock('$lib/services/assets/external', () => ({
  selectedExternalAssets: { current: [] },
  hasAuthInfo: vi.fn((/** @type {any} */ service) => service.serviceId !== 'no_key'),
}));

vi.mock('$lib/services/assets/folders', () => ({
  assetsLocked: { current: false },
  canCreateAsset: vi.fn((/** @type {any} */ folder) => !!folder && !folder.entryRelative),
  hasReadonlyAsset: vi.fn(() => false),
}));

vi.mock('$lib/services/assets/reserved', () => ({
  isCmsFolderPath: vi.fn((/** @type {string} */ path) => path.startsWith('static/admin')),
}));

vi.mock('$lib/services/assets/state', () => ({
  selectedAssets: { current: [] },
}));

const folder = /** @type {any} */ ({ internalPath: 'static/uploads', entryRelative: false });
const a = /** @type {any} */ ({ path: 'static/uploads/a.png', name: 'a.png', folder });
const b = /** @type {any} */ ({ path: 'static/uploads/2024/b.png', name: 'b.png', folder });

describe('assets/movable', () => {
  beforeEach(() => {
    /** @type {any} */ (assetsLocked).current = false;
    selectedAssets.current = [];
    selectedExternalAssets.current = [];
    vi.mocked(hasReadonlyAsset).mockReturnValue(false);
  });

  describe('getMovableAssets', () => {
    it('leaves out the assets already in the directory', () => {
      expect(getMovableAssets({ assets: [a, b], dirPath: 'static/uploads' })).toEqual([b]);
      expect(getMovableAssets({ assets: [a, b], dirPath: 'static/other' })).toEqual([a, b]);
    });
  });

  describe('canMoveAssets', () => {
    it('allows moving assets the user can change', () => {
      expect(canMoveAssets([a])).toBe(true);
    });

    it('refuses without assets', () => {
      expect(canMoveAssets([])).toBe(false);
    });

    it('refuses while the media library is locked', () => {
      /** @type {any} */ (assetsLocked).current = true;
      expect(canMoveAssets([a])).toBe(false);
    });

    it('refuses a read-only asset', () => {
      vi.mocked(hasReadonlyAsset).mockReturnValue(true);
      expect(canMoveAssets([a])).toBe(false);
      expect(hasReadonlyAsset).toHaveBeenCalledWith([a]);
    });
  });

  describe('canMoveToService', () => {
    it('allows a service that takes uploads and has the credentials entered', () => {
      const upload = vi.fn();

      expect(canMoveToService(/** @type {any} */ ({ serviceId: 'aws_s3', upload }))).toBe(true);
      expect(canMoveToService(/** @type {any} */ ({ serviceId: 'aws_s3' }))).toBe(false);
      expect(canMoveToService(/** @type {any} */ ({ serviceId: 'no_key', upload }))).toBe(false);
    });
  });

  describe('canMoveAssetsTo', () => {
    const projects = /** @type {any} */ ({ internalPath: 'static/projects' });

    it('allows a directory files can be added to, if an asset is elsewhere', () => {
      expect(canMoveAssetsTo({ assets: [a], folder: projects, dirPath: 'static/projects' })).toBe(
        true,
      );
      expect(canMoveAssetsTo({ assets: [a, b], folder, dirPath: 'static/uploads' })).toBe(true);
    });

    it('refuses when every asset is in the directory already', () => {
      expect(canMoveAssetsTo({ assets: [a], folder, dirPath: 'static/uploads' })).toBe(false);
    });

    it('refuses assets that can’t be moved', () => {
      expect(canMoveAssetsTo({ assets: [], folder: projects, dirPath: 'static/projects' })).toBe(
        false,
      );
    });

    it('refuses a folder files can’t be added to', () => {
      const entryFolder = /** @type {any} */ ({ internalPath: 'content', entryRelative: true });

      expect(canMoveAssetsTo({ assets: [a], folder: entryFolder, dirPath: 'content' })).toBe(false);
    });

    it('refuses a folder the CMS is served from', () => {
      expect(canMoveAssetsTo({ assets: [a], folder, dirPath: 'static/admin' })).toBe(false);
    });
  });

  describe('canMoveAssetsTo a cloud storage service', () => {
    const upload = vi.fn();

    it('allows a service that takes uploads, with the credentials entered', () => {
      const service = /** @type {any} */ ({ serviceId: 'aws_s3', upload });

      expect(canMoveAssetsTo({ assets: [a], service, dirPath: '' })).toBe(true);
    });

    it('refuses a service that can’t take uploads, or without the credentials', () => {
      const noUpload = /** @type {any} */ ({ serviceId: 'cloudinary' });
      const noKey = /** @type {any} */ ({ serviceId: 'no_key', upload });

      expect(canMoveAssetsTo({ assets: [a], service: noUpload, dirPath: '' })).toBe(false);
      expect(canMoveAssetsTo({ assets: [a], service: noKey, dirPath: '' })).toBe(false);
    });

    it('refuses assets that can’t be moved', () => {
      const service = /** @type {any} */ ({ serviceId: 'aws_s3', upload });

      /** @type {any} */ (assetsLocked).current = true;
      expect(canMoveAssetsTo({ assets: [a], service, dirPath: '' })).toBe(false);
    });

    it('refuses a repository directory without a folder', () => {
      expect(canMoveAssetsTo({ assets: [a], dirPath: 'static/projects' })).toBe(false);
    });
  });

  describe('canMoveExternalAssets', () => {
    const service = /** @type {any} */ ({ delete: vi.fn() });
    const file = /** @type {any} */ ({ id: 'a.png' });

    it('allows files on a service that can delete them', () => {
      expect(canMoveExternalAssets(service, [file])).toBe(true);
    });

    it('refuses without files, while locked, or when the service can’t delete them', () => {
      expect(canMoveExternalAssets(service, [])).toBe(false);
      expect(canMoveExternalAssets(/** @type {any} */ ({}), [file])).toBe(false);
      /** @type {any} */ (assetsLocked).current = true;
      expect(canMoveExternalAssets(service, [file])).toBe(false);
    });
  });

  describe('getDraggedAssets', () => {
    it('drags the asset alone when it’s not selected', () => {
      selectedAssets.current = [b];
      expect(getDraggedAssets(a)).toEqual({ assets: [a] });
    });

    it('drags every selected asset when the asset is one of them', () => {
      selectedAssets.current = [b, { ...a }];
      expect(getDraggedAssets(a)?.assets).toEqual([b, { ...a }]);
      // A copy, which the selection being cleared doesn’t empty
      expect(getDraggedAssets(a)?.assets).not.toBe(selectedAssets.current);
    });

    it('drags nothing when the assets can’t be moved', () => {
      /** @type {any} */ (assetsLocked).current = true;
      expect(getDraggedAssets(a)).toBeUndefined();
    });
  });

  /**
   * Create a file on a service.
   * @param {string} path Path relative to the prefix.
   * @returns {any} File.
   */
  const createFile = (path) => ({ id: `uploads/${path}`, description: path });

  /**
   * Create a service that can do everything a move takes.
   * @param {string} serviceId Service ID.
   * @returns {any} Service.
   */
  const createService = (serviceId) => ({
    serviceId,
    upload: vi.fn(),
    delete: vi.fn(),
    move: vi.fn(),
    listFolder: vi.fn(),
  });

  describe('getDraggedExternalAssets', () => {
    const s3 = createService('aws_s3');
    const x = createFile('x.png');
    const y = createFile('y.png');

    it('drags the file alone, or every selected file when it’s one of them', () => {
      selectedExternalAssets.current = [y];
      expect(getDraggedExternalAssets(x, s3)).toEqual({ externalAssets: [x], service: s3 });
      selectedExternalAssets.current = [x, y];
      expect(getDraggedExternalAssets(x, s3)).toEqual({ externalAssets: [x, y], service: s3 });
    });

    it('drags nothing when the files can’t be moved', () => {
      expect(getDraggedExternalAssets(x, { ...s3, delete: undefined })).toBeUndefined();
    });
  });

  describe('getMovableExternalAssets', () => {
    const service = createService('aws_s3');
    const assets = [createFile('a.png'), createFile('trips/b.png')];

    it('moves every file to another location', () => {
      expect(
        getMovableExternalAssets({ assets, service, destination: { dirPath: 'static/x' } }),
      ).toEqual(assets);
      expect(
        getMovableExternalAssets({
          assets,
          service,
          destination: { service: createService('cloudflare_r2'), dirPath: '' },
        }),
      ).toEqual(assets);
    });

    it('leaves the files already in the folder of the same service', () => {
      expect(
        getMovableExternalAssets({ assets, service, destination: { service, dirPath: 'trips' } }),
      ).toEqual([assets[0]]);
    });

    it('moves nothing on a service that can’t move a file or list a folder in full', () => {
      [
        { ...service, move: undefined },
        { ...service, listFolder: undefined },
      ].forEach((other) => {
        expect(
          getMovableExternalAssets({
            assets,
            service: other,
            destination: { service: other, dirPath: '' },
          }),
        ).toEqual([]);
      });
    });
  });

  describe('canMoveRequestTo', () => {
    const s3 = createService('aws_s3');
    const r2 = createService('cloudflare_r2');
    const projects = /** @type {any} */ ({ internalPath: 'static/projects' });
    const request = { externalAssets: [createFile('a.png')], service: s3 };

    it('refuses without dragged files', () => {
      expect(canMoveRequestTo({ request: undefined, folder, dirPath: 'static/uploads' })).toBe(
        false,
      );
    });

    it('checks repository assets as canMoveAssetsTo does', () => {
      expect(
        canMoveRequestTo({
          request: { assets: [a] },
          folder: projects,
          dirPath: 'static/projects',
        }),
      ).toBe(true);
      expect(
        canMoveRequestTo({ request: { assets: [a] }, folder, dirPath: 'static/uploads' }),
      ).toBe(false);
    });

    it('lets files on a service go to a repository folder files can be added to', () => {
      expect(canMoveRequestTo({ request, folder: projects, dirPath: 'static/projects' })).toBe(
        true,
      );
      expect(canMoveRequestTo({ request, dirPath: 'static/projects' })).toBe(false);
      expect(canMoveRequestTo({ request, folder, dirPath: 'static/admin' })).toBe(false);
    });

    it('lets files on a service go to another service, or another folder on their own', () => {
      expect(canMoveRequestTo({ request, service: r2, dirPath: '' })).toBe(true);
      expect(canMoveRequestTo({ request, service: s3, dirPath: 'trips' })).toBe(true);
      // Already there
      expect(canMoveRequestTo({ request, service: s3, dirPath: '' })).toBe(false);
      expect(
        canMoveRequestTo({ request, service: { ...r2, upload: undefined }, dirPath: '' }),
      ).toBe(false);
      expect(canMoveRequestTo({ request, service: createService('no_key'), dirPath: '' })).toBe(
        false,
      );
    });

    it('refuses files on a service that can’t be moved', () => {
      /** @type {any} */ (assetsLocked).current = true;
      expect(canMoveRequestTo({ request, service: r2, dirPath: '' })).toBe(false);
    });
  });
});
