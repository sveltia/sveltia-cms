/**
 * @import { Entry, UnpublishedEntry } from '$lib/types/private';
 */

/**
 * Check whether the given entry is an unpublished Editorial Workflow entry, which carries the pull
 * request holding it. This is a type guard, so the entry can be used as an unpublished one without
 * a cast once it has passed. The module has no imports, so even the lowest-level services can use
 * it without an import cycle.
 * @param {Entry | UnpublishedEntry | null | undefined} entry Entry.
 * @returns {entry is UnpublishedEntry} Result.
 */
export const isUnpublishedEntry = (entry) => !!entry && 'workflow' in entry && !!entry.workflow;
