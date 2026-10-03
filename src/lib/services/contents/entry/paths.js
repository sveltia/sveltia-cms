/**
 * @import { Entry, UnpublishedEntry } from '$lib/types/private';
 */

/**
 * List the distinct paths of the files an entry is made of. A single-file i18n entry lists the same
 * path under every locale.
 * @param {Entry | UnpublishedEntry} entry Entry.
 * @param {object} [options] Options.
 * @param {boolean} [options.includePrevious] Whether to also include the paths an unpublished entry
 * occupied before its pull request renamed it, which is where the published version still lives.
 * @returns {string[]} Paths.
 */
export const getEntryPaths = (entry, { includePrevious = false } = {}) => [
  ...new Set([
    ...Object.values(entry.locales).map(({ path }) => path),
    ...((includePrevious && /** @type {UnpublishedEntry} */ (entry).workflow?.previousPaths) || []),
  ]),
];
