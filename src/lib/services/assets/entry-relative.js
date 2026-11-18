import {
  getEntryAssetFolderPath,
  getExistingEntryAssetFolderPath,
} from '$lib/services/assets/entry-folder';
import { getAssetPathMap } from '$lib/services/assets/lookup';
import { fillTemplate } from '$lib/services/common/template';
import { hasTemplateTags } from '$lib/services/common/template/tags';
import { getCollection } from '$lib/services/contents/collection';
import { isCollectionIndexFile } from '$lib/services/contents/collection/entries/index-file';
import { getAssociatedCollections } from '$lib/services/contents/entry/collections';
import { getEntryLocaleFile } from '$lib/services/contents/entry/paths';
import { createPath, getDirName, resolvePath } from '$lib/services/utils/file';

/**
 * @import {
 * Asset,
 * AssetFolderInfo,
 * Entry,
 * InternalCollection,
 * InternalLocaleCode,
 * LocalizedEntry,
 * } from '$lib/types/private';
 */

/**
 * Resolve template tags in an entry’s `media_folder` path, such as `/assets/images/{{slug}}`, using
 * the given locale file of the entry.
 * @param {string} template Folder path that may contain template tags.
 * @param {object} args Arguments.
 * @param {InternalCollection} args.collection Collection the entry belongs to.
 * @param {Entry} args.entry Entry.
 * @param {LocalizedEntry} args.localeFile Entry’s locale file the path is resolved against.
 * @returns {string} Resolved path.
 */
export const fillMediaFolderTemplate = (template, { collection, entry, localeFile }) =>
  fillTemplate(template, {
    type: 'media_folder',
    collection,
    content: localeFile.content,
    currentSlug: entry.slug,
    entryFilePath: localeFile.path,
    isIndexFile: isCollectionIndexFile(collection, entry),
  });

/**
 * Get the collection and the locale file of an entry an asset folder’s path is resolved against.
 * @param {object} args Arguments.
 * @param {string} [args.collectionName] Collection name associated with the asset folder. It’s
 * `undefined` for the global asset folder as well as field-level asset folders in custom editor
 * components, which take the entry’s first collection.
 * @param {Entry} [args.entry] Associated entry. Can be `undefined` when editing a new draft.
 * @param {InternalLocaleCode} [args.locale] Locale whose entry file is used. Default: the
 * collection’s default locale.
 * @returns {{ collection: InternalCollection, entry: Entry, localeFile: LocalizedEntry } |
 * undefined} Context, or `undefined` without an entry or a collection.
 */
const getEntryLocaleContext = ({ collectionName, entry, locale }) => {
  const collection = collectionName
    ? getCollection(collectionName)
    : entry
      ? getAssociatedCollections(entry)[0]
      : undefined;

  if (!entry || !collection) {
    return undefined;
  }

  // An entry-relative asset referenced in a locale is stored beside that locale’s file. With the
  // `multiple_folders` or `multiple_root_folders` i18n structure, each locale’s file is in a folder
  // of its own
  const localeFile = /** @type {LocalizedEntry} */ (
    getEntryLocaleFile(entry, { locale, defaultLocale: collection._i18n.defaultLocale })
  );

  return { collection, entry, localeFile };
};

/**
 * Resolve template tags in an asset folder’s `internalPath`, such as `/assets/images/{{slug}}`,
 * using the given entry’s content.
 * @param {object} args Arguments.
 * @param {string} args.internalPath Internal path that may contain template tags.
 * @param {string} [args.collectionName] Collection name associated with the asset folder. It’s
 * `undefined` for the global asset folder as well as field-level asset folders in custom editor
 * components.
 * @param {Entry} [args.entry] Associated entry. Can be `undefined` when editing a new draft.
 * @param {InternalLocaleCode} [args.locale] Locale whose entry file the path is resolved against.
 * Default: the collection’s default locale.
 * @returns {string | undefined} Resolved path, which is the given `internalPath` itself if it has
 * no template tags, or `undefined` if the tags cannot be resolved, typically because the entry has
 * not been saved yet.
 */
export const fillInternalPathTemplate = ({ internalPath, collectionName, entry, locale }) => {
  if (!hasTemplateTags(internalPath)) {
    return internalPath;
  }

  const context = getEntryLocaleContext({ collectionName, entry, locale });

  // Cannot resolve the path without an entry
  return context ? fillMediaFolderTemplate(internalPath, context) : undefined;
};

