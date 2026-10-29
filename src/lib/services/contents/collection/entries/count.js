import {
  countCollectionEntries,
  getEntriesByCollection,
} from '$lib/services/contents/collection/entries';
import {
  getCompanionEntries,
  mergeUnpublishedEntries,
  unpublishedEntries,
} from '$lib/services/workflow';

/**
 * Count the entries in the entry collection that take up a slot of its `limit` quota: the
 * published ones, plus the unpublished entries that have never been published, which Editorial
 * Workflow keeps out of {@link getEntriesByCollection}, including the new ones riding along in the
 * pull request of an entry of another collection. Like the count shown next to the collection in
 * the sidebar, it leaves Hugo’s special index file out — see {@link countCollectionEntries}.
 * @param {string} collectionName Collection name.
 * @returns {number} Count.
 */
export const countQuotaEntries = (collectionName) =>
  countCollectionEntries(collectionName, [
    ...mergeUnpublishedEntries(
      getEntriesByCollection(collectionName),
      unpublishedEntries.current.filter(
        ({ workflow }) => workflow.collectionName === collectionName,
      ),
    ),
    ...getCompanionEntries(collectionName),
  ]);
