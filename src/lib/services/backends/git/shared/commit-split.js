/**
 * @import { FileChange } from '$lib/types/private';
 */

/**
 * HTTP statuses the Git hosting service, or a proxy in front of it, answers a request with when it
 * has taken too long or is too large: 408 Request Timeout, 413 Content Too Large, 499 Client Closed
 * Request, 502 Bad Gateway and 504 Gateway Timeout.
 */
const UPLOAD_FAILURE_STATUSES = [408, 413, 499, 502, 504];

/**
 * A file addition in a commit, along with the change it comes from.
 * @typedef {object} FileAddition
 * @property {number} index Index of the addition in the changeset. The GitHub backend uses it to
 * alias the file in the query for its new SHA; the GitLab backend to find the change it comes from.
 * @property {string} path File path.
 * @property {string} contents File contents, Base64-encoded unless the backend sends text as is.
 * @property {FileChange['data']} data Original file data.
 */

/**
 * Sort file additions in the order they are committed. Assets come first and text files like
 * entries last, so an entry never lands in the repository before the files it refers to. A file
 * that is deleted and added again at the same path, which is resolved within a single commit, is
 * set aside, as it has to go into the last commit along with the deletions, however large it is;
 * otherwise the deletion would remove it again.
 * @param {FileAddition[]} additions File additions.
 * @param {Set<string>} [deletedPaths] Paths of the files to be deleted.
 * @returns {{ queue: FileAddition[], addedAgain: FileAddition[] }} Additions to be
 * committed in order, and those that go into the last commit.
 */
export const sortAdditions = (additions, deletedPaths = new Set()) => ({
  queue: additions
    .filter(({ path }) => !deletedPaths.has(path))
    .toSorted((a, b) => Number(typeof a.data === 'string') - Number(typeof b.data === 'string')),
  addedAgain: additions.filter(({ path }) => deletedPaths.has(path)),
});

/**
 * Take the file additions for the next commit from the start of the queue, as many as fit in the
 * given payload size. A single file over the size is taken on its own.
 * @param {FileAddition[]} queue Additions yet to be committed. Modified in place.
 * @param {number} maxSize Maximum size of the encoded file contents.
 * @returns {FileAddition[]} Additions taken.
 */
export const takeAdditions = (queue, maxSize) => {
  /** @type {FileAddition[]} */
  const group = [];
  let size = 0;

  while (queue.length && (!group.length || size + queue[0].contents.length <= maxSize)) {
    const addition = /** @type {FileAddition} */ (queue.shift());

    group.push(addition);
    size += addition.contents.length;
  }

  return group;
};

/**
 * Get the payload size of the given additions.
 * @param {FileAddition[]} additions File additions.
 * @returns {number} Total size of their encoded contents.
 */
export const getPayloadSize = (additions) =>
  additions.reduce((total, { contents }) => total + contents.length, 0);

/**
 * Estimate how many commits are left to make for the given additions at the given commit size. The
 * last commit is always made, even when it only has the entry files or deletions, so there is at
 * least one.
 * @param {FileAddition[]} queue Additions yet to be committed.
 * @param {number} payloadSize Payload size of each commit.
 * @returns {number} Number of commits.
 */
export const estimateRemainingCommits = (queue, payloadSize) =>
  Math.max(1, Math.ceil(getPayloadSize(queue) / payloadSize));

/**
 * Check if a commit request has failed because it took too long or was too large, which the
 * browser typically reports as a network error, as the answer of the service, or the proxy in front
 * of it, comes without CORS headers.
 * @param {any} ex Error thrown.
 * @returns {boolean} Result.
 */
export const isUploadFailure = (ex) =>
  ex?.message === 'Failed to send the request' ||
  UPLOAD_FAILURE_STATUSES.includes(ex?.cause?.status);
