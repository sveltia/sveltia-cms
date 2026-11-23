import equal from 'fast-deep-equal';
import { sanitize } from 'isomorphic-dompurify';

import { isAssetInFolder } from '$lib/services/assets';
import { getEntryAssetFolderPath } from '$lib/services/assets/entry-folder';
import { formatFileName, isSameFileName } from '$lib/services/assets/file-name';
import { createDisplayBlobURL, getAssetPublicURL } from '$lib/services/assets/info';
import { getAssetKind } from '$lib/services/assets/kinds';
import { createAssetNameTemplate, getPendingFileName } from '$lib/services/assets/name';
import { processFile } from '$lib/services/assets/process';
import { allAssets } from '$lib/services/assets/state';
import { getSlugs } from '$lib/services/contents/draft/slugs';
import {
  isAcceptedFile,
  keepsFileFormat,
} from '$lib/services/integrations/media-libraries/default';
import { createPath, getDirName, getGitHash } from '$lib/services/utils/file';
import { LINK_SANITIZE_OPTIONS } from '$lib/services/utils/string';

/**
 * @import {
 * Asset,
 * AssetFolderInfo,
 * EntryDraft,
 * InternalLocaleCode,
 * SelectedResource,
 * } from '$lib/types/private';
 * @import { DefaultMediaLibraryConfig } from '$lib/types/public';
 */

/**
 * @typedef {object} ProcessResourceResult
 * @property {string | undefined} value Field value for the resource: a public asset path, an
 * external URL, or a temporary blob URL for a file pending upload. `undefined` if the resource
 * cannot be used.
 * @property {string} credit Sanitized photo credit, if the resource comes from a stock photo
 * service.
 * @property {string | undefined} oversizedFileName File name if the file exceeds the size limit.
 * @property {string | undefined} invalidFileName File name if the file is corrupt or mislabeled and
 * therefore cannot be decoded.
 * @property {string | undefined} [mismatchedFileName] File name if the file, once processed, is not
 * one of the accepted file types.
 */

/**
 * Get the blob URL of an unsaved file that matches the given file.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft containing the resource.
 * @param {File} args.file File to be searched.
 * @param {AssetFolderInfo} [args.folder] Asset folder for the field. When the folder is
 * entry-relative, only files in the same folder are considered a match.
 * @param {string} [args.subfolderPath] Subfolder the file is saved to. The same file pending for
 * another subfolder is a different upload.
 * @param {boolean} [args.replace] Whether the file replaces an existing asset with the same name.
 * Such a file must be saved under its own name, so only a pending file replacing one under the same
 * name is a match.
 * @returns {Promise<string | undefined>} Blob URL.
 */
export const getExistingBlobURL = async ({
  draft,
  file,
  folder,
  subfolderPath = '',
  replace = false,
}) => {
  // The Git hash is memoized per file, so the files already in the draft aren’t read again
  const hash = await getGitHash(file);
  /** @type {string | undefined} */
  let foundURL = undefined;

  await Promise.all(
    Object.entries(draft.files ?? {}).map(async ([blobURL, f]) => {
      if (
        !foundURL &&
        (await getGitHash(f.file)) === hash &&
        (!folder?.entryRelative || equal(f.folder, folder)) &&
        (f.subfolderPath ?? '') === subfolderPath &&
        (!replace || (!!f.replace && isSameFileName(f.file.name, file.name)))
      ) {
        foundURL = blobURL;
      }
    }),
  );

  return foundURL;
};

/**
 * Convert unsaved files to the `Asset` format so these can be browsed just like other assets.
 * @param {object} args Arguments.
 * @param {File} args.file Raw file.
 * @param {string} [args.name] Name the file is saved with. Default: the file’s own name.
 * @param {string} [args.blobURL] Blob URL of the file.
 * @param {AssetFolderInfo | undefined} args.folder Asset folder.
 * @param {string} [args.targetFolderPath] Target folder path.
 * @param {string} [args.subfolderPath] Subfolder below the target folder the file is saved to.
 * @param {boolean} [args.replace] Whether the file overwrites an existing asset with the same name.
 * @returns {Promise<Asset>} Asset.
 */
export const convertFileItemToAsset = async ({
  file,
  name = file.name,
  blobURL,
  folder,
  targetFolderPath,
  subfolderPath,
  replace,
}) => {
  const { size } = file;

  return /** @type {Asset} */ ({
    unsaved: true,
    replace: !!replace,
    file,
    blobURL: blobURL ?? (await createDisplayBlobURL(file)),
    name,
    // A provisional path. `listAssets` resolves it against the assets already in the folder,
    // because the final file name is only determined when the entry is saved.
    path: createPath([targetFolderPath, subfolderPath, name]),
    sha: await getGitHash(file),
    size,
    kind: getAssetKind(name),
    folder,
  });
};

