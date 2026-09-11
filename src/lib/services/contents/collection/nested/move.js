import { fillTemplate } from '$lib/services/common/template';
import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
import {
  getEntryDirPath,
  getNestedConfig,
  isDescendantPath,
} from '$lib/services/contents/collection/nested';
import { getPreviousSha } from '$lib/services/contents/draft/save/changes';
import { serializeContent } from '$lib/services/contents/draft/save/serialize';
import { hasLocalizedSlugs } from '$lib/services/contents/draft/slugs';
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
 * InternalLocaleCode,
 * } from '$lib/types/private';
 */

/**
 * Folder an entry is being moved out of and into, in one locale.
 * @typedef {object} DirMove
 * @property {string} oldDir Folder the entry has been stored in.
 * @property {string} newDir Folder the entry is going to.
 */

/**
 * Swap the old folder path for the new one within a sub path.
 * @param {string} subPath Sub path below the old folder.
 * @param {DirMove} move Folder move.
 * @returns {string} Sub path below the new folder.
 */
const moveSubPath = (subPath, { oldDir, newDir }) => {
  const restPath = subPath.slice(oldDir.length + 1);

  return newDir ? `${newDir}/${restPath}` : restPath;
};

/**
 * Rewrite an entry’s file paths and slugs for its new location. The folders can go by a different
 * name in each locale, so each locale’s file is moved on its own, from and to the folder the moved
 * ancestor has in that locale. A file that isn’t stored below the ancestor’s folder in its locale
 * is left where it is.
 * @param {object} args Arguments.
 * @param {Entry} args.entry Entry to be moved.
 * @param {DirMove} args.dirMove Folder move in the default locale.
 * @param {Record<InternalLocaleCode, DirMove>} args.localeDirMoves Folder move in each locale.
 * @returns {Entry | undefined} Moved entry, or `undefined` if none of its files moves. The original
 * is left untouched.
 * @see https://github.com/sveltia/sveltia-cms/issues/962
 */
const moveEntry = ({ entry, dirMove, localeDirMoves }) => {
  const { subPath } = entry;
  const newSubPath = moveSubPath(subPath, dirMove);
  let moved = false;

  const locales = Object.fromEntries(
    Object.entries(entry.locales).map(([locale, localizedEntry]) => {
      const { slug, path } = localizedEntry;
      const localeDirMove = localeDirMoves[locale];

      // A locale that was disabled leaves the entry with a path but no slug to move
      if (!slug || !isDescendantPath(localeDirMove.oldDir, slug)) {
        return [locale, localizedEntry];
      }

      const newLocaleSubPath = moveSubPath(slug, localeDirMove);

      // The folder may keep its name in this locale while it’s renamed in another
      if (newLocaleSubPath === slug) {
        return [locale, localizedEntry];
      }

      // Swap the old sub path for the new one within the full file path, leaving the collection
      // folder, any locale folder and the file extension in place
      const index = path.lastIndexOf(slug);

      /* v8 ignore next */
      if (index === -1) {
        return [locale, localizedEntry];
      }

      moved = true;

      return [
        locale,
        {
          ...localizedEntry,
          slug: newLocaleSubPath,
          path: `${path.slice(0, index)}${newLocaleSubPath}${path.slice(index + slug.length)}`,
        },
      ];
    }),
  );

  if (!moved) {
    return undefined;
  }

  return { ...entry, slug: newSubPath, subPath: newSubPath, locales };
};

/**
 * Refresh the canonical slug of a moved entry. In a nested collection with localized slugs, the
 * localized files are linked by the default locale’s sub path, which has just changed, so each file
 * gets the new one, or the link would go stale and stop matching the entry’s own location.
 * @param {object} args Arguments.
 * @param {InternalCollection} args.collection Collection the entry belongs to.
 * @param {Entry} args.entry Moved entry.
 * @returns {Entry} Entry with the canonical slug updated in every locale that has content. The
 * given entry is returned as is when the slugs aren’t localized, because the canonical slug is
 * then not maintained by the CMS.
 * @see https://github.com/sveltia/sveltia-cms/issues/962
 */
const updateCanonicalSlug = ({ collection, entry }) => {
  if (!hasLocalizedSlugs(collection)) {
    return entry;
  }

  const {
    _i18n: {
      defaultLocale,
      canonicalSlug: { key, value: template },
    },
  } = collection;

  const { subPath, locales } = entry;

  const canonicalSlug =
    template === '{{slug}}'
      ? subPath
      : fillTemplate(template, {
          collection: /** @type {InternalEntryCollection} */ (collection),
          locale: defaultLocale,
          content: locales[defaultLocale]?.content ?? {},
          currentSlug: subPath,
        });

  return {
    ...entry,
    locales: Object.fromEntries(
      Object.entries(locales).map(([locale, localizedEntry]) => [
        locale,
        localizedEntry.content
          ? // Copy the content, which is shared with the entry in the store
            { ...localizedEntry, content: { ...localizedEntry.content, [key]: canonicalSlug } }
          : localizedEntry,
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

      // The file stays where it is when the folder isn’t localized the same way in this locale
      if (previousPath === localizedEntry.path) {
        return undefined;
      }

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
  if (!oldDirPath || isDescendantPath(oldDirPath, newDirPath)) {
    return noChanges;
  }

  const descendants = getEntriesByCollection(collection.name).filter(
    (entry) => entry.id !== originalEntry.id && isDescendantPath(oldDirPath, entry.subPath),
  );

  if (!descendants.length) {
    return noChanges;
  }

  const {
    _i18n: { allLocales },
  } = /** @type {InternalEntryCollection} */ (collection);

  /** @type {DirMove} */
  const dirMove = { oldDir: oldDirPath, newDir: newDirPath };

  // With localized slugs, the ancestor’s folder goes by a different name in each locale, and so
  // does its destination. A locale the ancestor doesn’t have, or is only getting now, falls back to
  // the default locale’s folder on that side
  const localeDirMoves = Object.fromEntries(
    allLocales.map((locale) => [
      locale,
      {
        oldDir: getEntryDirPath(originalEntry.locales[locale]?.slug ?? '') || oldDirPath,
        newDir: getEntryDirPath(savingEntry.locales[locale]?.slug ?? '') || newDirPath,
      },
    ]),
  );

  const movedEntries = descendants.flatMap((entry) => {
    const movedEntry = moveEntry({ entry, dirMove, localeDirMoves });

    return movedEntry
      ? [
          {
            originalEntry: entry,
            movedEntry: updateCanonicalSlug({ collection, entry: movedEntry }),
          },
        ]
      : [];
  });

  // Nothing moves when the folder keeps its name in every locale
  if (!movedEntries.length) {
    return noChanges;
  }

  const db = resolveCacheDB(cacheDB);
  const draft = createSyntheticDraft({ collection });

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
