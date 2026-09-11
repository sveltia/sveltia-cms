import { backend } from '$lib/services/backends';
import { cmsConfig } from '$lib/services/config';
import { allEntries } from '$lib/services/contents';
import { createDerivedState, createRawState } from '$lib/services/utils/state.svelte';
import { isEntryBranch } from '$lib/services/workflow/branch';

/**
 * @import { Entry, UnpublishedEntry } from '$lib/types/private';
 */

/**
 * Whether Editorial Workflow is enabled. It requires both the `editorial_workflow` publish mode in
 * the site configuration and a backend service that implements the feature.
 */
export const workflowEnabled = createDerivedState(
  () => cmsConfig.current?.publish_mode === 'editorial_workflow' && !!backend.current?.workflow,
);

/**
 * List of unpublished entries retrieved from the backend’s open pull requests.
 * @type {{ current: UnpublishedEntry[] }}
 */
export const unpublishedEntries = createRawState([]);

/**
 * Whether the unpublished entry list is being loaded or updated.
 */
export const unpublishedEntriesLoading = createRawState(false);

/**
 * Whether the unpublished entries have been loaded at least once, successfully or not.
 */
export const unpublishedEntriesLoaded = createRawState(false);

/**
 * Whether everything needed to resolve an entry is available. The unpublished entries are fetched
 * after the initial data load, so an entry opened with a deep link can’t be resolved until they
 * arrive: a draft for a new entry wouldn’t be found at all, and a draft updating a published entry
 * would fall back to the published version.
 */
export const workflowDataReady = createDerivedState(
  () => !workflowEnabled.current || unpublishedEntriesLoaded.current,
);

/**
 * Get the unpublished entries in the given collection.
 * @param {string | undefined} collectionName Collection name.
 * @returns {UnpublishedEntry[]} Unpublished entries.
 */
export const getUnpublishedEntriesByCollection = (collectionName) =>
  collectionName
    ? unpublishedEntries.current.filter(
        ({ workflow }) => workflow.collectionName === collectionName,
      )
    : [];

/**
 * Find the unpublished entry that matches the given collection name and entry sub path. This is
 * used to open the entry editor with the pull request’s version of the entry rather than the
 * published version.
 * @param {object} args Arguments.
 * @param {string} args.collectionName Collection name.
 * @param {string} args.subPath Entry sub path, or collection file name.
 * @returns {UnpublishedEntry | undefined} Unpublished entry.
 */
export const getUnpublishedEntry = ({ collectionName, subPath }) =>
  unpublishedEntries.current.find(
    (entry) =>
      entry.workflow.collectionName === collectionName &&
      // A collection file is addressed by its name, while its `subPath` is the whole file path
      (entry.workflow.fileName !== undefined
        ? entry.workflow.fileName === subPath
        : entry.subPath === subPath),
  );

/**
 * Find the unpublished entry whose workflow branch addresses the given entry. This is the entry the
 * branch was opened for, which stays the same after the slug has been edited, unlike the result of
 * {@link getUnpublishedEntry}.
 * @param {object} args Arguments.
 * @param {string} args.collectionName Collection name.
 * @param {string} args.slug Entry slug, or collection file name.
 * @returns {UnpublishedEntry | undefined} Unpublished entry.
 */
export const getUnpublishedEntryBySlug = ({ collectionName, slug }) =>
  unpublishedEntries.current.find(({ workflow }) =>
    isEntryBranch({ branch: workflow.pullRequest.branch, collectionName, slug }),
  );

/**
 * Check whether the given entry is awaiting removal from the site. Such an entry can’t be edited:
 * the only things left to do with it are carrying the deletion out or calling it off.
 * @param {Entry | undefined} entry Entry to check, published or not.
 * @returns {boolean} `true` if a pull request is pending that deletes the entry.
 */
export const isPendingDeletion = (entry) =>
  /** @type {UnpublishedEntry | undefined} */ (entry)?.workflow?.status === 'pending_deletion';

/**
 * Replace each published entry that has an open pull request with its unpublished version, so a
 * list shows the pending content rather than what’s currently live. Entries are matched by file
 * path, including the paths a pull request renamed them from, so that editing a slug doesn’t make
 * the entry appear twice.
 * @param {Entry[]} entries Published entries.
 * @param {UnpublishedEntry[]} drafts Unpublished entries to swap in.
 * @returns {Entry[]} Entries with the drafts swapped in. The array is returned as is when there’s
 * nothing to swap, so a consumer can compare it by identity.
 */
export const swapUnpublishedEntries = (entries, drafts) => {
  if (!drafts.length) {
    return entries;
  }

  /** @type {Map<string, Entry>} */
  const draftMap = new Map();

  drafts.forEach((entry) => {
    [
      ...Object.values(entry.locales).map(({ path }) => path),
      ...(entry.workflow.previousPaths ?? []),
    ].forEach((path) => draftMap.set(path, entry));
  });

  return entries.map(
    (entry) =>
      Object.values(entry.locales)
        .map(({ path }) => draftMap.get(path))
        .find(Boolean) ?? entry,
  );
};

/**
 * Get the full list of entries in a collection: the published ones, with any pending changes
 * swapped in, plus the unpublished entries that have never been published and are therefore missing
 * from {@link allEntries} altogether. Used where the two have to be counted or searched together,
 * unlike the entry list, which shows them as separate groups.
 * @param {Entry[]} entries Published entries.
 * @param {UnpublishedEntry[]} drafts Unpublished entries.
 * @returns {Entry[]} Merged entries. The given array is returned as is when there’s nothing to swap
 * or append.
 */
export const mergeUnpublishedEntries = (entries, drafts) => {
  const swapped = swapUnpublishedEntries(entries, drafts);
  const swappedIn = new Set(swapped);
  // Match by identity rather than by path, which a renamed entry would break
  const unpublished = drafts.filter((entry) => !swappedIn.has(entry));

  // Keep the array identity when there’s nothing to append, so consumers don’t recompute needlessly
  return unpublished.length ? [...swapped, ...unpublished] : swapped;
};

/**
 * Check if the given unpublished entry updates an entry that already exists on the production
 * branch, rather than being an entirely new one. Files are matched by path, because an entry keeps
 * its slug when updated. The result decides whether the pull request can be discarded, leaving the
 * published version behind, or the entry has to be deleted outright.
 * @param {UnpublishedEntry} entry Unpublished entry.
 * @returns {boolean} `true` if a published version of the entry exists.
 */
export const hasPublishedVersion = (entry) => {
  // A collection file is part of the collection definition, so it stays on the site whether or not
  // it has been written yet. Discarding the pull request is the only way to undo the changes
  if (entry.workflow.fileName) {
    return true;
  }

  const paths = new Set([
    ...Object.values(entry.locales).map(({ path }) => path),
    // The pull request may have renamed the entry, in which case the published version is still at
    // one of the previous paths
    ...(entry.workflow.previousPaths ?? []),
  ]);

  // `allEntries` only holds published entries; an unpublished one lives in `unpublishedEntries`
  // until it’s merged
  return allEntries.current.some((publishedEntry) =>
    Object.values(publishedEntry.locales).some(({ path }) => paths.has(path)),
  );
};
