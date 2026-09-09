import { getPathInfo } from '@sveltia/utils/file';
import equal from 'fast-deep-equal';

import { getAssetsByDirName } from '$lib/services/assets';
import { getAssetKind } from '$lib/services/assets/kinds';
import { fillTemplate } from '$lib/services/common/template';
import { getSharedEntryFileName } from '$lib/services/contents/collection/nested';
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
 * InternalCollection,
 * InternalEntryCollection,
 * InternalLocaleCode,
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
 * Check whether an entry file is the index file that every entry in a nested collection is stored
 * as, which makes the folder holding it the entry’s own.
 * @param {string} filePath Entry file path without its extension.
 * @param {string | undefined} indexFileName Shared index file name, if the collection has one.
 * @returns {boolean} Result.
 */
const isSharedIndexFile = (filePath, indexFileName) => {
  if (!indexFileName) {
    return false;
  }

  const fileName = filePath.slice(filePath.lastIndexOf('/') + 1);

  // The `multiple_files` i18n structure appends the locale to the file name, e.g. `_index.en`
  return fileName === indexFileName || fileName.startsWith(`${indexFileName}.`);
};

/**
 * Get the path of the folder an entry occupies, which holds the entry’s relative assets along with
 * anything else stored below it. Only some file structures give an entry a folder of its own; in
 * the others, an entry is a file sharing a folder with the rest of the collection, so its relative
 * assets are shared as well.
 * @internal
 * @param {InternalCollection} collection Collection the entry belongs to.
 * @param {string} entryFilePath Entry file path, e.g. `content/blog/hello-world/index.md`.
 * @returns {string | undefined} Folder path, e.g. `content/blog/hello-world`. `undefined` if the
 * entry has no folder of its own.
 * @example
 * // A `path` option ending in a fixed file name gives the entry a folder
 * getOwnedEntryFolderPath(collection, 'content/blog/hello-world/index.md') // `{{slug}}/index`
 * // => 'content/blog/hello-world'
 * @example
 * // Every entry in a nested collection is an index file, with or without a `path` option
 * getOwnedEntryFolderPath(collection, 'content/pages/about/_index.md') // `index_file: _index`
 * // => 'content/pages/about'
 * @example
 * // The slug is the last segment here, so the entry file sits next to the folder named after it
 * // with a `{{year}}/{{month}}/{{slug}}` path option
 * getOwnedEntryFolderPath(collection, 'content/blog/2025/06/hello-world.md')
 * // => 'content/blog/2025/06/hello-world'
 * @example
 * // A plain file collection shares one folder, so there’s nothing the entry owns
 * getOwnedEntryFolderPath(collection, 'content/blog/hello-world.md') // no `path` option
 * // => undefined
 */
export const getOwnedEntryFolderPath = (collection, entryFilePath) => {
  if (collection._type !== 'entry') {
    return undefined;
  }

  const { subPath } = /** @type {InternalEntryCollection} */ (collection)._file;
  // Remove the file extension, which is always present
  const filePath = entryFilePath.substring(0, entryFilePath.lastIndexOf('.'));
  const lastSubPathSegment = subPath?.includes('/') ? subPath.split('/').at(-1) : undefined;

  // The entry file has a fixed name within the folder holding it, either because the `path` option
  // ends in one, or because the collection stores every entry as an index file. Either way the
  // folder is the entry, so strip the file name off
  if (
    (!!lastSubPathSegment && !lastSubPathSegment.includes('{{')) ||
    isSharedIndexFile(filePath, getSharedEntryFileName(collection))
  ) {
    return /** @type {string} */ (filePath.match(FOLDER_PATH_REGEX)?.groups?.path);
  }

  // The `path` option puts the entry in a folder of its own, such as `{{year}}/{{month}}/{{slug}}`,
  // and the entry file is named after the slug, so a folder of the same name sits next to it. A
  // locale folder doesn’t count: it holds every entry of that locale, not this one
  if (subPath?.includes('/')) {
    return filePath;
  }

  return undefined;
};

