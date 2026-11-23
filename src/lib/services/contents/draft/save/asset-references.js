import { getExistingEntryAssetFolderPath } from '$lib/services/assets/entry-folder';
import { getAssetFolder } from '$lib/services/assets/folders';
import { getAssetPublicURL } from '$lib/services/assets/info';
import { getEntriesByAssets } from '$lib/services/assets/references';
import { allAssets } from '$lib/services/assets/state';
import { hasTemplateTags } from '$lib/services/common/template/tags';
import {
  getMovedFolders,
  getPathInMovedFolder,
} from '$lib/services/contents/draft/save/asset-move';
import { getBaseName } from '$lib/services/utils/file';
import { getEntryAssetVersion } from '$lib/services/workflow/assets';

/**
 * @import {
 * Asset,
 * Entry,
 * InternalCollection,
 * InternalCollectionFile,
 * InternalLocaleCode,
 * LocalizedEntry,
 * } from '$lib/types/private';
 * @import { AssetReferenceTarget } from '$lib/services/assets/references';
 */

/**
 * Get the path an asset goes to when the folder holding it moves along with the entry, as
 * `buildEntryAssetMoveChanges()` moves it.
 * @param {string} path Asset path.
 * @param {Map<string, string>} movedFolders Moved folders, from `getMovedFolders()`.
 * @returns {string} New path, or the same path if the asset stays where it is.
 */
const getMovedAssetPath = (path, movedFolders) =>
  [...movedFolders]
    .map(([oldFolderPath, newFolderPath]) =>
      getPathInMovedFolder(path, oldFolderPath, newFolderPath),
    )
    .find((movedPath) => movedPath !== undefined) ?? path;

/**
 * Get the targets rewriting the absolute references to an entry’s relative assets in a locale,
 * whose public path is about to change, e.g. from `/blog/hello/images/photo.jpg` to
 * `/blog/hello-world/images/photo.jpg` once the slug filling the `public_folder` template has been
 * renamed. The references are matched by their old URL as is, so a relative reference, or one to
 * another entry’s asset, is left alone.
 * @param {object} args Arguments.
 * @param {Map<string, string>} args.movedFolders Folders the entry is leaving, see
 * `getMovedFolders()`.
 * @param {string} args.collectionName Collection name.
 * @param {Entry} args.originalEntry Entry as it is stored now.
 * @param {Entry} args.savingEntry Same entry as it’s being saved.
 * @param {InternalLocaleCode} args.locale Locale whose entry file the assets are stored beside.
 * @returns {AssetReferenceTarget[]} Targets, each with the old URL and the new one.
 */
const getLocaleTargets = ({ movedFolders, collectionName, originalEntry, savingEntry, locale }) => {
  const folderPath = getExistingEntryAssetFolderPath({
    entry: originalEntry,
    locale,
    collectionName,
  });

  const prefix = folderPath ? `${folderPath}/` : '';

  // Only the versions of the assets this entry has, as in `buildEntryAssetMoveChanges()`. Those
  // outside the entry’s folder are left out first, so the asset list isn’t mapped on every save
  const assets = /** @type {Asset[]} */ (
    allAssets.current
      .filter(({ path }) => path.startsWith(prefix))
      .map((asset) => getEntryAssetVersion(asset, originalEntry))
      .filter(Boolean)
  );

  return assets.flatMap((asset) => {
    const url = getAssetPublicURL(asset, { pathOnly: true, entry: originalEntry, locale });

    // A relative reference stays the same wherever the entry goes
    if (!url?.startsWith('/')) {
      return [];
    }

    const path = getMovedAssetPath(asset.path, movedFolders);

    const newURL = getAssetPublicURL(
      { ...asset, path, name: getBaseName(path) },
      { pathOnly: true, entry: savingEntry, locale },
    );

    return newURL && newURL !== url ? [{ url, newURL }] : [];
  });
};

