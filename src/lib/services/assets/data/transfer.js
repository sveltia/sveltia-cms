import { assetUpdatesToast } from '$lib/services/assets/data';
import { prepareAssetChanges } from '$lib/services/assets/data/create';
import { updateStores as updateDeletedAssetStores } from '$lib/services/assets/data/delete';
import { planReferenceRewrite, saveReferenceChanges } from '$lib/services/assets/data/move';
import {
  getAssetMoveConflicts,
  getAssetsUsedEntries,
  moveAssetsToFolder,
} from '$lib/services/assets/data/move-to-folder';
import {
  getCloudServicePath,
  getFetchOptions,
  selectedCloudService,
} from '$lib/services/assets/external';
import {
  externalAssetsToast,
  fetchExternalAssetBlob,
  loadExternalAssets,
} from '$lib/services/assets/external/data';
import { getExternalAssetsUsedEntries } from '$lib/services/assets/external/details';
import {
  moveFilesWithReferences,
  planExternalReferenceRewrite,
} from '$lib/services/assets/external/move';
import { formatFileName } from '$lib/services/assets/file-name';
import { getAssetBlob, getAssetPublicURL } from '$lib/services/assets/info';
import { getMovableAssets, getMovableExternalAssets } from '$lib/services/assets/movable';
import { leaveMovedAsset, replaceShownAssetPath } from '$lib/services/assets/navigation';
import { getAssetReferenceTarget } from '$lib/services/assets/reference-target';
import { assertOutsideCmsFolders } from '$lib/services/assets/reserved';
import { getRelativePath } from '$lib/services/assets/subfolders';
import { UPDATE_TOAST_DEFAULT_STATE } from '$lib/services/contents/collection/data';
import { createPath, getBaseName, getDirName, readBlobAsFile } from '$lib/services/utils/file';
import { runWithUndo } from '$lib/services/utils/undo';

/**
 * @import {
 * Asset,
 * AssetFolderInfo,
 * AssetMoveDestination,
 * AssetMoveRequest,
 * Entry,
 * ExternalAsset,
 * FileChange,
 * MediaLibraryService,
 * } from '$lib/types/private';
 * @import { ReferenceRewritePlan } from '$lib/services/assets/data/move';
 */

/**
 * Where files are moved to: a directory in a repository asset folder, or a folder on a cloud
 * storage service, an empty path being its root.
 * @typedef {{ folder: AssetFolderInfo, service?: undefined, dirPath: string } | {
 * service: MediaLibraryService, folder?: undefined, dirPath: string }} TransferDestination
 */

/**
 * Delete files from a cloud storage service, without letting a failure get in the way: the files
 * have been copied by then, so the move itself has succeeded.
 * @param {MediaLibraryService} service Service.
 * @param {ExternalAsset[]} assets Files to delete.
 * @returns {Promise<boolean>} Whether the files have been deleted.
 */
const deleteQuietly = async (service, assets) => {
  try {
    await service.delete?.(assets, getFetchOptions(service));

    return true;
  } catch (ex) {
    // eslint-disable-next-line no-console
    console.error(ex);

    return false;
  }
};

/**
 * Read the given files one at a time. Reading them all at once would keep many file-system reads
 * in flight, which a browser refuses past a point, and every file in memory at the same time.
 * @template T
 * @param {T[]} items Files to read.
 * @param {(item: T) => Promise<File>} read Function reading a file.
 * @returns {Promise<File[]>} Files, in the same order.
 */
const readFiles = async (items, read) => {
  /** @type {File[]} */
  const files = [];

  // eslint-disable-next-line no-restricted-syntax
  for (const item of items) {
    // eslint-disable-next-line no-await-in-loop
    files.push(await read(item));
  }

  return files;
};

/**
 * Get the names of the files right in a folder on a cloud storage service, listed from the service
 * in full: the listing the folder tree was built from can stop short of the end on a service
 * holding many files, and a move onto a name missing from it would overwrite that file.
 * @param {MediaLibraryService} service Service, which can list a folder.
 * @param {string} dirPath Folder path relative to the configured prefix.
 * @returns {Promise<string[]>} File names.
 */
const getFileNamesInFolder = async (service, dirPath) => {
  const { listFolder } = /** @type {Required<MediaLibraryService>} */ (service);
  const { assets } = await listFolder(dirPath, getFetchOptions(service));

  return assets
    .map(({ description }) => description)
    .filter((path) => getDirName(path) === dirPath)
    .map(getBaseName);
};

/**
 * Upload files to a folder on a cloud storage service, which renames a file whose name is taken
 * there, then save the entries using them, pointing at the uploaded files, along with any other
 * changes. The files are uploaded one at a time, so each upload is known to belong to its file: a
 * service like Uploadcare takes several files in one request, but its response lists them in no
 * particular order. If an upload or the save fails, the files uploaded so far are deleted again.
 * @param {object} args Arguments.
 * @param {MediaLibraryService} args.service Service, which can upload and delete files.
 * @param {File[]} args.files Files.
 * @param {string} args.dirPath Folder path relative to the configured prefix.
 * @param {ReferenceRewritePlan} args.plan Entries using the files, in the same order.
 * @param {FileChange[]} [args.changes] Changes to other files, e.g. the repository files being
 * deleted.
 * @param {'uploadMedia' | 'deleteMedia'} args.commitType Commit type.
 * @returns {Promise<ExternalAsset[]>} Uploaded files, in the same order.
 */
