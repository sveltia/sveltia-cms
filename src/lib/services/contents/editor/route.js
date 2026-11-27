import { isSearchResultsPath } from '$lib/services/search/navigation';
import { encodePathSegments } from '$lib/services/utils/url';

/**
 * @import { UnpublishedEntry } from '$lib/types/private';
 */

/**
 * Get the path of the Content Editor for an entry, encoded for the URL hash. A collection file is
 * addressed by its name, while an entry in a folder collection is addressed by its `subPath`, which
 * for a collection file would be the whole file path.
 * @param {string} collectionName Collection name, e.g. `posts`, or `_singletons`.
 * @param {string} name File name, or the entry’s `subPath`, e.g. `2024/hello-world`.
 * @param {object} [options] Options.
 * @param {number} [options.pullRequestNumber] Number of the pull request a contributor has opened
 * from their fork to open the entry from, rather than the published version or the maintainers’
 * own pull request.
 * @returns {string} Path, e.g. `/collections/posts/entries/2024/hello-world`, followed by
 * `?_pr={number}` with a pull request number.
 */
export const getEntryEditorPath = (collectionName, name, { pullRequestNumber } = {}) => {
  const path = encodePathSegments(`/collections/${collectionName}/entries/${name}`);

  return pullRequestNumber === undefined ? path : `${path}?_pr=${pullRequestNumber}`;
};

/**
 * Get the path of the Content Editor for an unpublished entry, as the Editorial Workflow board
 * opens it. An entry from a pull request a contributor has opened from their fork is opened with
 * the pull request named, as several pull requests can hold the same entry and the editor
 * otherwise opens the published version or the maintainers’ own pull request.
 * @param {UnpublishedEntry} entry Unpublished entry.
 * @returns {string} Path, e.g. `/collections/posts/entries/hello?_pr=7`.
 */
export const getUnpublishedEntryEditorPath = (entry) => {
  const { collectionName, fileName, pullRequest } = entry.workflow;

  // A collection file is addressed by its name, while its `subPath` is the whole file path
  return getEntryEditorPath(collectionName, fileName ?? entry.subPath, {
    pullRequestNumber: pullRequest.fork ? pullRequest.number : undefined,
  });
};

/**
 * Check whether the given URL path is the Content Editor of an existing or new entry.
 * @param {string} path URL path, e.g. `/collections/posts/entries/hello`.
 * @returns {boolean} Result.
 */
export const isEntryEditorPath = (path) => /^\/collections\/[^/]+\/(?:entries\/.|new$)/.test(path);

/**
 * Get a function that tells which previous pages the Content Editor returns to when it’s closed,
 * other than the path given by `getEntryEditorBackPath()`: the search results the entry was opened
 * from, and for a singleton, any page other than an editor. A singleton is opened from the sidebar
 * of whatever collection is shown, or from a link elsewhere, and has no entry list of its own
 * unless singletons are all there is, so the fallback path would land on the first collection.
 * Another editor is left out, as going back to the entry a duplicate was made from would be wrong.
 * @param {string | undefined} collectionName Name of the entry’s collection.
 * @returns {(path: string) => boolean} Function that takes the previous page’s path.
 */
export const getEntryEditorReturnTo = (collectionName) => (path) =>
  isSearchResultsPath(path) || (collectionName === '_singletons' && !isEntryEditorPath(path));
