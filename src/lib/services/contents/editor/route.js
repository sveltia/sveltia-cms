import { encodePathSegments } from '$lib/services/utils/url';

/**
 * Get the path of the Content Editor for an entry, encoded for the URL hash. A collection file is
 * addressed by its name, while an entry in a folder collection is addressed by its `subPath`, which
 * for a collection file would be the whole file path.
 * @param {string} collectionName Collection name, e.g. `posts`, or `_singletons`.
 * @param {string} name File name, or the entry’s `subPath`, e.g. `2024/hello-world`.
 * @returns {string} Path, e.g. `/collections/posts/entries/2024/hello-world`.
 */
export const getEntryEditorPath = (collectionName, name) =>
  encodePathSegments(`/collections/${collectionName}/entries/${name}`);
