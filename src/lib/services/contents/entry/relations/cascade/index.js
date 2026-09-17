import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
import { isCollectionIndexFile } from '$lib/services/contents/collection/entries/index-file';
import {
  buildEntryUpdateChanges,
  createSyntheticDraft,
  resolveCacheDB,
} from '$lib/services/contents/entry/changes';

/**
 * @import { IndexedDB } from '@sveltia/utils/storage';
 * @import { CascadeTarget, Entry, FileChange, ResolvedRelationField } from '$lib/types/private';
 */

/**
 * Get the entries that may hold a reference to the given entries through the given Relation field.
 * @param {object} args Arguments.
 * @param {ResolvedRelationField} args.relation Relation field.
 * @param {Set<string>} args.excludeIds IDs of the entries being saved or deleted on their own,
 * which are never rewritten here: a renamed entry is saved along with any self-reference it holds,
 * and a deleted entry takes its references away with it.
 * @returns {Entry[]} Candidate entries. Whether each one actually holds a reference is up to the
 * caller to find out.
 */
export const getCandidateEntries = ({ relation, excludeIds }) => {
  const { sourceCollection, sourceCollectionFile } = relation;
  const sourceFileName = sourceCollectionFile?.name;

  return getEntriesByCollection(sourceCollection.name).filter(
    (entry) =>
      !excludeIds.has(entry.id) &&
      // In a file/singleton collection, only the file holding the field can reference it
      (!sourceFileName || entry.slug === sourceFileName),
  );
};

/**
 * Build the `update` file changes that write the given cascade targets back, one per file the
 * entry occupies.
 * @param {object} args Arguments.
 * @param {CascadeTarget[]} args.targets Cascade targets.
 * @param {IndexedDB} [args.cacheDB] Pre-opened file-cache database to reuse.
 * @returns {Promise<{ changes: FileChange[], savingEntries: Entry[] }>} Collected changes and the
 * entries to be saved.
 */
export const buildTargetChanges = async ({ targets, cacheDB }) => {
  if (!targets.length) {
    return { changes: [], savingEntries: [] };
  }

  const db = resolveCacheDB(cacheDB);

  const perEntryChanges = await Promise.all(
    targets.map(({ entry, collection, collectionFile }) =>
      buildEntryUpdateChanges({
        collection,
        collectionFile,
        entry,
        draft: createSyntheticDraft({
          collection,
          collectionFile,
          isIndexFile: isCollectionIndexFile(collection, entry),
        }),
        cacheDB: db,
      }),
    ),
  );

  return {
    changes: perEntryChanges.flat(),
    savingEntries: targets.map(({ entry }) => entry),
  };
};