const uploadFilesWithReferences = ({ service, files, dirPath, ...saveOptions }) => {
  const { upload } = /** @type {Required<MediaLibraryService>} */ (service);
  const fetchOptions = getFetchOptions(service);

  return runWithUndo(
    files.map((file) => ({
      // eslint-disable-next-line jsdoc/require-jsdoc
      run: async () => (await upload([file], { ...fetchOptions, dirPath }))[0],
      // eslint-disable-next-line jsdoc/require-jsdoc
      undo: async (uploadedAsset) => {
        await service.delete?.([uploadedAsset], fetchOptions);
      },
    })),
    (uploadedAssets) =>
      saveReferenceChanges({
        ...saveOptions,
        newURLs: uploadedAssets.map(({ downloadURL }) => downloadURL),
      }),
  );
};

/**
 * Report a successful move.
 * @param {number} count Number of files moved.
 */
const reportMoved = (count) => {
  assetUpdatesToast.current = { ...UPDATE_TOAST_DEFAULT_STATE, moved: true, count };
};

/**
 * Move repository assets to a cloud storage service: upload them, then delete them from the
 * repository while pointing the entries using them at the uploaded files, in one commit. The
 * uploaded files are deleted again if an upload or the commit fails, so nothing is left behind. A
 * file whose name is taken in the folder on the service is renamed, as an upload is.
 * @param {object} args Arguments.
 * @param {Asset[]} args.assets Assets to move.
 * @param {MediaLibraryService} args.service Service to move them to.
 * @param {string} args.dirPath Folder on the service, relative to the configured prefix. An empty
 * string for the root.
 * @throws {Error} When an entry using the assets is read-only, or the upload or the commit fails.
 */
export const moveAssetsToService = async ({ assets, service, dirPath }) => {
  assertOutsideCmsFolders(assets.map(({ path }) => path));

  // Refused up front if a read-only entry uses an asset, before anything is uploaded
  const plan = await planReferenceRewrite(assets.map(getAssetReferenceTarget));

  const files = await readFiles(assets, async (asset) =>
    readBlobAsFile(await getAssetBlob(asset), asset.name),
  );

  await uploadFilesWithReferences({
    service,
    files,
    dirPath,
    plan,
    // The assets are deleted from the repository in the same commit as the entries are updated
    changes: assets.map(({ path, sha }) => ({ action: 'delete', path, previousSha: sha })),
    commitType: 'deleteMedia',
  });

  updateDeletedAssetStores({ assets, notify: false });
  reportMoved(assets.length);
};

/**
 * Move files on a cloud storage service to another folder on the same service, with its own move
 * operation, renaming a file whose name is taken there. The entries using the files are updated.
 * If a move or the update fails, the files moved so far are moved back.
 * @param {object} args Arguments.
 * @param {ExternalAsset[]} args.assets Files to move.
 * @param {MediaLibraryService} args.service Service.
 * @param {string} args.dirPath Folder to move them to.
 * @param {ReferenceRewritePlan} args.plan Entries using the files, found before they were moved.
 */
const moveWithinService = async ({ assets, service, dirPath, plan }) => {
  const names = await getFileNamesInFolder(service, dirPath);

  await moveFilesWithReferences({
    service,
    moves: assets.map((asset) => {
      const name = formatFileName(asset.fileName, { assetNamesInSameFolder: names });

      names.push(name);

      return { asset, path: createPath([dirPath, name]) };
    }),
    plan,
  });
};

/**
 * Copy files on a cloud storage service to the repository or to another service, pointing the
 * entries using them at the copies. A copy uploaded to another service is deleted again if the
 * entries can’t be saved.
 * @param {object} args Arguments.
 * @param {ExternalAsset[]} args.assets Files to copy.
 * @param {TransferDestination} args.destination Where to copy them to.
 * @param {ReferenceRewritePlan} args.plan Entries using the files, found before they were moved.
 */
const copyFromService = async ({ assets, destination, plan }) => {
  // A file on a cloud storage service is only available at its public URL, so the service has to
  // allow cross-origin requests
  const files = await readFiles(assets, async (asset) =>
    readBlobAsFile(await fetchExternalAssetBlob(asset), asset.fileName),
  );

  if (destination.service) {
    const { service, dirPath } = destination;

    await uploadFilesWithReferences({ service, files, dirPath, plan, commitType: 'uploadMedia' });

    return;
  }

  const { folder, dirPath } = destination;

  // Named the way an upload to the folder is, which renames a file whose name is taken there
  const { savingAssets, changes } = prepareAssetChanges({
    folder,
    subfolderPath: getRelativePath(dirPath, /** @type {string} */ (folder.internalPath)),
    files,
  });

  await saveReferenceChanges({
    plan,
    newURLs: savingAssets.map(
      (asset) =>
        /** @type {string} */ (getAssetPublicURL(asset, { pathOnly: true, allowSpecial: true })),
    ),
    changes,
    savingAssets,
    commitType: 'uploadMedia',
  });
};

