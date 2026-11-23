import { customPreviewStyleRegistry } from '$lib/services/api/registries';

/**
 * Get the URLs of the custom preview stylesheets applied to an entry.
 * @param {object} args Arguments.
 * @param {string} [args.collectionName] Collection name, or `_singletons` for a singleton file.
 * @param {string} [args.fileName] File name in a file/singleton collection.
 * @returns {string[]} Stylesheet URLs, in the order they were registered, without duplicates.
 */
export const getPreviewStyleURLs = ({ collectionName, fileName }) => [
  ...new Set(
    [...customPreviewStyleRegistry]
      .filter(
        ({ collection, file }) =>
          (collection === undefined || collection === collectionName) &&
          (file === undefined || file === fileName),
      )
      .map(({ url }) => url),
  ),
];
