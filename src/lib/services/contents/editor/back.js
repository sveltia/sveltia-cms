import { goBack } from '$lib/services/app/navigation';
import { getCollection } from '$lib/services/contents/collection';
import { hasNestedEntries, nestedFilterPath } from '$lib/services/contents/collection/nested';
import { getEntryEditorBackTarget } from '$lib/services/contents/editor/route';

/**
 * Close the Content Editor by going back to the previous page, or the page given by
 * `getEntryEditorBackTarget()`: the folder being browsed for a collection with nested entries, so
 * the user lands where they opened the entry from.
 * @param {string | undefined} collectionName Name of the entry’s collection.
 */
export const goBackFromEntryEditor = (collectionName) => {
  const collection = collectionName ? getCollection(collectionName) : undefined;
  const dirPath = collection && hasNestedEntries(collection) ? nestedFilterPath.current : '';
  const { path, returnTo } = getEntryEditorBackTarget({ collectionName, dirPath });

  goBack(path, { returnTo });
};