/**
 * Get all the unsaved assets, including already cached for the draft and dropped ones.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft containing the resource.
 * @param {string} [args.targetFolderPath] Target folder path.
 * @returns {Promise<Asset[]>} Assets.
 */
export const getUnsavedAssets = async ({ draft, targetFolderPath }) => {
  const items = Object.entries(draft.files);

  // The slug is only needed to fill a file name template, and generating it can be costly
  const defaultLocaleSlug = items.some(([, { nameTemplate }]) => nameTemplate)
    ? getSlugs({ draft }).defaultLocaleSlug
    : '';

  return Promise.all(
    items.map(async ([blobURL, item]) => {
      const { file, folder, replace, subfolderPath } = item;
      const name = getPendingFileName({ draft, item, defaultLocaleSlug });

      return convertFileItemToAsset({
        file,
        name,
        blobURL,
        folder,
        targetFolderPath,
        subfolderPath,
        replace,
      });
    }),
  );
};

/**
 * Get the folder an entry-relative folder stores the entry’s assets in: the entry’s own folder if
 * it has one, and otherwise the folder it shares with the rest of the collection, as determined by
 * {@link getEntryAssetFolderPath}.
 * @param {EntryDraft} draft Entry draft.
 * @param {AssetFolderInfo} folder Entry-relative asset folder associated with the field.
 * @param {InternalLocaleCode} [locale] Locale being edited, whose entry file the assets are stored
 * beside. Default: the default locale.
 * @returns {string | undefined} Folder path, or `undefined` for a new entry, which has no folder
 * yet.
 */
const getEntryAssetBasePath = (draft, folder, locale) => {
  const { originalEntry, defaultLocale, collection } = draft;

  const entryFilePath = (
    (locale ? originalEntry?.locales[locale] : undefined) ?? originalEntry?.locales[defaultLocale]
  )?.path;

  if (!entryFilePath) {
    return undefined;
  }

  const assetFolderPath = getEntryAssetFolderPath({
    collection,
    entryFilePath,
    // An entry-relative folder is always configured with a path
    internalPath: /** @type {string} */ (folder.internalPath),
  });

  return createPath([assetFolderPath, folder.internalSubPath]);
};

/**
 * Get the saved assets relevant to the current entry draft and folder. For entry-relative folders,
 * the result is filtered to only include assets within the folder the entry’s relative assets are
 * saved to, preventing false duplicate detection across entries that share the same folder config
 * template.
 * @param {EntryDraft} draft Entry draft.
 * @param {AssetFolderInfo | undefined} folder Asset folder associated with the field.
 * @param {InternalLocaleCode} [locale] Locale being edited, whose entry file the assets are stored
 * beside. Default: the default locale.
 * @returns {Asset[]} Filtered saved assets.
 */
const getSavedAssetsForEntry = (draft, folder, locale) => {
  const savedAssets = allAssets.current;

  if (!folder?.entryRelative) {
    return savedAssets;
  }

  const expectedPrefix = getEntryAssetBasePath(draft, folder, locale);

  if (expectedPrefix === undefined) {
    // New entry — no saved assets exist for this entry yet
    return [];
  }

  return savedAssets.filter((a) => a.path.startsWith(`${expectedPrefix}/`));
};

/**
 * Get the repository directory a file is uploaded to, if it’s known before the entry is saved.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {AssetFolderInfo} args.folder Asset folder associated with the field.
 * @param {string} [args.subfolderPath] Subfolder below the folder the file is saved to.
 * @param {InternalLocaleCode} [args.locale] Locale being edited.
 * @returns {string | undefined} Directory path, or `undefined` if it depends on the entry, as with
 * a folder path with template tags or an entry-relative folder of a new entry.
 */
const getUploadDirPath = ({ draft, folder, subfolderPath, locale }) => {
  if (folder.entryRelative) {
    const basePath = getEntryAssetBasePath(draft, folder, locale);

    return basePath === undefined ? undefined : createPath([basePath, subfolderPath]);
  }

  // A folder for uploads always has a path, unlike the All Assets folder
  return folder.hasTemplateTags
    ? undefined
    : createPath([/** @type {string} */ (folder.internalPath), subfolderPath]);
};