/**
 * Get the folder that holds an entry’s relative assets: the folder the entry occupies if it has one
 * of its own, and otherwise the folder its file is stored in, which it shares with the rest of the
 * collection. With a `multiple_folders` i18n structure that shared folder is the locale’s own, so
 * the assets sit beside the entry either way.
 * @param {object} args Arguments.
 * @param {InternalCollection} args.collection Collection the entry belongs to.
 * @param {string} args.entryFilePath Entry file path.
 * @param {string} args.internalPath Internal path from folder config.
 * @returns {string} Folder path.
 */
const getEntryAssetFolderPath = ({ collection, entryFilePath, internalPath }) =>
  getOwnedEntryFolderPath(collection, entryFilePath) ??
  // A file collection has no folder of its own to fall back on
  (collection._type === 'entry'
    ? (getPathInfo(entryFilePath).dirname ?? internalPath)
    : internalPath);

/**
 * Resolve the internal asset path for entry-relative assets.
 * @param {object} args Arguments.
 * @param {string | undefined} args.internalSubPath Internal sub-path from folder config.
 * @param {string} args.assetFolderPath Folder holding the entry’s relative assets.
 * @param {FillTemplateOptions} args.fillSlugOptions Arguments for template filling.
 * @returns {string} Resolved internal path.
 */
const resolveInternalPath = ({ internalSubPath, assetFolderPath, fillSlugOptions }) => {
  // We already know the entry file path, so we can resolve the internal path to the asset folder
  // even when it’s entry-relative. We should use the folder path extracted from entryFilePath
  // rather than reconstructing the path from templates, because when date-related template tags are
  // used in subPath (e.g., `{{year}}-{{month}}-{{day}}-{{slug}}/index`), the resolved path would be
  // different from the original entry path if we filled the template again. This would cause assets
  // saved at a later date to be stored in a different folder than the entry itself.
  const internalPathString = createPath([
    assetFolderPath,
    internalSubPath, // subfolder, e.g. `images` or an empty string
  ]);

  return resolvePath(fillTemplateIfNeeded(internalPathString, fillSlugOptions));
};

/**
 * Resolve the public asset path for entry-relative assets, which is the path the field value is
 * built from. The assets sit in the folder holding the entry, so the value is relative to the entry
 * itself and needs nothing but the configured `public_folder`.
 * @param {object} args Arguments.
 * @param {string} args.publicPath Public path from folder config.
 * @param {FillTemplateOptions} args.fillSlugOptions Arguments for template filling.
 * @returns {string} Resolved public path.
 */
const resolvePublicPath = ({ publicPath, fillSlugOptions }) => {
  // Dot-only public path is a special case; the final path stored as the field value will be
  // `./image.png` rather than `image.png`
  if (/^\.?$/.test(publicPath)) {
    return publicPath;
  }

  return resolvePath(fillTemplateIfNeeded(publicPath, fillSlugOptions));
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

  const resolvedInternalPath = resolveInternalPath({
    internalSubPath,
    assetFolderPath: getEntryAssetFolderPath({
      collection,
      entryFilePath: entryFilePath ?? '',
      internalPath,
    }),
    fillSlugOptions,
  });

  const resolvedPublicPath = resolvePublicPath({ publicPath, fillSlugOptions });

  return { resolvedInternalPath, resolvedPublicPath };
};

/**
 * Resolve the internal and public asset folder paths for a file being added to the given draft.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {InternalLocaleCode} [args.locale] Locale the file is being added to. Defaults to the
 * default locale, which is enough to resolve the public path, the same for every locale.
 * @param {string} [args.slug] Entry slug for that locale. Defaults to the default locale’s slug.
 * @param {string} args.defaultLocaleSlug Default locale’s entry slug.
 * @param {AssetFolderInfo} args.folder Asset folder associated with a new file.
 * @returns {ResolvedAssetFolderPaths} Determined paths.
 */
