import { generateUUID } from '@sveltia/utils/crypto';
import equal from 'fast-deep-equal';

import { createLocalizedError } from '$lib/services/backends/git/shared/errors';
import { allEntries } from '$lib/services/contents';
import { getCollection } from '$lib/services/contents/collection';
import { isArrayFileCollection } from '$lib/services/contents/collection/predicates';
import { resolveCacheDB } from '$lib/services/contents/draft/save/file-changes';
import { getEntrySummaryFromContent } from '$lib/services/contents/entry/summary';
import { formatEntryFile } from '$lib/services/contents/file/format';
import { arrayFileItems, createArrayItemEntry } from '$lib/services/contents/file/process';
import { getEntryFoldersByPath } from '$lib/services/contents/folders';

/**
 * @import {
 * ArrayItemTarget,
 * Entry,
 * FileChange,
 * InternalEntryCollection,
 * RepositoryFileInfo,
 * RepositoryFileMetadata,
 * } from '$lib/types/private';
 */

/**
 * Item of a file storing all the entries of an entry collection, as it will be saved.
 * @typedef {object} ArrayFileSlot
 * @property {any} item Raw item.
 * @property {number} [from] Position of the item in the array before the changes. `undefined` for
 * a new item.
 */

/**
 * Changes made to a file storing all the entries of an entry collection, combined into one.
 * @typedef {object} ArrayFileUpdate
 * @property {InternalEntryCollection} collection Collection.
 * @property {string} path File path.
 * @property {ArrayFileSlot[]} slots Items of the file, as they will be saved.
 * @property {FileChange} change Change rewriting the whole file.
 */

/**
 * Get the entry collection storing all the entries in the file at the given path.
 * @param {string} path File path.
 * @returns {InternalEntryCollection | undefined} Collection, or `undefined` if the file is not one.
 */
export const getArrayFileCollection = (path) => {
  // Such a file is listed with its path like a collection file, but without a collection file name
  const folder = getEntryFoldersByPath(path).find(
    ({ fileName, filePathMap }) => !fileName && !!filePathMap,
  );

  const collection = folder ? getCollection(folder.collectionName) : undefined;

  return isArrayFileCollection(collection)
    ? /** @type {InternalEntryCollection} */ (collection)
    : undefined;
};

/**
 * Get the changes to be made to a file storing all the entries of an entry collection.
 * @param {FileChange[]} changes Changes.
 * @returns {Map<string, { collection: InternalEntryCollection, changes: FileChange[] }>} Changes
 * grouped by file path. Changes to other files are not included.
 */
const groupArrayFileChanges = (changes) => {
  /** @type {Map<string, { collection: InternalEntryCollection, changes: FileChange[] }>} */
  const groups = new Map();

  changes.forEach((change) => {
    const { path } = change;
    const group = groups.get(path);

    if (group) {
      group.changes.push(change);

      return;
    }

    const collection = getArrayFileCollection(path);

    if (collection) {
      groups.set(path, { collection, changes: [change] });
    }
  });

  return groups;
};

/**
 * Apply the changes to the items of a file storing all the entries of an entry collection.
 * @param {object} args Arguments.
 * @param {InternalEntryCollection} args.collection Collection.
 * @param {string} args.path File path.
 * @param {any[]} args.items Items currently in the file.
 * @param {FileChange[]} args.changes Changes to the items.
 * @returns {ArrayFileSlot[]} Items to be saved.
 * @throws {Error} When an item has been changed since the user has seen it, which means it has
 * probably moved, and the change would then apply to another item.
 */
