import { getAssetsByDirName } from '$lib/services/assets';
import { getAssetKind } from '$lib/services/assets/kinds';
import { fillTemplate } from '$lib/services/common/template';
import { createEntryPath } from '$lib/services/contents/draft/save/entry-path';
import { getFillSlugOptions } from '$lib/services/contents/draft/slugs';
import {
  createPath,
  encodeFilePath,
  formatFileName,
  getGitHash,
  resolvePath,
} from '$lib/services/utils/file';

/**
 * @import {
 * Asset,
 * AssetFolderInfo,
 * EntryDraft,
 * FileChange,
 * FillTemplateOptions,
 * FlattenedEntryContent,
 * InternalEntryCollection,
 * } from '$lib/types/private';
 * @import { FieldKeyPath } from '$lib/types/public';
 */

/**
 * Resolved paths for entry assets.
 * @typedef {object} ResolvedAssetFolderPaths
 * @property {string} resolvedInternalPath Resolved `internalPath` with any template tags replaced.
 * May contain a sub path when assets are entry-relative.
 * @property {string} resolvedPublicPath Resolved `publicPath` with any template tags replaced.
 */

/**
 * Properties for a saving asset.
 * @typedef {object} SavingAsset
 * @property {string} collectionName Collection name.
 * @property {string} [text] Raw text for a plaintext file, like HTML or Markdown.
 * @property {AssetFolderInfo} folder Folder info.
 */

/**
 * Get the internal/public asset path configuration for the entry assets.
 * @param {object} args Arguments.
 * @param {AssetFolderInfo} args.folder Asset folder associated with a new file.
 * @param {FillTemplateOptions} args.fillSlugOptions Arguments for {@link fillTemplate}.
 * @returns {ResolvedAssetFolderPaths} Determined paths.
 */
export const resolveAssetFolderPaths = ({ folder, fillSlugOptions }) => {
  const { entryRelative, internalPath, publicPath } = folder;

  if (internalPath === undefined || publicPath === undefined) {
    // This shouldn’t happen, but avoids type errors in the following code
    return { resolvedInternalPath: '', resolvedPublicPath: '' };
  }

  if (!entryRelative) {
    return {
      resolvedInternalPath: fillTemplate(internalPath, fillSlugOptions),
      resolvedPublicPath: fillTemplate(publicPath, fillSlugOptions),
    };
  }

  const { collection } = fillSlugOptions;

  const isMultiFolders = ['multiple_folders', 'multiple_folders_i18n_root'].includes(
    collection._i18n.structure,
  );

  const subPath =
    collection._type === 'entry'
      ? /** @type {InternalEntryCollection} */ (collection)._file.subPath
      : undefined;

  const subPathFirstPart = subPath?.match(/(?<path>.+?)(?:\/[^/]+)?$/)?.groups?.path ?? '';

  const resolvedInternalPath = resolvePath(
    fillTemplate(
      createPath([
        internalPath,
        isMultiFolders || subPath?.includes('/') ? subPathFirstPart : undefined,
        collection.media_folder, // subfolder, e.g. `images`
      ]),
      fillSlugOptions,
    ),
  );

  const resolvedPublicPath =
    !isMultiFolders && /^\.?$/.test(publicPath)
      ? // Dot-only public path is a special case; the final path stored as the field value will
        // be `./image.png` rather than `image.png`
        publicPath
      : resolvePath(
          fillTemplate(
            isMultiFolders
              ? // When multiple folders are used for i18n, the file structure would look like
                // `{collection}/{locale}/{slug}.md` or `{collection}/{locale}/{slug}/index.md`
                // and the asset path would be `{collection}/{slug}/{file}.jpg`
                createPath([
                  ...Array((subPath?.match(/\//g) ?? []).length + 1).fill('..'),
                  publicPath,
                  subPathFirstPart,
                ])
              : publicPath,
            fillSlugOptions,
          ),
        );

  return { resolvedInternalPath, resolvedPublicPath };
};

/**
 * Get the information required to save an asset.
 * @internal
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {string} args.defaultLocaleSlug Default locale’s entry slug.
 * @param {AssetFolderInfo} args.folder Asset folder associated with a new file.
 * @returns {{ assetFolderPaths: ResolvedAssetFolderPaths, assetNamesInSameFolder: string[],
 * savingAssetProps: SavingAsset }} Arguments.
 */
export const getAssetSavingInfo = ({ draft, defaultLocaleSlug, folder }) => {
  const { collection, collectionName, collectionFile, isIndexFile } = draft;

  const {
    _i18n: { defaultLocale },
  } = collectionFile ?? collection;

  const assetFolderPaths = resolveAssetFolderPaths({
    folder,
    fillSlugOptions: {
      ...getFillSlugOptions({ draft }),
      type: 'media_folder',
      currentSlug: defaultLocaleSlug,
      entryFilePath: createEntryPath({ draft, locale: defaultLocale, slug: defaultLocaleSlug }),
      isIndexFile,
    },
  });

  const { resolvedInternalPath } = assetFolderPaths;

  return {
    assetFolderPaths,
    assetNamesInSameFolder: getAssetsByDirName(resolvedInternalPath).map((a) => a.name.normalize()),
    savingAssetProps: { collectionName, folder },
  };
};

/**
 * Replace a blob URL with the final path, and add the file to the changeset.
 * @param {object} args Arguments.
 * @param {File} args.file Raw file.
 * @param {AssetFolderInfo} args.folder Asset folder associated with the new file.
 * @param {string} args.blobURL Blob URL of the file.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {string} args.defaultLocaleSlug Default locale’s entry slug.
 * @param {FieldKeyPath} args.keyPath Field key path.
 * @param {FlattenedEntryContent} args.content Localized content.
 * @param {FileChange[]} args.changes Changeset.
 * @param {Asset[]} args.savingAssets List of assets to be saved.
 * @param {boolean} args.slugificationEnabled Whether the file name slugification is enabled.
 * @param {boolean} args.encodingEnabled Whether the file path encoding is enabled.
 */
export const replaceBlobURL = async ({
  file,
  folder,
  blobURL,
  draft,
  defaultLocaleSlug,
  keyPath,
  content,
  changes,
  savingAssets,
  slugificationEnabled,
  encodingEnabled,
}) => {
  const sha = await getGitHash(file);
  const dupFile = savingAssets.find((f) => f.sha === sha);

  const {
    savingAssetProps,
    assetNamesInSameFolder,
    assetFolderPaths: { resolvedInternalPath, resolvedPublicPath },
  } = getAssetSavingInfo({ draft, defaultLocaleSlug, folder });

  let fileName = '';

  // Check if the file has already been added for other field or locale
  if (dupFile) {
    fileName = dupFile.name;
  } else {
    fileName = formatFileName(file.name, { slugificationEnabled, assetNamesInSameFolder });

    const assetPath = resolvedInternalPath ? `${resolvedInternalPath}/${fileName}` : fileName;

    assetNamesInSameFolder.push(fileName);
    changes.push({ action: 'create', path: assetPath, data: file });

    savingAssets.push({
      ...savingAssetProps,
      blobURL,
      name: fileName,
      path: assetPath,
      sha,
      size: file.size,
      kind: getAssetKind(fileName),
    });
  }

  let publicURL = resolvedPublicPath
    ? `${resolvedPublicPath === '/' ? '' : resolvedPublicPath}/${fileName}`
    : fileName;

  if (encodingEnabled) {
    publicURL = encodeFilePath(publicURL);
  }

  content[keyPath] = /** @type {string} */ (content[keyPath]).replaceAll(blobURL, publicURL);
};