/**
 * Move files on a cloud storage service to a repository folder, to another folder on the same
 * service, or to another service, updating the entries that use them. A file is first copied to
 * the destination, then the entries are saved, then the original is deleted, so a failure along
 * the way never leaves an entry pointing at a file that’s gone. If only the deletion fails, the
 * move has still succeeded, and a warning says the originals are left on the service.
 * @param {object} args Arguments.
 * @param {ExternalAsset[]} args.assets Files to move.
 * @param {MediaLibraryService} args.service Service the files are on.
 * @param {TransferDestination} args.destination Where to move them to.
 * @throws {Error} When an entry using the files is read-only, or the copy or the commit fails.
 */
export const moveExternalAssets = async ({ assets, service, destination }) => {
  const sameService = destination.service?.serviceId === service.serviceId;
  const movingAssets = getMovableExternalAssets({ assets, service, destination });

  if (!movingAssets.length) {
    return;
  }

  // Refused up front if the entries using a file can’t be updated, before anything is copied
  const plan = await planExternalReferenceRewrite(movingAssets);

  if (sameService) {
    await moveWithinService({
      assets: movingAssets,
      service,
      dirPath: destination.dirPath,
      plan,
    });
  } else {
    await copyFromService({ assets: movingAssets, destination, plan });

    if (!(await deleteQuietly(service, movingAssets))) {
      externalAssetsToast.current = {
        show: true,
        status: 'warning',
        message: 'asset_move_cleanup_failed',
      };
    }
  }

  if (selectedCloudService.current?.serviceId === service.serviceId) {
    await loadExternalAssets(service);
  }

  reportMoved(movingAssets.length);
};

/**
 * Get what moving the requested files to a destination would do: how many files would actually
 * move, and the names of those that can’t, as a file of the same name is in a repository directory.
 * A file moved to a cloud storage service, or from one, is renamed instead, as an upload is.
 * @param {AssetMoveRequest} request Files to move.
 * @param {AssetMoveDestination} destination Destination.
 * @returns {{ movableCount: number, conflicts: string[] }} Summary.
 */
export const getMoveSummary = ({ assets = [], externalAssets = [], service }, destination) => {
  if (service) {
    return {
      movableCount: getMovableExternalAssets({
        assets: externalAssets,
        service,
        destination,
      }).length,
      conflicts: [],
    };
  }

  if (destination.service) {
    return { movableCount: assets.length, conflicts: [] };
  }

  const { dirPath } = destination;

  return {
    movableCount: getMovableAssets({ assets, dirPath }).length,
    conflicts: getAssetMoveConflicts({ assets, dirPath }),
  };
};

/**
 * Get the entries using any of the requested files, each listed once, which a move updates.
 * @param {AssetMoveRequest} request Files to move.
 * @returns {Promise<Entry[]>} Entries.
 */
export const getMoveRequestUsedEntries = ({ assets = [], externalAssets = [], service }) =>
  service ? getExternalAssetsUsedEntries(externalAssets) : getAssetsUsedEntries(assets);

/**
 * Move the requested files to a destination: a repository directory or a folder on a cloud storage
 * service, whichever the files are in now.
 * @param {AssetMoveRequest} request Files to move.
 * @param {AssetMoveDestination} destination Destination.
 * @throws {Error} When the move fails.
 */
export const moveToDestination = async (
  { assets = [], externalAssets = [], service },
  destination,
) => {
  if (service) {
    await moveExternalAssets({ assets: externalAssets, service, destination });
  } else if (destination.service) {
    await moveAssetsToService({
      assets,
      service: destination.service,
      dirPath: destination.dirPath,
    });
  } else {
    await moveAssetsToFolder({ assets, folder: destination.folder, dirPath: destination.dirPath });
  }
};

/**
 * Update the details view once the requested files have been moved, if it shows one of them. An
 * asset moved within the repository is followed to its new path; one moved to or from a cloud
 * storage service has no details view at the same place any more, so the list it’s been moved out
 * of is shown instead.
 * @param {AssetMoveRequest} request Files that have been moved.
 * @param {AssetMoveDestination} destination Destination.
 */
export const followMovedAssets = async (
  { assets = [], externalAssets = [], service },
  destination,
) => {
  if (service) {
    const listPath = getCloudServicePath(service);
    // A file already in the folder has stayed where it was
    const movedAssets = getMovableExternalAssets({ assets: externalAssets, service, destination });

    await Promise.all(movedAssets.map(({ id }) => leaveMovedAsset(`${listPath}/${id}`, listPath)));
  } else if (destination.service) {
    await Promise.all(
      assets.map(({ path }) => leaveMovedAsset(`/assets/${path}`, `/assets/${getDirName(path)}`)),
    );
  } else {
    await Promise.all(
      assets.map(({ path, name }) =>
        replaceShownAssetPath(path, createPath([destination.dirPath, name])),
      ),
    );
  }
};
