import { isCollectionIndexFile } from '$lib/services/contents/collection/entries/index-file';
import { getCollectionFilesByEntry } from '$lib/services/contents/collection/files';
import { getAssociatedCollections } from '$lib/services/contents/entry/collections';

/**
 * @import { Entry, InternalCollection, InternalCollectionFile } from '$lib/types/private';
 */

/**
 * Where an entry is configured: a collection it belongs to and, for a file/singleton collection,
 * the collection file it matches.
 * @typedef {object} EntryCollectionContext
 * @property {InternalCollection} collection Collection.
 * @property {InternalCollectionFile} [collectionFile] Collection file, if the collection is a
 * file/singleton collection.
 * @property {boolean} isIndexFile Whether the entry is the collection’s index file.
 */

/**
 * Get every place the given entry is configured in: each collection it belongs to, or, for a
 * file/singleton collection, each collection file it matches. One entry can theoretically appear in
 * multiple collections and collection files depending on the configuration, so its fields are
 * looked up in each of them. The contexts are produced lazily, so a caller looking for the first
 * one that matches doesn’t look up the files of the remaining collections.
 * @param {Entry} entry Entry.
 * @returns {IteratorObject<EntryCollectionContext>} Contexts.
 */
export const getEntryCollectionContexts = (entry) =>
  getAssociatedCollections(entry)
    .values()
    .flatMap((collection) => {
      const isIndexFile = isCollectionIndexFile(collection, entry);
      const collectionFiles = getCollectionFilesByEntry(collection, entry);

      return collectionFiles.length
        ? collectionFiles.map((collectionFile) => ({ collection, collectionFile, isIndexFile }))
        : [{ collection, isIndexFile }];
    });
