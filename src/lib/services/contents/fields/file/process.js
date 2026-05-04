import { getHash } from '@sveltia/utils/crypto';
import equal from 'fast-deep-equal';
import { sanitize } from 'isomorphic-dompurify';
import { get } from 'svelte/store';

import { allAssets } from '$lib/services/assets';
import { getAssetPublicURL } from '$lib/services/assets/info';
import { getAssetKind } from '$lib/services/assets/kinds';
import { processFile } from '$lib/services/assets/process';
import { getGitHash } from '$lib/services/utils/file';

/**
 * @import { Asset, AssetFolderInfo, EntryDraft, SelectedResource } from '$lib/types/private';
 * @import { DefaultMediaLibraryConfig } from '$lib/types/public';
 */

/**
 * Get the blob URL of an unsaved file that matches the given file.
 * @internal
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft containing the resource.
 * @param {File} args.file File to be searched.
 * @param {AssetFolderInfo} [args.folder] Asset folder for the field. When the folder is
 * entry-relative, only files in the same folder are considered a match.
 * @returns {Promise<string | undefined>} Blob URL.
 */
export const getExistingBlobURL = async ({ draft, file, folder }) => {
  const hash = await getHash(file);
  /** @type {string | undefined} */
  let foundURL = undefined;

  await Promise.all(
    Object.entries(draft.files ?? {}).map(async ([blobURL, f]) => {
      if (
        !foundURL &&
        (await getHash(f.file)) === hash &&
        (!folder?.entryRelative || equal(f.folder, folder))
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
 * @param {string} [args.blobURL] Blob URL of the file.
 * @param {AssetFolderInfo | undefined} args.folder Asset folder.
 * @param {string} [args.targetFolderPath] Target folder path.
 * @returns {Promise<Asset>} Asset.
 */
export const convertFileItemToAsset = async ({ file, blobURL, folder, targetFolderPath }) => {
  const { name, size } = file;

  return /** @type {Asset} */ ({
    unsaved: true,
    file,
    blobURL: blobURL ?? URL.createObjectURL(file),
    name,
    path: targetFolderPath ? `${targetFolderPath}/${name}` : name,
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
export const getUnsavedAssets = async ({ draft, targetFolderPath }) =>
  Promise.all(
    Object.entries(draft.files).map(async ([blobURL, { file, folder }]) =>
      convertFileItemToAsset({ file, blobURL, folder, targetFolderPath }),
    ),
  );

/**
 * Get the saved assets relevant to the current entry draft and folder. For entry-relative folders,
 * the result is filtered to only include assets within the current entry’s own folder, preventing
 * false duplicate detection across entries that share the same folder config template.
 * @param {EntryDraft} draft Entry draft.
 * @param {AssetFolderInfo | undefined} folder Asset folder associated with the field.
 * @returns {Asset[]} Filtered saved assets.
 */
const getSavedAssetsForEntry = (draft, folder) => {
  const savedAssets = get(allAssets);

  if (!folder?.entryRelative) {
    return savedAssets;
  }

  const { originalEntry, defaultLocale, collection } = draft;
  const entryFilePath = originalEntry?.locales[defaultLocale]?.path;

  if (!entryFilePath) {
    // New entry — no saved assets exist for this entry yet
    return [];
  }

  const subPath = collection._type === 'entry' ? collection._file.subPath : undefined;
  const lastSubPathSegment = subPath?.includes('/') ? subPath.split('/').at(-1) : undefined;
  // Strip the file extension and any fixed nested filename suffix (e.g., `{{slug}}/index` → remove
  // the trailing `index` segment) to get the entry folder path.
  let entryFolderPath = entryFilePath.substring(0, entryFilePath.lastIndexOf('.'));

  if (lastSubPathSegment && !lastSubPathSegment.includes('{{')) {
    entryFolderPath =
      entryFolderPath.match(/(?<path>.+?)(?:\/[^/]+)?$/)?.groups?.path ?? entryFolderPath;
  }

  const expectedPrefix = [entryFolderPath, folder.internalSubPath].filter(Boolean).join('/');

  return savedAssets.filter((a) => a.path.startsWith(`${expectedPrefix}/`));
};

/**
 * Process a selected resource.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft containing the resource.
 * @param {SelectedResource} args.resource Resource to be processed.
 * @param {DefaultMediaLibraryConfig} args.libraryConfig Configuration for the media library.
 * @returns {Promise<{ value: string | undefined, credit: string, oversizedFileName: string |
 * undefined }>} Processed resource value, credit, and file name if the file is oversized.
 */
export const processResource = async ({ draft, resource, libraryConfig }) => {
  const { url, credit } = resource;
  let { asset, file } = resource;
  /** @type {string | undefined} */
  let value = '';
  /** @type {string | undefined} */
  let oversizedFileName = undefined;

  if (file) {
    const { folder } = resource;
    const existingBlobURL = await getExistingBlobURL({ draft, file, folder });

    if (existingBlobURL) {
      value = existingBlobURL;
    } else {
      const { file: processedFile, oversized } = await processFile(file, libraryConfig ?? {});

      file = processedFile;

      const sha = await getGitHash(file);

      // Check if the selected file has already been uploaded or is pending upload, otherwise
      // duplicate files lead to an `each_key_duplicate` error in Svelte
      const existingAsset = [
        ...getSavedAssetsForEntry(draft, folder),
        ...(await getUnsavedAssets({ draft })),
      ].find((a) => a.sha === sha && equal(a.folder, folder));

      if (existingAsset) {
        // If the selected file has already been uploaded, use the existing asset instead of
        // uploading the same file twice
        asset = existingAsset;
        file = undefined;
      } else if (oversized) {
        oversizedFileName = file.name;
        file = undefined;
      } else {
        // Set a temporary blob URL, which will be later replaced with the actual file path
        value = URL.createObjectURL(file);
        // Cache the file itself for later upload
        draft.files[value] = { file, folder };
      }
    }
  }

  if (asset) {
    if (!asset.unsaved) {
      value = getAssetPublicURL(asset, {
        pathOnly: true,
        allowSpecial: true,
        entry: draft.originalEntry,
      });
    } else if (asset.file) {
      value = await getExistingBlobURL({ draft, file: asset.file, folder: asset.folder });
    }
  }

  if (url && !file && !asset) {
    value = url;
  }

  return {
    value,
    credit: credit ? sanitize(credit, { ALLOWED_TAGS: ['a'], ALLOWED_ATTR: ['href'] }) : '',
    oversizedFileName,
  };
};
