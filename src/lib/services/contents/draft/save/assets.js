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
 * @import { FieldKeyPath, I18nFileStructure } from '$lib/types/public';
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
 * List of collection structures that use multiple folders for assets.
 * @type {I18nFileStructure[]}
 * @todo Remove the legacy `multiple_folders_i18n_root` structure prior to the 1.0 release.
 */
const MULTI_FOLDER_STRUCTURES = [
  'multiple_folders',
  'multiple_folders_i18n_root', // deprecated
  'multiple_root_folders', // new name
];

/**
 * Regex to extract the folder path from an entry file path. For example, it extracts `blog/post`
 * from `blog/post.md` or `blog/post/index.md`.
 * @type {RegExp}
 */
const FOLDER_PATH_REGEX = /(?<path>.+?)(?:\/[^/]+)?$/;

/**
 * Fill a template string if it contains template tags, otherwise return as-is.
 * @param {string} pathString Path string that may contain template tags.
 * @param {FillTemplateOptions} fillSlugOptions Arguments for {@link fillTemplate}.
 * @returns {string} Resolved path.
 */
const fillTemplateIfNeeded = (pathString, fillSlugOptions) =>
  pathString.includes('{{') ? fillTemplate(pathString, fillSlugOptions) : pathString;

/**
 * Extract the entry folder path from an entry file path. Removes file extension and `/index` suffix
 * for nested entries.
 * @param {string} entryFilePath Entry file path, e.g., `src/content/blog/hello-world.md`.
 * @returns {string} Entry folder path, e.g., `src/content/blog/hello-world`.
 * @example
 * // Simple files
 * getEntryFolderPath('src/content/blog/hello-world.md')
 * // => 'src/content/blog/hello-world'
 * @example
 * // Nested files
 * getEntryFolderPath('src/content/blog/hello-world/index.md')
 * // => 'src/content/blog/hello-world'
 */
const getEntryFolderPath = (entryFilePath) => {
  // Remove file extension (always present)
  const extensionIndex = entryFilePath.lastIndexOf('.');
  let folderPath = entryFilePath.substring(0, extensionIndex);

  // Remove `/index` suffix for nested entries
  if (folderPath.endsWith('/index')) {
    folderPath = folderPath.substring(0, folderPath.length - 6);
  }

  return folderPath;
};

/**
 * Resolve the internal asset path for entry-relative assets.
 * @param {object} args Arguments.
 * @param {string} args.internalPath Internal path from folder config.
 * @param {string | undefined} args.internalSubPath Internal sub-path from folder config.
 * @param {string} args.entryFolderPath Resolved entry folder path.
 * @param {boolean} args.isMultiFolders Whether collection uses multi-folder i18n structure.
 * @param {boolean} args.isNestedEntry Whether entry uses nested file structure.
 * @param {FillTemplateOptions} args.fillSlugOptions Arguments for template filling.
 * @returns {string} Resolved internal path.
 */
const resolveInternalPath = ({
  internalPath,
  internalSubPath,
  entryFolderPath,
  isMultiFolders,
  isNestedEntry,
  fillSlugOptions,
}) => {
  // We already know the entry file path, so we can resolve the internal path to the asset folder
  // even when it’s entry-relative. We should use entryFolderPath (extracted from entryFilePath)
  // rather than reconstructing the path from templates, because when date-related template tags are
  // used in subPath (e.g., `{{year}}-{{month}}-{{day}}-{{slug}}/index`), the resolved path would be
  // different from the original entry path if we filled the template again. This would cause assets
  // saved at a later date to be stored in a different folder than the entry itself. Instead, we use
  // the already-resolved entryFolderPath which preserves the original date context. For nested
  // entries or multi-folder structures, use entryFolderPath. For simple entries with single-file
  // i18n or file collections, use internalPath (shared asset folder).
  const shouldUseEntryFolderPath = isMultiFolders || isNestedEntry;

  const internalPathString = createPath([
    shouldUseEntryFolderPath ? entryFolderPath : internalPath,
    internalSubPath, // subfolder, e.g. `images` or an empty string
  ]);

  return resolvePath(fillTemplateIfNeeded(internalPathString, fillSlugOptions));
};

/**
 * Resolve the public asset path for entry-relative assets.
 * @param {object} args Arguments.
 * @param {string} args.publicPath Public path from folder config.
 * @param {string} args.subPathFolderPath Extracted folder path from collection’s subPath.
 * @param {string | undefined} args.subPath Collection’s file subPath template.
 * @param {boolean} args.isMultiFolders Whether collection uses multi-folder i18n structure.
 * @param {FillTemplateOptions} args.fillSlugOptions Arguments for template filling.
 * @returns {string} Resolved public path.
 */
const resolvePublicPath = ({
  publicPath,
  subPathFolderPath,
  subPath,
  isMultiFolders,
  fillSlugOptions,
}) => {
  // Dot-only public path is a special case; the final path stored as the field value will be
  // `./image.png` rather than `image.png`
  if (!isMultiFolders && /^\.?$/.test(publicPath)) {
    return publicPath;
  }

  const publicPathString = isMultiFolders
    ? // When multiple folders are used for i18n, the file structure would look like
      // `{collection}/{locale}/{slug}.md` or `{collection}/{locale}/{slug}/index.md` and the asset
      // path would be `{collection}/{slug}/{file}.jpg`
      createPath([
        ...Array((subPath?.match(/\//g) ?? []).length + 1).fill('..'),
        publicPath,
        subPathFolderPath,
      ])
    : publicPath;

  return resolvePath(fillTemplateIfNeeded(publicPathString, fillSlugOptions));
};

/**
 * Get the internal/public asset path configuration for the entry assets.
 * @param {object} args Arguments.
 * @param {AssetFolderInfo} args.folder Asset folder associated with a new file.
 * @param {FillTemplateOptions} args.fillSlugOptions Arguments for {@link fillTemplate}.
 * @returns {ResolvedAssetFolderPaths} Determined paths.
 */
export const resolveAssetFolderPaths = ({ folder, fillSlugOptions }) => {
  const { entryRelative, internalPath, internalSubPath, publicPath } = folder;

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

  const { collection, entryFilePath } = fillSlugOptions;
  const isMultiFolders = MULTI_FOLDER_STRUCTURES.includes(collection._i18n.structure);

  const subPath =
    collection._type === 'entry'
      ? /** @type {InternalEntryCollection} */ (collection)._file.subPath
      : undefined;

  const subPathFolderPath = subPath?.match(FOLDER_PATH_REGEX)?.groups?.path ?? '';
  const entryFolderPath = getEntryFolderPath(entryFilePath ?? '');
  const isNestedEntry = subPath?.includes('/') ?? false;

  const resolvedInternalPath = resolveInternalPath({
    internalPath,
    internalSubPath,
    entryFolderPath,
    isMultiFolders,
    isNestedEntry,
    fillSlugOptions,
  });

  const resolvedPublicPath = resolvePublicPath({
    publicPath,
    subPathFolderPath,
    subPath,
    isMultiFolders,
    fillSlugOptions,
  });

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
