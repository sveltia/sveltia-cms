import { getEntriesByCollection } from '$lib/services/contents/collection/entries';

/**
 * @import { Entry, ResolvedRelationField } from '$lib/types/private';
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