export const applyArrayFileChanges = ({ collection, path, items, changes }) => {
  /** @type {ArrayFileSlot[]} */
  const slots = items.map((item, index) => ({ item, from: index }));
  /** @type {Set<number>} */
  const removed = new Set();

  /**
   * Make sure the item the user has seen is still at the same position.
   * @param {ArrayItemTarget} target Item.
   * @throws {Error} When it isn’t.
   */
  const check = ({ index, locales }) => {
    const current =
      index < items.length
        ? createArrayItemEntry({ collection, item: items[index], index, path })
        : undefined;

    if (index >= items.length || (locales && !equal(current?.locales, locales))) {
      throw createLocalizedError(
        `The item at ${index} in ${path} has been changed since it was loaded.`,
        'save_conflict.array_item_changed',
      );
    }
  };

  changes.forEach((change) => {
    const { action, data, arrayItem, arrayOrder } = change;

    if (arrayOrder) {
      arrayOrder.forEach(check);

      // The items take the positions the listed items occupy now, so an item that’s not listed,
      // e.g. one that doesn’t make an entry, stays where it is
      const positions = arrayOrder.map(({ index }) => index).sort((a, b) => a - b);
      const reordered = arrayOrder.map(({ index }) => slots[index]);

      positions.forEach((position, order) => {
        slots[position] = reordered[order];
      });

      return;
    }

    if (arrayItem) {
      check(arrayItem);
    }

    if (action === 'delete') {
      if (arrayItem) {
        removed.add(arrayItem.index);
      }

      return;
    }

    const item = JSON.parse(/** @type {string} */ (data));

    if (arrayItem) {
      // The position can have changed with a reorder made in the same commit. A removed item is
      // only left out at the end, so the item is always found
      const slot = /** @type {ArrayFileSlot} */ (
        slots.find(({ from }) => from === arrayItem.index)
      );

      slot.item = item;
    } else {
      slots.push({ item });
    }
  });

  return slots.filter(({ from }) => from === undefined || !removed.has(from));
};

/**
 * Get a label for the first item changed in a file storing all the entries of an entry collection,
 * which stands in for the entry slug in the commit message, as the slug is just the position.
 * @param {object} args Arguments.
 * @param {InternalEntryCollection} args.collection Collection.
 * @param {string} args.path File path.
 * @param {any[]} args.items Items currently in the file.
 * @param {FileChange} args.change First change to the file.
 * @returns {string | undefined} Label, e.g. the title of the entry.
 */
const getItemLabel = ({ collection, path, items, change }) => {
  const { data, arrayItem, arrayOrder } = change;
  const target = arrayOrder?.[0] ?? arrayItem;
  const index = target?.index ?? items.length;
  const item = data ? JSON.parse(/** @type {string} */ (data)) : items[index];
  const entry = createArrayItemEntry({ collection, item, index, path });
  const content = entry?.locales[collection._i18n.defaultLocale]?.content;

  return content
    ? getEntrySummaryFromContent(content, {
        identifierField: collection.identifier_field,
        useBody: false,
      }) || undefined
    : undefined;
};

/**
 * Combine the changes made to each file storing all the entries of an entry collection into one
 * change rewriting the file. The file is rewritten from the items as they are in the repository
 * now, rather than from the entries in the store, so an item someone else has changed in the
 * meantime is kept, as long as it’s not the one being changed, and so are the items that don’t
 * make an entry and the properties that aren’t defined as fields.
 * @param {FileChange[]} changes Changes, including the ones to other files.
 * @returns {Promise<{ changes: FileChange[], arrayFileUpdates: ArrayFileUpdate[] }>} Changes to be
 * committed, and the combined changes to the files storing all the entries.
 * @throws {Error} When a file can’t be updated, or an item has been changed by someone else.
 */