/**
 * Find an asset in the folders an entry’s relative assets can be stored in: the one they are saved
 * to, which is the folder the entry occupies if it has one of its own, e.g.
 * `content/posts/2025/06/hello` for `content/posts/2025/06/hello.md` with a
 * `{{year}}/{{month}}/{{slug}}` path option, and otherwise the folder of the entry file, which is
 * an empty string for an entry file at the repository root; then the folder of the entry file.
 * @param {object} context Entry context, as given by {@link getEntryLocaleContext}.
 * @param {InternalCollection} context.collection Collection the entry belongs to.
 * @param {LocalizedEntry} context.localeFile Entry’s locale file.
 * @param {(string | undefined)[]} segments Path segments below the folder, e.g. the subfolder and
 * the file name.
 * @returns {Asset | undefined} Asset, if found.
 */
export const findInEntryBaseFolders = (
  { collection, localeFile: { path: entryFilePath } },
  segments,
) => {
  const entryFileFolder = getDirName(entryFilePath);

  // A set, as the two are the same unless the entry has a folder of its own
  return new Set([
    getEntryAssetFolderPath({ collection, entryFilePath, internalPath: entryFileFolder }),
    // An asset stored beside the entry file before the entry had a folder of its own, or placed
    // there by hand, is still found
    entryFileFolder,
  ])
    .values()
    .map((baseFolder) => getAssetPathMap().get(resolvePath(createPath([baseFolder, ...segments]))))
    .find(Boolean);
};

/**
 * Get the path of the given asset in an entry-relative folder, relative to the folder holding the
 * entry’s relative assets, which is where the value is resolved against when the asset is found
 * for it; see `getAssetByRelativePathAndCollection()`.
 * @param {Asset} asset Asset.
 * @param {Entry} [entry] Associated entry. Can be `undefined` when editing a new draft.
 * @param {InternalLocaleCode} [locale] Locale whose entry file the path is relative to.
 * @param {string} [collectionName] Name of the collection the asset folder belongs to.
 * @returns {string | undefined} Relative path, e.g. `images/photo.jpg`, or `undefined` if it
 * cannot be determined.
 */
const getEntryRelativePath = (asset, entry, locale, collectionName) => {
  // A file at the repository root has no folder path
  const assetFolderPath = getDirName(asset.path);

  const entryFolderPath = entry
    ? getExistingEntryAssetFolderPath({ entry, locale, collectionName })
    : undefined;

  if (entryFolderPath !== undefined) {
    // If the asset is in the same folder as the entry, return the file name only
    if (assetFolderPath === entryFolderPath) {
      return asset.name;
    }

    // Return the path relative to the entry’s folder, e.g. `images/photo.jpg`, or `undefined` if
    // the path cannot be determined
    const prefix = entryFolderPath ? `${entryFolderPath}/` : '';

    return asset.path.startsWith(prefix) ? asset.path.slice(prefix.length) : undefined;
  }

  const { internalPath, internalSubPath } = asset.folder;

  // Resolve simple entry-relative paths like `images/photo.jpg` if the asset is in the same folder
  // as the entry, which can be the repository root
  if (asset.path === createPath([internalPath, internalSubPath, asset.name])) {
    return internalPath ? asset.path.slice(internalPath.length + 1) : asset.path;
  }

  return undefined;
};

/**
 * Get the absolute path of the given asset in an entry-relative folder with an absolute public
 * path, which stands for the folder’s subfolder in the folder holding the entry’s relative assets;
 * see {@link findInEntryRelativeFolder}.
 * @param {object} args Arguments.
 * @param {string} args.relativePath Path relative to the folder holding the entry’s relative
 * assets, as given by {@link getEntryRelativePath}, e.g. `images/photo.jpg`.
 * @param {AssetFolderInfo} args.folder Asset folder whose public path applies to the asset.
 * @param {Entry} [args.entry] Associated entry, which fills the template tags in the paths.
 * @param {InternalLocaleCode} [args.locale] Locale whose entry file the tags are filled with.
 * @returns {string | undefined} Absolute path, e.g. `/blog/hello/images/photo.jpg`, or `undefined`
 * if the template tags cannot be filled or the asset is not in the folder’s subfolder.
 */
const getEntryRelativeAbsolutePath = ({ relativePath, folder, entry, locale }) => {
  const { collectionName, internalSubPath = '' } = folder;

  const [publicPath, subPath] = [/** @type {string} */ (folder.publicPath), internalSubPath].map(
    (internalPath) => fillInternalPathTemplate({ internalPath, collectionName, entry, locale }),
  );

  if (publicPath === undefined || subPath === undefined) {
    return undefined;
  }

  // Normalized like the folder the asset is saved to, so a tag that leaves an empty segment, e.g.
  // `{{dirname}}/images` for an entry at the collection root, still matches
  const resolvedSubPath = resolvePath(subPath);
  const prefix = resolvedSubPath ? `${resolvedSubPath}/` : '';

  // The asset is somewhere else in the entry’s folder, which the public path doesn’t stand for
  if (!relativePath.startsWith(prefix)) {
    return undefined;
  }

  // Normalized the same way as the path is when an asset is saved, so an empty segment left by a
  // tag, e.g. `/blog//images`, or a `.` or `..` segment is resolved; `/` becomes an empty string
  const basePath = resolvePath(publicPath);

  return `${basePath ? `/${basePath}` : ''}/${relativePath.slice(prefix.length)}`;
};

