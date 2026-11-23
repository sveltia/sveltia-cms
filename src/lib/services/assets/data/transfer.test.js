import { beforeEach, describe, expect, it, vi } from 'vitest';

import { assetUpdatesToast } from '$lib/services/assets/data';
import { prepareAssetChanges } from '$lib/services/assets/data/create';
import { updateStores as updateDeletedAssetStores } from '$lib/services/assets/data/delete';
import { planReferenceRewrite, saveReferenceChanges } from '$lib/services/assets/data/move';
import {
  getAssetMoveConflicts,
  getAssetsUsedEntries,
  moveAssetsToFolder,
} from '$lib/services/assets/data/move-to-folder';
import { selectedCloudService } from '$lib/services/assets/external';
import {
  externalAssetsToast,
  fetchExternalAssetBlob,
  loadExternalAssets,
} from '$lib/services/assets/external/data';
import { getExternalAssetsUsedEntries } from '$lib/services/assets/external/details';
import { getAssetBlob, getAssetPublicURL } from '$lib/services/assets/info';
import { leaveMovedAsset, replaceShownAssetPath } from '$lib/services/assets/navigation';
import { assertOutsideCmsFolders } from '$lib/services/assets/reserved';

import {
  followMovedAssets,
  getMoveRequestUsedEntries,
  getMoveSummary,
  moveAssetsToService,
  moveExternalAssets,
  moveToDestination,
} from './transfer.js';

vi.mock('$lib/services/assets/data', () => ({ assetUpdatesToast: { current: undefined } }));
vi.mock('$lib/services/assets/data/create', () => ({ prepareAssetChanges: vi.fn() }));
vi.mock('$lib/services/assets/data/delete', () => ({ updateStores: vi.fn() }));

vi.mock('$lib/services/assets/data/move', () => ({
  getMoveBlockedMessage: vi.fn(),
  planReferenceRewrite: vi.fn(),
  saveReferenceChanges: vi.fn(),
}));

vi.mock('$lib/services/assets/data/move-to-folder', () => ({
  getAssetMoveConflicts: vi.fn(() => ['taken.png']),
  getAssetsUsedEntries: vi.fn(),
  moveAssetsToFolder: vi.fn(),
}));

vi.mock('$lib/services/assets/external', () => ({
  getCloudServicePath: vi.fn(({ serviceId }) => `/assets/-/${serviceId}`),
  getFetchOptions: vi.fn(() => ({ apiKey: 'key' })),
  selectedCloudService: { current: undefined },
}));

vi.mock('$lib/services/assets/external/data', () => ({
  externalAssetsToast: { current: { show: false, status: 'info', message: '' } },
  fetchExternalAssetBlob: vi.fn(),
  loadExternalAssets: vi.fn(),
}));

vi.mock('$lib/services/assets/external/details', () => ({
  getExternalAssetsUsedEntries: vi.fn(),
}));

vi.mock('$lib/services/assets/info', () => ({
  getAssetBlob: vi.fn(),
  getAssetPublicURL: vi.fn(),
}));

vi.mock('$lib/services/assets/movable', async (importOriginal) => ({
  ...(await importOriginal()),
  getMovableAssets: vi.fn(({ assets }) => assets.slice(1)),
}));

vi.mock('$lib/services/assets/navigation', () => ({
  leaveMovedAsset: vi.fn(),
  replaceShownAssetPath: vi.fn(),
}));

vi.mock('$lib/services/assets/reference-target', () => ({
  getAssetReferenceTarget: vi.fn((asset) => ({ url: `/${asset.path}` })),
}));

vi.mock('$lib/services/assets/reserved', () => ({ assertOutsideCmsFolders: vi.fn() }));

vi.mock('$lib/services/contents/collection/data', () => ({
  UPDATE_TOAST_DEFAULT_STATE: { moved: false, count: 0 },
}));

const S3_URL = 'https://bucket.example.com';
const ENTRY = /** @type {any} */ ({ id: 'a' });
const globalFolder = /** @type {any} */ ({ internalPath: 'static/uploads' });

/**
 * Create a repository asset.
 * @param {string} name File name.
 * @returns {any} Asset.
 */
