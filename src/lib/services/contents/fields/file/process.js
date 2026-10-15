import equal from 'fast-deep-equal';
import { sanitize } from 'isomorphic-dompurify';

import { isSameFileName } from '$lib/services/assets/file-name';
import { createDisplayBlobURL, getAssetPublicURL } from '$lib/services/assets/info';
import { getAssetKind } from '$lib/services/assets/kinds';
import { createAssetNameTemplate, getPendingFileName } from '$lib/services/assets/name';
import { processFile } from '$lib/services/assets/process';
import { allAssets } from '$lib/services/assets/state';
import { getEntryAssetFolderPath } from '$lib/services/contents/draft/save/assets';
import { getSlugs } from '$lib/services/contents/draft/slugs';
import { isAcceptedFile } from '$lib/services/integrations/media-libraries/default';
import { createPath, getGitHash } from '$lib/services/utils/file';
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
 * Get the saved assets relevant to the current entry draft and folder. For entry-relative folders,
 * the result is filtered to only include assets within the folder the entry’s relative assets are
 * saved to, preventing false duplicate detection across entries that share the same folder config
 * template. That’s the entry’s own folder if it has one, and otherwise the folder it shares with
 * the rest of the collection, as determined by {@link getEntryAssetFolderPath}.
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

  const { originalEntry, defaultLocale, collection } = draft;

  const entryFilePath = (
    (locale ? originalEntry?.locales[locale] : undefined) ?? originalEntry?.locales[defaultLocale]
  )?.path;

  if (!entryFilePath) {
    // New entry — no saved assets exist for this entry yet
    return [];
  }

  const assetFolderPath = getEntryAssetFolderPath({
    collection,
    entryFilePath,
    // An entry-relative folder is always configured with a path
    internalPath: /** @type {string} */ (folder.internalPath),
  });

  const expectedPrefix = createPath([assetFolderPath, folder.internalSubPath]);

  return savedAssets.filter((a) => a.path.startsWith(`${expectedPrefix}/`));
};

/**
 * Get the result of processing a file that is not one of the accepted file types.
 * @param {File} file File.
 * @returns {ProcessResourceResult} Result.
 */
const getMismatchedResult = (file) => ({
  value: undefined,
  credit: '',
  oversizedFileName: undefined,
  invalidFileName: undefined,
  mismatchedFileName: file.name,
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
      return {
        value: undefined,
        credit: '',
        oversizedFileName: undefined,
        invalidFileName: undefined,
      };
    }

    /** @type {string | undefined} */
    let existingBlobURL;

    try {
      existingBlobURL = await getExistingBlobURL({ draft, file, folder, subfolderPath, replace });
    } catch {
      // The file can’t be read any more, e.g. it was moved or deleted after being picked. It can’t
      // be uploaded either way, so it’s reported along with the corrupt files rather than failing
      // the whole batch and leaving the field stuck in the processing state.
      return {
        value: undefined,
        credit: '',
        oversizedFileName: undefined,
        invalidFileName: file.name,
      };
    }

    if (existingBlobURL) {
      // The file is already pending, as processed for another field maybe, which can accept other
      // file types
      if (!isAcceptedFile(file, accept)) {
        return getMismatchedResult(file);
      }

      value = existingBlobURL;
    } else {
      const {
        file: processedFile,
        oversized,
        invalid,
      } = await processFile(file, libraryConfig ?? {});

      file = processedFile;

      if (invalid) {
        return {
          value: undefined,
          credit: '',
          oversizedFileName: undefined,
          invalidFileName: file.name,
        };
      }

      // The original file is named, as the user knows it by that name
      if (!isAcceptedFile(file, accept)) {
        return getMismatchedResult(/** @type {File} */ (resource.file));
      }

      const sha = await getGitHash(file);
      const { name } = file;

      // Check if the selected file has already been uploaded or is pending upload, otherwise
      // duplicate files lead to an `each_key_duplicate` error in Svelte. A file replacing an
      // existing one must keep its name, so an identical file under another name doesn’t count
      const existingAsset = [
        ...getSavedAssetsForEntry(draft, folder, locale),
        ...(await getUnsavedAssets({ draft })),
      ].find(
        (a) =>
          a.sha === sha &&
          equal(a.folder, folder) &&
          (!replace || ((!a.unsaved || a.replace) && isSameFileName(a.name, name))),
      );

      if (existingAsset) {
        // If the selected file has already been uploaded, use the existing asset instead of
        // uploading the same file twice
        asset = existingAsset;
        file = undefined;
      } else if (oversized) {
        // Like a corrupt file, an oversized file leaves nothing to add to the field
        return {
          value: undefined,
          credit: '',
          oversizedFileName: file.name,
          invalidFileName: undefined,
        };
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
