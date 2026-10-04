import { getArrayItemTarget } from '$lib/services/contents/draft/save/changes';
import { buildEntryFileChanges } from '$lib/services/contents/draft/save/file-changes';
import { resolveFileConfig } from '$lib/services/contents/file/config';

/**
 * @import { IndexedDB } from '@sveltia/utils/storage';
 * @import {
 * Entry,
 * FileChange,
 * InternalCollection,
 * InternalCollectionFile,
 * InternalEntryCollection,
 * InternalLocaleCode,
 * } from '$lib/types/private';
 * @import { EntryFilePlan } from '$lib/services/contents/draft/save/file-changes';
 */

/**
 * Build a synthetic draft object suitable for {@link formatEntryData} and the field validator.
 * Bulk operations that re-save existing entries — reordering, cascading relation updates — don’t
 * go through the entry editor, so there’s no real draft to serialize with; only the few properties
 * read by the serializer and the validator are needed. The shape is identical for every entry in a
 * given collection, so callers working on a batch should build it once and pass it down to avoid
 * per-entry allocations.
 * @param {object} args Arguments.
 * @param {InternalCollection} args.collection Collection the entries belong to.
 * @param {InternalCollectionFile} [args.collectionFile] Collection file, for file/singleton
 * collections.
 * @param {boolean} [args.isIndexFile] Whether the entry is the collection’s special index file.
 * @returns {any} Synthetic draft.
 */
export const createSyntheticDraft = ({ collection, collectionFile, isIndexFile = false }) => ({
  collection,
  collectionName: collection.name,
  collectionFile,
  fileName: collectionFile?.name,
  fields: collectionFile?.fields ?? /** @type {InternalEntryCollection} */ (collection).fields,
  isIndexFile,
});

/**
 * Build the `update` {@link FileChange}(s) needed to re-save an existing entry whose content has
 * already been modified in place. One change is produced per file the entry occupies: a single one
 * unless the collection uses a file-per-locale i18n structure.
 * @param {object} args Arguments.
 * @param {InternalCollection} args.collection Collection the entry belongs to.
 * @param {InternalCollectionFile} [args.collectionFile] Collection file, for file/singleton
 * collections.
 * @param {Entry} args.entry Entry with the updated content applied.
 * @param {any} args.draft Synthetic draft from {@link createSyntheticDraft}.
 * @param {IndexedDB} [args.cacheDB] File cache database, when available.
 * @returns {Promise<FileChange[]>} Update changes.
 */
export const buildEntryUpdateChanges = async ({
  collection,
  collectionFile,
  entry,
  draft,
  cacheDB,
}) => {
  const config = /** @type {InternalCollectionFile} */ (collectionFile ?? collection);

  return buildEntryFileChanges({
    draft,
    config,
    _file: resolveFileConfig({ collection, collectionFile, isIndexFile: draft.isIndexFile }),
    entry,
    cacheDB,
    /**
     * Plan the change to a file of the entry.
     * @param {InternalLocaleCode} [locale] Locale of the file, or `undefined` for the single file.
     * @returns {EntryFilePlan | undefined} Planned change.
     */
    planChange: (locale) => {
      if (locale === undefined) {
        const { slug, path } = entry.locales[config._i18n.defaultLocale];

        return { action: 'update', slug, path, currentPath: path, ...getArrayItemTarget(entry) };
      }

      const { slug, path, content } = entry.locales[locale] ?? {};

      return content ? { action: 'update', slug, path, currentPath: path } : undefined;
    },
  });
};