export const combineArrayFileChanges = async (changes) => {
  const groups = groupArrayFileChanges(changes);

  if (!groups.size) {
    return { changes, arrayFileUpdates: [] };
  }

  const cacheDB = resolveCacheDB();

  /** @type {ArrayFileUpdate[]} */
  const arrayFileUpdates = await Promise.all(
    [...groups].map(async ([path, { collection, changes: fileChanges }]) => {
      const items = arrayFileItems.get(path);

      // A file that exists but doesn’t contain an array can’t be updated without losing its content
      if (items === null) {
        throw createLocalizedError(
          `${path} can’t be updated, as it doesn’t contain a valid array.`,
          'save_conflict.array_file_invalid',
          { path },
        );
      }

      const slots = applyArrayFileChanges({
        collection,
        path,
        items: items ?? [],
        changes: fileChanges,
      });

      const cache = /** @type {RepositoryFileInfo | undefined} */ (await cacheDB?.get(path));

      /** @type {FileChange} */
      const change = {
        action: items ? 'update' : 'create',
        slug:
          getItemLabel({ collection, path, items: items ?? [], change: fileChanges[0] }) ??
          fileChanges[0].slug,
        path,
        previousSha: cache?.sha,
        data: await formatEntryFile({
          content: /** @type {any} */ (slots.map(({ item }) => item)),
          _file: collection._file,
        }),
      };

      return { collection, path, slots, change };
    }),
  );

  return {
    changes: [
      ...changes.filter(({ path }) => !groups.has(path)),
      ...arrayFileUpdates.map(({ change }) => change),
    ],
    arrayFileUpdates,
  };
};

/**
 * Create the entries for the files storing all the entries of an entry collection, once the
 * combined changes have been committed. An entry keeps the ID of the entry it was made from, so the
 * rest of the app doesn’t lose track of it even when it has moved in the array.
 * @param {object} args Arguments.
 * @param {ArrayFileUpdate[]} args.arrayFileUpdates Combined changes.
 * @param {Entry[]} args.savingEntries Entries being saved, whose IDs go to the new entries.
 * @param {RepositoryFileMetadata} args.meta Commit metadata.
 * @returns {{ entries: Entry[], savedEntries: Map<Entry, Entry> }} All the entries in the files,
 * and the new entries made from the entries being saved.
 */
export const createArrayFileEntries = ({ arrayFileUpdates, savingEntries, meta }) => {
  /** @type {Entry[]} */
  const entries = [];
  /** @type {Map<Entry, Entry>} */
  const savedEntries = new Map();

  arrayFileUpdates.forEach(({ collection, path, slots }) => {
    const { defaultLocale } = collection._i18n;

    /**
     * Check if the given entry is stored in the file.
     * @param {Entry} entry Entry.
     * @returns {boolean} Result.
     */
    const isInFile = (entry) =>
      entry.arrayIndex !== undefined && entry.locales[defaultLocale]?.path === path;

    // Look up the entries by their position before the changes
    const previousEntries = new Map(
      allEntries.current.filter(isInFile).map((entry) => [entry.arrayIndex, entry]),
    );

    // The items are now what’s in the file, which the next change to it is applied to
    arrayFileItems.set(
      path,
      slots.map(({ item }) => item),
    );

    const fileSavingEntries = new Map(
      savingEntries.filter(isInFile).map((entry) => [entry.arrayIndex, entry]),
    );

    // A new entry has no position yet, so it’s matched up with the item added for it in order
    const newSavingEntries = savingEntries.filter(
      (entry) => entry.arrayIndex === undefined && entry.locales[defaultLocale]?.path === path,
    );

    let newItemCount = 0;

    slots.forEach(({ item, from }, index) => {
      const savingEntry =
        from === undefined ? newSavingEntries[newItemCount] : fileSavingEntries.get(from);

      const previousEntry = from === undefined ? undefined : previousEntries.get(from);

      if (from === undefined) {
        newItemCount += 1;
      }

      const entry = createArrayItemEntry({ collection, item, index, path, meta });

      if (!entry) {
        return;
      }

      entry.id = savingEntry?.id ?? previousEntry?.id ?? generateUUID();
      entries.push(entry);

      if (savingEntry) {
        savedEntries.set(savingEntry, entry);
      }
    });
  });

  return { entries, savedEntries };
};