export const getAssetFolderPaths = ({ draft, locale, slug, defaultLocaleSlug, folder }) => {
  const { collection, collectionFile, isIndexFile } = draft;

  const {
    _i18n: { defaultLocale },
  } = collectionFile ?? collection;

  return resolveAssetFolderPaths({
    folder,
    fillSlugOptions: {
      ...getFillSlugOptions({ draft }),
      type: 'media_folder',
      currentSlug: defaultLocaleSlug,
      // Resolve against the locale being edited: with a `multiple_folders` or
      // `multiple_root_folders` i18n structure each locale has a folder of its own, and an asset
      // referenced from one locale’s entry has to sit beside that entry
      entryFilePath: createEntryPath({
        draft,
        locale: locale ?? defaultLocale,
        slug: slug ?? defaultLocaleSlug,
      }),
      isIndexFile,
    },
  });
};

/**
 * Join the resolved public path and file name to create the public URL to be stored as the field
 * value.
 * @param {string} publicPath Resolved public path.
 * @param {string} fileName File name.
 * @returns {string} Public URL.
 */
export const createPublicURL = (publicPath, fileName) =>
  publicPath ? `${publicPath === '/' ? '' : publicPath}/${fileName}` : fileName;

/**
 * Get the information required to save an asset.
 * @internal
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {InternalLocaleCode} [args.locale] Locale the file is being added to. See
 * {@link getAssetFolderPaths}.
 * @param {string} [args.slug] Entry slug for that locale.
 * @param {string} args.defaultLocaleSlug Default locale’s entry slug.
 * @param {AssetFolderInfo} args.folder Asset folder associated with a new file.
 * @returns {{ assetFolderPaths: ResolvedAssetFolderPaths, assetNamesInSameFolder: string[],
 * savingAssetProps: SavingAsset }} Arguments.
 */
export const getAssetSavingInfo = ({ draft, locale, slug, defaultLocaleSlug, folder }) => {
  const { collectionName } = draft;
  const assetFolderPaths = getAssetFolderPaths({ draft, locale, slug, defaultLocaleSlug, folder });
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
 * @param {boolean} args.replace Whether to replace an existing file.
 * @param {string} args.blobURL Blob URL of the file.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {InternalLocaleCode} [args.locale] Locale the file is being added to. See
 * {@link getAssetFolderPaths}.
 * @param {string} [args.slug] Entry slug for that locale.
 * @param {string} args.defaultLocaleSlug Default locale’s entry slug.
 * @param {FieldKeyPath} args.keyPath Field key path.
 * @param {FlattenedEntryContent} args.content Localized content.
 * @param {FileChange[]} args.changes Changeset.
 * @param {Asset[]} args.savingAssets List of assets to be saved.
 * @param {boolean} args.encodingEnabled Whether the file path encoding is enabled.
 */
export const replaceBlobURL = async ({
  file,
  folder,
  replace,
  blobURL,
  draft,
  locale,
  slug,
  defaultLocaleSlug,
  keyPath,
  content,
  changes,
  savingAssets,
  encodingEnabled,
}) => {
  const sha = await getGitHash(file);

  const dupFile = savingAssets.find(
    (f) => f.sha === sha && (!folder.entryRelative || equal(f.folder, folder)),
  );

  const {
    savingAssetProps,
    assetNamesInSameFolder,
    assetFolderPaths: { resolvedInternalPath, resolvedPublicPath },
  } = getAssetSavingInfo({ draft, locale, slug, defaultLocaleSlug, folder });

  let fileName = '';

  // Check if the file has already been added for other field or locale
  if (dupFile) {
    fileName = dupFile.name;
  } else {
    fileName = formatFileName(file.name, replace ? {} : { assetNamesInSameFolder });

    const update = replace && assetNamesInSameFolder.includes(fileName);
    const assetPath = resolvedInternalPath ? `${resolvedInternalPath}/${fileName}` : fileName;

    if (!update) {
      assetNamesInSameFolder.push(fileName);
    }

    changes.push({
      action: update ? 'update' : 'create',
      path: assetPath,
      data: file,
    });

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

  let publicURL = createPublicURL(resolvedPublicPath, fileName);

  if (encodingEnabled) {
    publicURL = encodeFilePath(publicURL);
  }

  content[keyPath] = /** @type {string} */ (content[keyPath]).replaceAll(blobURL, publicURL);
};