/**
 * Rewrite the references in an entry being saved to its own relative assets, when they are referred
 * to with an absolute public path filled with the entry’s values, e.g. `/blog/{{slug}}/images`,
 * which changes when the slug is renamed or the entry is moved, e.g. with `{{dirname}}`. The
 * references would otherwise keep the old path, which no longer leads to the assets, whether or not
 * they have moved to the entry’s new folder along with it. The references are rewritten in each
 * locale with the paths of that locale, as well as the default locale’s, which a field holding the
 * same value in every locale refers to, the same way they are written when a file is uploaded; see
 * `replaceBlobURLs()` in `changes.js`. Every field that can hold an asset reference is covered, the
 * same as when an asset is renamed or moved; see `getEntriesByAssets()`.
 * @param {object} args Arguments.
 * @param {InternalCollection} args.collection Collection the entry belongs to.
 * @param {InternalCollectionFile} [args.collectionFile] Collection file. File/singleton collection
 * only.
 * @param {boolean} [args.isIndexFile] Whether the entry is the collection’s special index file.
 * @param {Entry} [args.originalEntry] Entry as it was before the save. `undefined` for a new entry,
 * which has no references to rewrite yet.
 * @param {Entry} args.savingEntry Entry being saved. It’s left untouched.
 * @returns {Promise<Entry>} The entry with its references rewritten in a copy of the content of
 * each locale holding any of them, or the given entry if there’s nothing to rewrite.
 */
export const rewriteEntryAssetReferences = async ({
  collection,
  collectionFile,
  isIndexFile,
  originalEntry,
  savingEntry,
}) => {
  const { name: collectionName } = collection;
  const folder = getAssetFolder({ collectionName, fileName: collectionFile?.name, isIndexFile });
  const publicPath = folder?.publicPath;

  // Only an absolute public path with template tags changes along with the entry; a relative one
  // is resolved against wherever the entry is
  if (
    !originalEntry ||
    !folder?.entryRelative ||
    !publicPath?.startsWith('/') ||
    !hasTemplateTags(publicPath)
  ) {
    return savingEntry;
  }

  const movedFolders = getMovedFolders({ collection, originalEntry, savingEntry });
  const { defaultLocale } = (collectionFile ?? collection)._i18n;
  /** @type {Map<InternalLocaleCode, AssetReferenceTarget[]>} */
  const targetCache = new Map();

  /**
   * Get the targets of a locale, worked out once.
   * @param {InternalLocaleCode} locale Locale.
   * @returns {AssetReferenceTarget[]} Targets.
   */
  const getTargets = (locale) => {
    let targets = targetCache.get(locale);

    if (!targets) {
      targets = originalEntry.locales[locale]
        ? getLocaleTargets({
            movedFolders,
            collectionName,
            originalEntry,
            savingEntry,
            locale,
          })
        : [];
      targetCache.set(locale, targets);
    }

    return targets;
  };

  /** @type {[InternalLocaleCode, LocalizedEntry][]} */
  const locales = await Promise.all(
    Object.entries(savingEntry.locales).map(async ([locale, localizedEntry]) => {
      const targets = localizedEntry.content
        ? [
            ...getTargets(locale),
            // A file in a field holding the same value in every locale is stored beside the
            // default locale’s entry file
            ...(locale === defaultLocale ? [] : getTargets(defaultLocale)),
          ]
        : [];

      if (!targets.length) {
        return [locale, localizedEntry];
      }

      // The content is copied, as it can be shared with the entry in the store
      const content = { ...localizedEntry.content };

      // Searched as an entry with this locale only, so the references are rewritten with the paths
      // of this locale. The references are replaced in place, in the copy
      await getEntriesByAssets(targets, {
        entries: [{ ...savingEntry, locales: { [locale]: { ...localizedEntry, content } } }],
      });

      return [locale, { ...localizedEntry, content }];
    }),
  );

  return locales.every(([locale, localizedEntry]) => localizedEntry === savingEntry.locales[locale])
    ? savingEntry
    : { ...savingEntry, locales: Object.fromEntries(locales) };
};