/**
 * Get the public path of the given asset in an entry-relative folder, which is saved as a field
 * value. With an absolute public path, e.g. `/blog/{{slug}}/images`, that’s the absolute path, e.g.
 * `/blog/hello/images/photo.jpg`, which is mapped back to the asset by
 * {@link findInEntryRelativeFolder}. Otherwise, or if the absolute path can’t be determined, it’s
 * the path relative to the folder holding the entry’s relative assets, e.g. `images/photo.jpg`.
 * @param {object} args Arguments.
 * @param {Asset} args.asset Asset.
 * @param {AssetFolderInfo} args.folder Asset folder whose public path applies to the asset.
 * @param {Entry} [args.entry] Associated entry. Can be `undefined` when editing a new draft.
 * @param {InternalLocaleCode} [args.locale] Locale whose entry file the path is relative to.
 * Default: the entry’s first locale.
 * @returns {string | undefined} Absolute path starting with `/` or relative path, or `undefined` if
 * neither can be determined.
 */
export const getEntryRelativePublicPath = ({ asset, folder, entry, locale }) => {
  const relativePath = getEntryRelativePath(asset, entry, locale, folder.collectionName);

  // An absolute public path is the folder’s own, e.g. `/blog/{{slug}}/images`
  const absolutePath =
    relativePath !== undefined && folder.publicPath?.startsWith('/')
      ? getEntryRelativeAbsolutePath({ relativePath, folder, entry, locale })
      : undefined;

  return absolutePath ?? relativePath;
};

/**
 * Find an asset in an entry-relative folder by an absolute path stored as a field value. The
 * folder’s absolute public path, e.g. `/blog/{{slug}}/images`, stands for its subfolder in the
 * folder holding the entry’s relative assets, e.g. `content/blog/hello/images`, where the asset was
 * saved by `resolveAssetFolderPaths()`.
 * @param {object} args Arguments.
 * @param {string} args.path Saved absolute path, e.g. `/blog/hello/images/photo.jpg`.
 * @param {AssetFolderInfo} args.folder Entry-relative asset folder with an absolute public path.
 * @param {Entry} [args.entry] Associated entry. Without it, the path is resolved against the
 * collection folder, as a relative path is by `getAssetByRelativePath()` in
 * `$lib/services/assets`.
 * @param {InternalLocaleCode} [args.locale] Locale the path is referenced in, which tells which
 * locale’s entry file the asset is stored beside. Default: the default locale.
 * @returns {Asset | undefined} Asset, if found.
 */
export const findInEntryRelativeFolder = ({ path, folder, entry, locale }) => {
  const { collectionName, internalPath, internalSubPath = '' } = folder;

  /**
   * Look for the asset beside the given locale’s entry file.
   * @param {InternalLocaleCode | undefined} _locale Locale.
   * @returns {Asset | undefined} Asset, if found.
   */
  const find = (_locale) => {
    const context = getEntryLocaleContext({ collectionName, entry, locale: _locale });

    const [publicPath, subPath] = [/** @type {string} */ (folder.publicPath), internalSubPath].map(
      (template) =>
        !hasTemplateTags(template)
          ? template
          : context
            ? fillMediaFolderTemplate(template, context)
            : undefined,
    );

    if (publicPath === undefined || subPath === undefined) {
      // Cannot resolve the template tags without an entry
      return undefined;
    }

    // Normalized the same way as the path is when the asset is saved, so an empty segment left by
    // a tag, e.g. `/blog//images`, or a `.` or `..` segment matches the saved value
    const basePath = resolvePath(publicPath);
    const prefix = basePath ? `/${basePath}/` : '/';

    if (!path.startsWith(prefix)) {
      return undefined;
    }

    const localPath = path.slice(prefix.length);

    // Without an entry, the collection folder, which an entry-relative folder always has
    return context
      ? findInEntryBaseFolders(context, [subPath, localPath])
      : getAssetPathMap().get(resolvePath(createPath([internalPath, subPath, localPath])));
  };

  return (
    find(locale) ??
    // A file in a duplicated or synced field is stored once, beside the default locale’s entry
    // file, which the other locales then share
    (locale ? find(undefined) : undefined)
  );
};
