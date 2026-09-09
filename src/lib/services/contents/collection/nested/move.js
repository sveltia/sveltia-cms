import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
import {
  getEntryDirPath,
  getNestedConfig,
  isDescendantPath,
} from '$lib/services/contents/collection/nested';
import { getPreviousSha } from '$lib/services/contents/draft/save/changes';
import { serializeContent } from '$lib/services/contents/draft/save/serialize';
import {
  buildSingleFileContent,
  createSyntheticDraft,
  resolveCacheDB,
} from '$lib/services/contents/entry/changes';
import { formatEntryFile } from '$lib/services/contents/file/format';

/**
 * @import { IndexedDB } from '@sveltia/utils/storage';
 * @import {
 * Entry,
 * FileChange,
 * InternalCollection,
 * InternalEntryCollection,
 * } from '$lib/types/private';
 */

/**
 * Rewrite an entry’s file paths and slugs for its new location.
 * @param {object} args Arguments.
 * @param {Entry} args.entry Entry to be moved.
 * @param {string} args.newSubPath Entry’s new sub path.
 * @returns {Entry} Moved entry. The original is left untouched.
 */
const moveEntry = ({ entry, newSubPath }) => {
  const { subPath } = entry;

  /**
   * Swap the old sub path for the new one within a full file path, leaving the collection folder,
   * any locale folder and the file extension in place.
   * @param {string} path File path.
   * @returns {string} New file path.
   */
  const movePath = (path) => {
    const index = path.lastIndexOf(subPath);

    return index === -1
      ? /* v8 ignore next */ path
      : `${path.slice(0, index)}${newSubPath}${path.slice(index + subPath.length)}`;
  };

  return {
    ...entry,
    slug: newSubPath,
    subPath: newSubPath,
    locales: Object.fromEntries(
      Object.entries(entry.locales).map(([locale, localizedEntry]) => [
        locale,
        { ...localizedEntry, slug: newSubPath, path: movePath(localizedEntry.path) },
      ]),
    ),
  };
};

/**
 * Build the `move` file changes for one entry that’s being relocated along with its ancestor.
 * @param {object} args Arguments.
 * @param {InternalCollection} args.collection Collection the entry belongs to.
 * @param {Entry} args.originalEntry Entry as it is stored now.
 * @param {Entry} args.movedEntry Same entry with its new paths.
 * @param {any} args.draft Synthetic draft used for serialization.
 * @param {IndexedDB} [args.cacheDB] File cache database, when available.
 * @returns {Promise<FileChange[]>} Move changes, one per file the entry occupies.
 */
const buildMoveChanges = async ({ collection, originalEntry, movedEntry, draft, cacheDB }) => {
  const {
    _file,
    _i18n: {
      i18nEnabled,
      allLocales,
      defaultLocale,
      structureMap: { i18nSingleFile, i18nSingleFileDefaultRoot } = {},
    },
  } = /** @type {InternalEntryCollection} */ (collection);

  if (!i18nEnabled || i18nSingleFile || i18nSingleFileDefaultRoot) {
    const previousPath = originalEntry.locales[defaultLocale].path;
    const { slug, path } = movedEntry.locales[defaultLocale];

    const [previousSha, data] = await Promise.all([
      getPreviousSha({ cacheDB, previousPath }),
      formatEntryFile({
        content: buildSingleFileContent({ config: collection, entry: movedEntry, draft }),
        _file,
      }),
    ]);

    return [
      /** @type {FileChange} */ ({ action: 'move', slug, path, previousPath, previousSha, data }),
    ];
  }

  const localeChanges = await Promise.all(
    allLocales.map(async (locale) => {
      const localizedEntry = movedEntry.locales[locale];

      if (!localizedEntry?.content) {
        return undefined;
      }

      const previousPath = originalEntry.locales[locale].path;

      const [previousSha, data] = await Promise.all([
        getPreviousSha({ cacheDB, previousPath }),
        formatEntryFile({
          content: serializeContent({ draft, locale, valueMap: localizedEntry.content }),
          _file,
        }),
      ]);

      return /** @type {FileChange} */ ({
        action: 'move',
        slug: localizedEntry.slug,
        path: localizedEntry.path,
        previousPath,
        previousSha,
        data,
      });
    }),
  );

  return /** @type {FileChange[]} */ (localeChanges.filter(Boolean));
};

/**
 * Build the file changes that move the whole subtree of a nested collection entry along with the
 * entry itself. In the `subfolders` mode, an entry owns the folder it’s stored in, so relocating it
 * with the path editor has to take everything below that folder with it, or the descendants would
 * be orphaned in a folder that no longer has an entry of its own.
 * @param {object} args Arguments.
 * @param {InternalCollection} args.collection Collection of the moved entry.
 * @param {Entry} [args.originalEntry] Moved entry as it was before the save. `undefined` for a new
 * entry, which has nothing below it yet.
 * @param {Entry} args.savingEntry Moved entry being saved.
 * @param {IndexedDB} [args.cacheDB] Pre-opened file-cache database to reuse.
 * @returns {Promise<{ changes: FileChange[], savingEntries: Entry[] }>} Collected changes and the
 * entries to be saved.
 * @see https://decapcms.org/docs/collection-nested/
 */
export const buildNestedMoveChanges = async ({
  collection,
  originalEntry,
  savingEntry,
  cacheDB,
}) => {
  /** @type {{ changes: FileChange[], savingEntries: Entry[] }} */
  const noChanges = { changes: [], savingEntries: [] };

  if (!originalEntry || !getNestedConfig(collection)?.subfolders) {
    return noChanges;
  }

  const oldDirPath = getEntryDirPath(originalEntry.subPath);
  const newDirPath = getEntryDirPath(savingEntry.subPath);

  // A folder can’t be moved into itself; the path editor rejects that before the save
  if (!oldDirPath || oldDirPath === newDirPath || isDescendantPath(oldDirPath, newDirPath)) {
    return noChanges;
  }

  const descendants = getEntriesByCollection(collection.name).filter(
    (entry) => entry.id !== originalEntry.id && isDescendantPath(oldDirPath, entry.subPath),
  );

  if (!descendants.length) {
    return noChanges;
  }

  const db = resolveCacheDB(cacheDB);
  const draft = createSyntheticDraft({ collection });

  const movedEntries = descendants.map((entry) => {
    const restPath = entry.subPath.slice(oldDirPath.length + 1);

    return {
      originalEntry: entry,
      movedEntry: moveEntry({
        entry,
        newSubPath: newDirPath ? `${newDirPath}/${restPath}` : restPath,
      }),
    };
  });

  const perEntryChanges = await Promise.all(
    movedEntries.map(({ originalEntry: source, movedEntry }) =>
      buildMoveChanges({ collection, originalEntry: source, movedEntry, draft, cacheDB: db }),
    ),
  );

  return {
    changes: perEntryChanges.flat(),
    savingEntries: movedEntries.map(({ movedEntry }) => movedEntry),
  };
};