/**
 * Find an existing asset that is the same file as the one being uploaded. Several identical copies
 * may be stored in the folder, e.g. in different subfolders, so the copy at the path the file would
 * be saved to is preferred, then one in the same directory, and then one with the same name.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {Asset[]} args.assets Saved and unsaved assets to search.
 * @param {string} args.sha Git object ID of the uploaded file.
 * @param {string} args.name Name of the uploaded file.
 * @param {AssetFolderInfo} args.folder Asset folder associated with the field.
 * @param {string} [args.subfolderPath] Subfolder below the folder the file is saved to.
 * @param {boolean} args.replace Whether the file replaces an existing asset with the same name.
 * @param {InternalLocaleCode} [args.locale] Locale being edited.
 * @param {boolean} [args.slugificationEnabled] Whether the file names are slugified on upload.
 * @returns {Asset | undefined} Existing asset.
 */
const findSameAsset = ({
  draft,
  assets,
  sha,
  name,
  folder,
  subfolderPath = '',
  replace,
  locale,
  slugificationEnabled = false,
}) => {
  // A file replacing an existing one must keep its name, so an identical file under another name
  // doesn’t count. An asset is assigned to one of the folders sharing its path, e.g. the
  // `media_folder` of another collection, so any folder with the same path counts as the same one.
  const matches = assets.filter(
    (a) =>
      a.sha === sha &&
      isAssetInFolder(a, folder) &&
      (!replace || ((!a.unsaved || a.replace) && isSameFileName(a.name, name))),
  );

  if (matches.length < 2) {
    return matches[0];
  }

  const dirPath = getUploadDirPath({ draft, folder, subfolderPath, locale });
  // The name the file would be saved under, which may be slugified
  const savedName = formatFileName(name, { slugificationEnabled });

  /**
   * Rank an asset by how close it is to where the file would be saved.
   * @param {Asset} asset Asset.
   * @returns {number} Rank. The higher, the better.
   */
  const rank = (asset) => {
    // The path of a pending file is only determined when the entry is saved, so its subfolder is
    // compared instead. `getUnsavedAssets()` lists it with the blob URL it’s stored under
    const inDir = asset.unsaved
      ? (draft.files[/** @type {string} */ (asset.blobURL)].subfolderPath ?? '') === subfolderPath
      : dirPath !== undefined && getDirName(asset.path) === dirPath;

    return Number(inDir) * 2 + Number(isSameFileName(asset.name, savedName));
  };

  // A tie goes to the earlier asset, and the saved assets are listed before the pending ones
  return matches.reduce((best, asset) => (rank(asset) > rank(best) ? asset : best));
};

/**
 * Get the result of a resource that leaves nothing to add to the field.
 * @param {object} [fileNames] Name of the file that can’t be used, by the reason. None when there
 * is no repository folder to upload the file to.
 * @param {string} [fileNames.oversizedFileName] Name of a file exceeding the size limit.
 * @param {string} [fileNames.invalidFileName] Name of a file that is corrupt, mislabeled or no
 * longer readable.
 * @param {string} [fileNames.mismatchedFileName] Name of a file that is not one of the accepted
 * file types.
 * @returns {ProcessResourceResult} Result.
 */
const getFailedResult = ({ oversizedFileName, invalidFileName, mismatchedFileName } = {}) => ({
  value: undefined,
  credit: '',
  oversizedFileName,
  invalidFileName,
  ...(mismatchedFileName ? { mismatchedFileName } : {}),
});

/**
 * Process a selected resource.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft containing the resource.
 * @param {SelectedResource} args.resource Resource to be processed.
 * @param {DefaultMediaLibraryConfig} args.libraryConfig Configuration for the media library.
 * @param {string} [args.accept] File types the field accepts, as given by `getAcceptedFileTypes()`.
 * A file to be uploaded is checked against them once it’s transformed, which can change its format,
 * e.g. a PNG image converted to WebP fits a field only taking WebP images. A file picked in the
 * browser’s file picker is checked as well as a dropped one, as a picker can offer every file.
 * @param {InternalLocaleCode} [args.locale] Locale the resource is selected for. An existing asset
 * in an entry-relative folder is referenced with a path relative to that locale’s entry file.
 * Default: the default locale.
 * @returns {Promise<ProcessResourceResult>} Result of processing the resource.
 */