const createAsset = (name) => ({
  name,
  path: `static/uploads/${name}`,
  sha: `sha-${name}`,
  folder: globalFolder,
});

/**
 * Create a file on a service.
 * @param {string} path Path relative to the prefix.
 * @returns {any} Asset.
 */
const createExternalAsset = (path) => ({
  id: `uploads/${path}`,
  description: path,
  fileName: path.split('/').pop(),
  downloadURL: `${S3_URL}/uploads/${path}`,
});

/**
 * Create a mock cloud storage service. Uploaded and moved files land at the given path.
 * @param {string} serviceId Service ID.
 * @returns {any} Service.
 */
const createService = (serviceId) => ({
  serviceId,
  upload: vi.fn(async (/** @type {File[]} */ files, /** @type {any} */ { dirPath }) =>
    files.map(({ name }) => createExternalAsset(dirPath ? `${dirPath}/${name}` : name)),
  ),
  move: vi.fn(async (/** @type {any} */ _asset, /** @type {string} */ path) =>
    createExternalAsset(path),
  ),
  delete: vi.fn(),
  listFolder: vi.fn(async () => ({ assets: [], folders: [] })),
});

describe('assets/data/transfer', () => {
  beforeEach(() => {
    vi.mocked(planReferenceRewrite).mockImplementation(async (targets) => ({
      targets,
      usedEntries: targets.map(() => [ENTRY]),
    }));
    vi.mocked(saveReferenceChanges).mockResolvedValue(undefined);
    vi.mocked(getAssetBlob).mockResolvedValue(new Blob(['png'], { type: 'image/png' }));
    vi.mocked(fetchExternalAssetBlob).mockResolvedValue(new Blob(['png'], { type: 'image/png' }));
    selectedCloudService.current = undefined;
    externalAssetsToast.current = { show: false, status: 'info', message: '' };
    assetUpdatesToast.current = /** @type {any} */ (undefined);
  });

  describe('moveAssetsToService', () => {
    it('uploads the assets, then deletes them while linking the entries to the uploads', async () => {
      const service = createService('aws_s3');
      const assets = [createAsset('a.png'), createAsset('b.png')];

      await moveAssetsToService({ assets, service, dirPath: 'trips' });

      expect(assertOutsideCmsFolders).toHaveBeenCalledWith([
        'static/uploads/a.png',
        'static/uploads/b.png',
      ]);

      // One file at a time, so each upload is known to belong to its file
      expect(
        service.upload.mock.calls.map((/** @type {any[]} */ [files, options]) => [
          files.map((/** @type {File} */ { name, type }) => [name, type]),
          options,
        ]),
      ).toEqual([
        [[['a.png', 'image/png']], { apiKey: 'key', dirPath: 'trips' }],
        [[['b.png', 'image/png']], { apiKey: 'key', dirPath: 'trips' }],
      ]);

      // The repository files are deleted in the same commit as the entries are updated
      expect(saveReferenceChanges).toHaveBeenCalledExactlyOnceWith({
        plan: {
          targets: [{ url: '/static/uploads/a.png' }, { url: '/static/uploads/b.png' }],
          usedEntries: [[ENTRY], [ENTRY]],
        },
        newURLs: [`${S3_URL}/uploads/trips/a.png`, `${S3_URL}/uploads/trips/b.png`],
        changes: [
          { action: 'delete', path: 'static/uploads/a.png', previousSha: 'sha-a.png' },
          { action: 'delete', path: 'static/uploads/b.png', previousSha: 'sha-b.png' },
        ],
        commitType: 'deleteMedia',
      });
      expect(updateDeletedAssetStores).toHaveBeenCalledWith({ assets, notify: false });
      expect(assetUpdatesToast.current).toEqual({ moved: true, count: 2 });
      expect(service.delete).not.toHaveBeenCalled();
    });

    it('refuses before uploading anything when a read-only entry uses an asset', async () => {
      const service = createService('aws_s3');

      vi.mocked(planReferenceRewrite).mockRejectedValue(new Error('Read-only'));

      await expect(
        moveAssetsToService({ assets: [createAsset('a.png')], service, dirPath: '' }),
      ).rejects.toThrow('Read-only');
      expect(service.upload).not.toHaveBeenCalled();
    });

    it('deletes the files uploaded so far when an upload fails', async () => {
      const service = createService('aws_s3');

      service.upload
        .mockResolvedValueOnce([createExternalAsset('a.png')])
        .mockRejectedValueOnce(new Error('Upload failed'));

      await expect(
        moveAssetsToService({
          assets: [createAsset('a.png'), createAsset('b.png')],
          service,
          dirPath: '',
        }),
      ).rejects.toThrow('Upload failed');
      expect(service.delete).toHaveBeenCalledWith([createExternalAsset('a.png')], {
        apiKey: 'key',
      });
      expect(saveReferenceChanges).not.toHaveBeenCalled();
    });

    it('deletes the uploads again when the commit fails', async () => {
      const service = createService('aws_s3');

      vi.mocked(saveReferenceChanges).mockRejectedValue(new Error('Commit failed'));

      await expect(
        moveAssetsToService({ assets: [createAsset('a.png')], service, dirPath: '' }),
      ).rejects.toThrow('Commit failed');
      expect(service.delete).toHaveBeenCalledWith([createExternalAsset('a.png')], {
        apiKey: 'key',
      });
      expect(updateDeletedAssetStores).not.toHaveBeenCalled();
    });
  });

  describe('moveExternalAssets', () => {
    it('moves files within the service, renaming one whose name is taken', async () => {
      const service = createService('aws_s3');
      const a = createExternalAsset('a.png');
      const b = createExternalAsset('b.png');
      const here = createExternalAsset('trips/c.png');

      selectedCloudService.current = service;
      service.listFolder.mockResolvedValue({
        assets: [createExternalAsset('trips/b.png')],
        folders: [],
      });

      await moveExternalAssets({
        assets: [a, b, here],
        service,
        destination: { service, dirPath: 'trips' },
      });

      expect(
        service.move.mock.calls.map((/** @type {any[]} */ [asset, path]) => [asset.id, path]),
      ).toEqual([
        ['uploads/a.png', 'trips/a.png'],
        ['uploads/b.png', 'trips/b-1.png'],
      ]);
      expect(saveReferenceChanges).toHaveBeenCalledExactlyOnceWith({
        plan: {
          targets: [{ url: a.downloadURL }, { url: b.downloadURL }],
          usedEntries: [[ENTRY], [ENTRY]],
        },
        newURLs: [`${S3_URL}/uploads/trips/a.png`, `${S3_URL}/uploads/trips/b-1.png`],
        commitType: 'uploadMedia',
      });
      expect(loadExternalAssets).toHaveBeenCalledWith(service);
      expect(assetUpdatesToast.current).toEqual({ moved: true, count: 2 });
    });

    it('lists the folder in full to find the names taken there, when the service can', async () => {
      const service = {
        ...createService('aws_s3'),
        // The folder tree was cut short, but the full listing has a file of the same name, along
        // with one in a subfolder, which doesn’t count
        listFolder: vi.fn(async () => ({
          assets: [createExternalAsset('x/a.png'), createExternalAsset('x/sub/b.png')],
          folders: [],
        })),
      };

      await moveExternalAssets({
        assets: [createExternalAsset('a.png'), createExternalAsset('b.png')],
        service,
        destination: { service, dirPath: 'x' },
      });

      expect(service.listFolder).toHaveBeenCalledWith('x', { apiKey: 'key' });
      expect(service.move.mock.calls.map((/** @type {any[]} */ [, path]) => path)).toEqual([
        'x/a-1.png',
        'x/b.png',
      ]);
    });

    it('moves the other files back when one can’t be moved back', async () => {
      const service = createService('aws_s3');
      const a = createExternalAsset('a.png');
      const b = createExternalAsset('b.png');
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});

      vi.mocked(saveReferenceChanges).mockRejectedValue(new Error('Commit failed'));
      // The first file can’t be moved back
      service.move
        .mockResolvedValueOnce(createExternalAsset('x/a.png'))
        .mockResolvedValueOnce(createExternalAsset('x/b.png'))
        .mockRejectedValueOnce(new Error('Gone'));

      await expect(
        moveExternalAssets({ assets: [a, b], service, destination: { service, dirPath: 'x' } }),
      ).rejects.toThrow('Commit failed');
      expect(service.move).toHaveBeenCalledTimes(4);
      expect(service.move.mock.calls[3][1]).toBe('b.png');
      expect(error).toHaveBeenCalledWith(new Error('Gone'));
      expect(loadExternalAssets).not.toHaveBeenCalled();
    });

    it('moves files back after a failed commit, in the same order', async () => {
      const service = createService('aws_s3');
      const a = createExternalAsset('a.png');

      vi.mocked(saveReferenceChanges).mockRejectedValue(new Error('Commit failed'));

      await expect(
        moveExternalAssets({ assets: [a], service, destination: { service, dirPath: 'x' } }),
      ).rejects.toThrow('Commit failed');
      expect(
        service.move.mock.calls.map((/** @type {any[]} */ [asset, path]) => [asset.id, path]),
      ).toEqual([
        ['uploads/a.png', 'x/a.png'],
        ['uploads/x/a.png', 'a.png'],
      ]);
    });

    it('tells the same service by its ID, not by the object', async () => {
      const service = createService('aws_s3');

      await moveExternalAssets({
        assets: [createExternalAsset('a.png')],
        service,
        destination: { service: { ...service }, dirPath: 'x' },
      });

      expect(service.move).toHaveBeenCalled();
      expect(service.upload).not.toHaveBeenCalled();
    });

    it('moves the files moved so far back when a move fails', async () => {
      const service = createService('aws_s3');

      service.move
        .mockResolvedValueOnce(createExternalAsset('x/a.png'))
        .mockRejectedValueOnce(new Error('Move failed'));

      await expect(
        moveExternalAssets({
          assets: [createExternalAsset('a.png'), createExternalAsset('b.png')],
          service,
          destination: { service, dirPath: 'x' },
        }),
      ).rejects.toThrow('Move failed');
      expect(service.move.mock.calls[2].slice(0, 2)).toEqual([
        createExternalAsset('x/a.png'),
        'a.png',
      ]);
      expect(saveReferenceChanges).not.toHaveBeenCalled();
    });

    it('does nothing when every file is in the folder already', async () => {
      const service = createService('aws_s3');

      await moveExternalAssets({
        assets: [createExternalAsset('x/a.png')],
        service,
        destination: { service, dirPath: 'x' },
      });

      expect(planReferenceRewrite).not.toHaveBeenCalled();
      expect(assetUpdatesToast.current).toBeUndefined();
    });

    it('copies files to another service, then deletes the originals', async () => {
      const service = createService('aws_s3');
      const r2 = createService('cloudflare_r2');
      const a = createExternalAsset('a.png');

      await moveExternalAssets({ assets: [a], service, destination: { service: r2, dirPath: '' } });

      expect(fetchExternalAssetBlob).toHaveBeenCalledWith(a);
      expect(r2.upload.mock.calls[0][0][0].name).toBe('a.png');
      expect(saveReferenceChanges).toHaveBeenCalledWith(
        expect.objectContaining({
          newURLs: [`${S3_URL}/uploads/a.png`],
          commitType: 'uploadMedia',
        }),
      );
      expect(service.delete).toHaveBeenCalledWith([a], { apiKey: 'key' });
      expect(externalAssetsToast.current.show).toBe(false);
      // The service isn’t being browsed
      expect(loadExternalAssets).not.toHaveBeenCalled();
      expect(assetUpdatesToast.current).toEqual({ moved: true, count: 1 });
    });

    it('warns when the originals can’t be deleted after the copy', async () => {
      const service = createService('aws_s3');
      const r2 = createService('cloudflare_r2');

      vi.spyOn(console, 'error').mockImplementation(() => {});
      service.delete.mockRejectedValue(new Error('Forbidden'));

      await moveExternalAssets({
        assets: [createExternalAsset('a.png')],
        service,
        destination: { service: r2, dirPath: '' },
      });

      expect(externalAssetsToast.current).toEqual({
        show: true,
        status: 'warning',
        message: 'asset_move_cleanup_failed',
      });
      expect(assetUpdatesToast.current).toEqual({ moved: true, count: 1 });
    });

    it('deletes the copies on the other service when the entries can’t be saved', async () => {
      const service = createService('aws_s3');
      const r2 = createService('cloudflare_r2');

      vi.mocked(saveReferenceChanges).mockRejectedValue(new Error('Commit failed'));

      await expect(
        moveExternalAssets({
          assets: [createExternalAsset('a.png')],
          service,
          destination: { service: r2, dirPath: 'x' },
        }),
      ).rejects.toThrow('Commit failed');
      expect(r2.delete).toHaveBeenCalledWith([createExternalAsset('x/a.png')], { apiKey: 'key' });
      expect(service.delete).not.toHaveBeenCalled();
    });

    it('copies files to a repository folder, naming them the way an upload is', async () => {
      const service = createService('aws_s3');
      const a = createExternalAsset('trips/a.png');

      const savingAsset = /** @type {any} */ ({
        name: 'a.png',
        path: 'static/uploads/2024/a.png',
        size: 3,
        kind: 'image',
        folder: globalFolder,
      });

      const change = /** @type {any} */ ({ action: 'create', path: 'static/uploads/2024/a.png' });

      vi.mocked(prepareAssetChanges).mockReturnValue({
        savingAssets: [savingAsset],
        changes: [change],
      });
      vi.mocked(getAssetPublicURL).mockReturnValue('/uploads/2024/a.png');

      await moveExternalAssets({
        assets: [a],
        service,
        destination: { folder: globalFolder, dirPath: 'static/uploads/2024' },
      });

      const { files, ...uploadingAssets } = vi.mocked(prepareAssetChanges).mock.calls[0][0];

      expect(uploadingAssets).toEqual({ folder: globalFolder, subfolderPath: '2024' });
      expect(files.map(({ name }) => name)).toEqual(['a.png']);
      expect(getAssetPublicURL).toHaveBeenCalledWith(savingAsset, {
        pathOnly: true,
        allowSpecial: true,
      });

      const { newURLs, changes, savingAssets, commitType } =
        vi.mocked(saveReferenceChanges).mock.calls[0][0];

      expect(newURLs).toEqual(['/uploads/2024/a.png']);
      expect(changes).toEqual([change]);
      expect(savingAssets).toEqual([savingAsset]);
      expect(commitType).toBe('uploadMedia');
      expect(service.delete).toHaveBeenCalledWith([a], { apiKey: 'key' });
    });
  });

  describe('getMoveSummary', () => {
    const service = createService('aws_s3');

    it('counts the files on a service that would move, which are renamed rather than refused', () => {
      const request = {
        externalAssets: [createExternalAsset('a.png'), createExternalAsset('x/b.png')],
        service,
      };

      expect(getMoveSummary(request, { service, dirPath: 'x', label: '', children: [] })).toEqual({
        movableCount: 1,
        conflicts: [],
      });
    });

    it('counts every repository asset moved to a service', () => {
      const request = { assets: [createAsset('a.png'), createAsset('b.png')] };

      expect(getMoveSummary(request, { service, dirPath: '', label: '', children: [] })).toEqual({
        movableCount: 2,
        conflicts: [],
      });
    });

    it('reports the name conflicts in a repository directory', () => {
      const assets = [createAsset('a.png'), createAsset('taken.png')];
      const destination = { folder: globalFolder, dirPath: 'static/x', label: '', children: [] };

      expect(getMoveSummary({ assets }, destination)).toEqual({
        movableCount: 1,
        conflicts: ['taken.png'],
      });
      expect(getAssetMoveConflicts).toHaveBeenCalledWith({ assets, dirPath: 'static/x' });
    });
  });

  describe('getMoveRequestUsedEntries', () => {
    it('finds the entries using the files on a service by their URLs', async () => {
      const externalAssets = [createExternalAsset('a.png')];

      vi.mocked(getExternalAssetsUsedEntries).mockResolvedValue([ENTRY]);

      await expect(
        getMoveRequestUsedEntries({ externalAssets, service: createService('aws_s3') }),
      ).resolves.toEqual([ENTRY]);
      expect(getExternalAssetsUsedEntries).toHaveBeenCalledWith(externalAssets);
    });

    it('finds the entries using repository assets', async () => {
      const assets = [createAsset('a.png')];

      vi.mocked(getAssetsUsedEntries).mockResolvedValue([ENTRY]);

      await expect(getMoveRequestUsedEntries({ assets })).resolves.toEqual([ENTRY]);
      expect(getAssetsUsedEntries).toHaveBeenCalledWith(assets);
    });

    it('works without files', async () => {
      await getMoveRequestUsedEntries({});
      await getMoveRequestUsedEntries({ service: createService('aws_s3') });
      expect(getAssetsUsedEntries).toHaveBeenCalledWith([]);
      expect(getExternalAssetsUsedEntries).toHaveBeenCalledWith([]);
    });
  });

  describe('moveToDestination', () => {
    it('moves repository assets to a repository directory', async () => {
      const assets = [createAsset('a.png')];
      const destination = { folder: globalFolder, dirPath: 'static/x', label: '', children: [] };

      await moveToDestination({ assets }, destination);

      expect(moveAssetsToFolder).toHaveBeenCalledWith({
        assets,
        folder: globalFolder,
        dirPath: 'static/x',
      });
    });

    it('moves repository assets to a service', async () => {
      const service = createService('aws_s3');

      await moveToDestination(
        { assets: [createAsset('a.png')] },
        { service, dirPath: '', label: '', children: [] },
      );

      expect(service.upload).toHaveBeenCalled();
      expect(moveAssetsToFolder).not.toHaveBeenCalled();
    });

    it('moves files on a service to another folder on it', async () => {
      const service = createService('aws_s3');

      service.listFolder.mockResolvedValue({
        assets: [createExternalAsset('x/a.png')],
        folders: [],
      });

      await moveToDestination(
        { externalAssets: [createExternalAsset('a.png')], service },
        { service, dirPath: 'x', label: '', children: [] },
      );

      expect(service.move.mock.calls[0][1]).toBe('x/a-1.png');
    });

    it('moves nothing without files', async () => {
      const service = createService('aws_s3');

      await moveToDestination({}, { service, dirPath: 'x', label: '', children: [] });
      await moveToDestination({ service }, { service, dirPath: 'x', label: '', children: [] });
      expect(service.move).not.toHaveBeenCalled();
    });
  });

  describe('followMovedAssets', () => {
    it('follows a repository asset to its new path', async () => {
      await followMovedAssets(
        { assets: [createAsset('a.png')] },
        { folder: globalFolder, dirPath: 'static/x', label: '', children: [] },
      );

      expect(replaceShownAssetPath).toHaveBeenCalledWith('static/uploads/a.png', 'static/x/a.png');
    });

    it('leaves the details view of a repository asset moved to a service', async () => {
      await followMovedAssets(
        { assets: [createAsset('a.png')] },
        { service: createService('aws_s3'), dirPath: '', label: '', children: [] },
      );

      expect(leaveMovedAsset).toHaveBeenCalledWith(
        '/assets/static/uploads/a.png',
        '/assets/static/uploads',
      );
    });

    it('leaves the details view of a file moved off a service', async () => {
      const service = createService('aws_s3');

      await followMovedAssets(
        { externalAssets: [createExternalAsset('a.png')], service },
        { folder: globalFolder, dirPath: 'static/x', label: '', children: [] },
      );

      expect(leaveMovedAsset).toHaveBeenCalledWith(
        '/assets/-/aws_s3/uploads/a.png',
        '/assets/-/aws_s3',
      );
    });

    it('stays on the details view of a file already in the folder on its own service', async () => {
      const service = createService('aws_s3');
      const a = createExternalAsset('a.png');
      const b = createExternalAsset('trips/b.png');

      await followMovedAssets(
        { externalAssets: [a, b], service },
        { service, dirPath: '', label: '', children: [] },
      );

      expect(leaveMovedAsset).toHaveBeenCalledTimes(1);
      expect(leaveMovedAsset).toHaveBeenCalledWith(`/assets/-/aws_s3/${b.id}`, '/assets/-/aws_s3');
    });

    it('works without files', async () => {
      const destination = { folder: globalFolder, dirPath: '', label: '', children: [] };

      await followMovedAssets({}, destination);
      await followMovedAssets({ service: createService('aws_s3') }, destination);
      await followMovedAssets({}, { ...destination, service: createService('aws_s3') });
      expect(leaveMovedAsset).not.toHaveBeenCalled();
      expect(replaceShownAssetPath).not.toHaveBeenCalled();
    });
  });
});
