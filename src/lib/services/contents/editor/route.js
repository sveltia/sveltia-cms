import { SINGLETONS_COLLECTION_NAME } from '$lib/services/contents/collection/constants';
import { isSearchResultsPath } from '$lib/services/search/navigation';
import { encodeFilePath } from '$lib/services/utils/file';
import { encodePathSegments } from '$lib/services/utils/url';

/**
 * @import { UnpublishedEntry } from '$lib/types/private';
 */

/**
 * Regular expression matching the routes of the Content Library page.
 */
export const CONTENTS_ROUTE_REGEX =
  /^\/collections(?:\/(?<_collectionName>[^/]+)(?:\/(?<routeType>new|entries|filter))?(?:\/(?<subPath>.+?))?)?$/;

/**
 * Get the path of a collection’s entry list, or of a folder in a collection with nested entries,
 * encoded for the URL hash.
 * @param {string | undefined} collectionName Collection name, e.g. `posts`, or `_singletons`.
 * @param {object} [options] Options.
 * @param {string} [options.dirPath] Folder being browsed in a collection with nested entries.
 * @returns {string} Path, e.g. `/collections/posts` or `/collections/docs/filter/guides`.
 */
export const getCollectionPath = (collectionName, { dirPath = '' } = {}) =>
  encodePathSegments(
    dirPath ? `/collections/${collectionName}/filter/${dirPath}` : `/collections/${collectionName}`,
  );

/**
 * Get the path of the Content Editor for a new entry, encoded for the URL hash.
 * @param {string} collectionName Collection name, e.g. `posts`.
 * @param {object} [options] Options.
 * @param {string} [options.dirPath] Folder to create the entry in, in a collection with nested
 * entries, which the path editor picks up from the `path` param, as Decap CMS passes it.
 * @returns {string} Path, e.g. `/collections/posts/new`, followed by `?path={folder}` with a
 * folder.
 */
export const getNewEntryPath = (collectionName, { dirPath = '' } = {}) => {
  const path = encodePathSegments(`/collections/${collectionName}/new`);

  return dirPath ? `${path}?path=${encodeFilePath(dirPath)}` : path;
};

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
 * What a route of the Content Library page shows.
 * @typedef {object} ContentsRoute
 * @property {'index' | 'list' | 'folder' | 'new' | 'entry' | 'invalid'} view The collection list,
 * a collection’s entry list, a folder of a collection with nested entries, the editor of a new or
 * existing entry, or `invalid` for any other path under a collection, e.g.
 * `/collections/posts/foo` or `/collections/posts/new/foo`.
 * @property {string} [collectionName] Collection name, unless it’s the collection list.
 * @property {string} [routeType] Route type: `new`, `entries` or `filter`, if any.
 * @property {string} [subPath] Path following the route type: the folder, or the entry’s sub path
 * or collection file name.
 */

/**
 * Tell what a route of the Content Library page shows from its parts.
 * @param {Omit<ContentsRoute, 'view'>} route Route parts.
 * @returns {ContentsRoute['view']} View.
 */
const getContentsView = ({ collectionName, routeType, subPath }) => {
  if (!collectionName) {
    return 'index';
  }

  if (routeType === 'filter') {
    return 'folder';
  }

  if (routeType === 'new') {
    return subPath ? 'invalid' : 'new';
  }

  if (routeType === 'entries') {
    return subPath ? 'entry' : 'invalid';
  }

  // A collection route takes no path of its own
  return subPath ? 'invalid' : 'list';
};

/**
 * Parse a URL path of the Content Library page.
 * @param {string} path URL path, e.g. `/collections/posts/entries/hello`.
 * @returns {ContentsRoute | undefined} Route, or `undefined` if the path belongs to another page.
 */
export const parseContentsPath = (path) => {
  const groups = path.match(CONTENTS_ROUTE_REGEX)?.groups;

  if (!groups) {
    return undefined;
  }

  const { _collectionName: collectionName, routeType, subPath } = groups;
  const view = getContentsView({ collectionName, routeType, subPath });

  return { view, collectionName, routeType, subPath };
};

/**
 * Check whether the given URL path is the Content Editor of an existing or new entry.
 * @param {string} path URL path, e.g. `/collections/posts/entries/hello`.
 * @returns {boolean} Result.
 */
export const isEntryEditorPath = (path) => {
  const view = parseContentsPath(path)?.view;

  return view === 'new' || view === 'entry';
};

/**
 * Check whether the given URL path is a page other than the Content Editor, including the search
 * results.
 * @param {string} path URL path.
 * @returns {boolean} Result.
 */
const isOutsideEntryEditor = (path) => !isEntryEditorPath(path);

/**
 * Get where the Content Editor goes when it’s closed. The previous page is returned to if it’s at
 * the fallback path, or if it’s the search results the entry was opened from. Otherwise the editor
 * goes to the fallback path: the collection’s entry list, or the folder being browsed for a
 * collection with nested entries, so the user lands where they opened the entry from.
 *
 * A singleton has no entry list of its own unless singletons are all there is, so its fallback path
 * is the collection list, which redirects to the first collection otherwise. As a singleton is
 * opened from the sidebar of whatever collection is shown, or from a link elsewhere, any previous
 * page is returned to instead, except another editor: going back to the entry a duplicate was made
 * from, for example, would be wrong.
 * @param {object} args Arguments.
 * @param {string | undefined} args.collectionName Name of the entry’s collection.
 * @param {string} [args.dirPath] Folder being browsed in a collection with nested entries, if any.
 * @returns {{ path: string, returnTo: (path: string) => boolean }} Fallback route path, and a
 * function that tells which other previous pages to return to, taking the previous page’s path.
 */
export const getEntryEditorBackTarget = ({ collectionName, dirPath = '' }) => {
  if (collectionName === SINGLETONS_COLLECTION_NAME) {
    return {
      path: '/collections',
      returnTo: isOutsideEntryEditor,
    };
  }

  return { path: getCollectionPath(collectionName, { dirPath }), returnTo: isSearchResultsPath };
};