export const processResource = async ({ draft, resource, libraryConfig, accept, locale }) => {
  const { url, folderPath, credit, replace = false, subfolderPath } = resource;
  let { asset, file } = resource;
  /** @type {string | undefined} */
  let value = '';

  if (file) {
    const { folder } = resource;

    // A file is uploaded to a repository folder, which there isn’t when only a cloud media library
    // is configured and neither the field nor the collection has its own `media_folder`
    if (!folder) {
      return getFailedResult();
    }

    /** @type {string | undefined} */
    let existingBlobURL;

    try {
      existingBlobURL = await getExistingBlobURL({ draft, file, folder, subfolderPath, replace });
    } catch {
      // The file can’t be read any more, e.g. it was moved or deleted after being picked. It can’t
      // be uploaded either way, so it’s reported along with the corrupt files rather than failing
      // the whole batch and leaving the field stuck in the processing state.
      return getFailedResult({ invalidFileName: file.name });
    }

    if (existingBlobURL) {
      // The file is already pending, as processed for another field maybe, which can accept other
      // file types
      if (!isAcceptedFile(file, accept)) {
        return getFailedResult({ mismatchedFileName: file.name });
      }

      value = existingBlobURL;
    } else {
      /**
       * Find a saved or pending asset that is the same file as the given one. The assets are read
       * on each call, as a file pending for another field may be added while this one is processed.
       * @param {File} _file File.
       * @returns {Promise<Asset | undefined>} Asset.
       */
      const findExistingAsset = async (_file) =>
        findSameAsset({
          draft,
          assets: [
            ...getSavedAssetsForEntry(draft, folder, locale),
            ...(await getUnsavedAssets({ draft })),
          ],
          sha: await getGitHash(_file),
          name: _file.name,
          folder,
          subfolderPath,
          replace,
          locale,
          slugificationEnabled: libraryConfig?.slugify_filename,
        });

      // Check if the selected file has already been uploaded or is pending upload, otherwise
      // duplicate files lead to an `each_key_duplicate` error in Svelte. A file identical to an
      // existing one, e.g. a copy of an image converted on upload, is taken as is, because a
      // transformation would encode it again into a file that no longer matches. Not if it would be
      // converted to another format, as the site wants the new format, e.g. WebP instead of PNG
      let existingAsset =
        isAcceptedFile(file, accept) &&
        (await keepsFileFormat(file, libraryConfig?.transformations))
          ? await findExistingAsset(file)
          : undefined;

      let oversized = false;

      if (!existingAsset) {
        const result = await processFile(file, libraryConfig ?? {});

        ({ file, oversized } = result);

        if (result.invalid) {
          return getFailedResult({ invalidFileName: file.name });
        }

        // The original file is named, as the user knows it by that name
        if (!isAcceptedFile(file, accept)) {
          return getFailedResult({ mismatchedFileName: /** @type {File} */ (resource.file).name });
        }

        // The same file may be stored once processed, e.g. the same photo converted to WebP
        existingAsset = await findExistingAsset(file);
      }

      if (existingAsset) {
        // If the selected file has already been uploaded, use the existing asset instead of
        // uploading the same file twice
        asset = existingAsset;
        file = undefined;
      } else if (oversized) {
        // Like a corrupt file, an oversized file leaves nothing to add to the field
        return getFailedResult({ oversizedFileName: file.name });
      } else {
        // Set a temporary blob URL, which will be later replaced with the actual file path. The URL
        // is made for display, e.g. an SVG image can’t run script, while the file itself is cached
        value = await createDisplayBlobURL(file);

        // Cache the file itself for later upload. A file replacing an existing one keeps its name
        const template = replace ? undefined : libraryConfig?.filename_template;

        draft.files[value] = {
          file,
          folder,
          replace,
          subfolderPath,
          ...(template
            ? {
                nameTemplate: createAssetNameTemplate(template, {
                  slugificationEnabled: libraryConfig.slugify_filename,
                }),
              }
            : {}),
        };
      }
    }
  }

  if (asset) {
    if (!asset.unsaved) {
      value = getAssetPublicURL(asset, {
        pathOnly: true,
        allowSpecial: true,
        entry: draft.originalEntry,
        locale,
      });
    } else if (asset.blobURL) {
      // A pending file listed by `getUnsavedAssets()` is referenced with its blob URL. It can’t be
      // looked up by content, as it may be pending for a subfolder other than the selected one
      value = asset.blobURL;
    } else if (asset.file) {
      value = await getExistingBlobURL({ draft, file: asset.file, folder: asset.folder });
    }
  }

  if (url && !file && !asset) {
    value = url;
  }

  if (folderPath) {
    value = folderPath;
  }

  return {
    value,
    credit: credit ? sanitize(credit, LINK_SANITIZE_OPTIONS) : '',
    oversizedFileName: undefined,
    invalidFileName: undefined,
  };
};
