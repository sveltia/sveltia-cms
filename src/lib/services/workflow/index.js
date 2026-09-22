import { backend } from '$lib/services/backends';
import { cmsConfig } from '$lib/services/config';
import { findEntryByPaths } from '$lib/services/contents';
import { createDerivedState, createRawState } from '$lib/services/utils/state.svelte';
import { isEntryBranch } from '$lib/services/workflow/branch';
import { getPublishMode, isWorkflowConfigured } from '$lib/services/workflow/config';
import { openAuthoring } from '$lib/services/workflow/open-authoring';

/**
 * @import { Entry, UnpublishedEntry } from '$lib/types/private';
 * @import { Collection } from '$lib/types/public';
 */

/**
 * Whether Editorial Workflow is enabled for any content. It requires both the `editorial_workflow`
 * publish mode — for the whole site or for at least one collection — and a backend service that
 * implements the feature. This decides whether the feature is set up at all: the pull requests are
 * listed and the Editorial Workflow page is offered. Whether a particular entry goes through the
 * workflow is up to {@link isWorkflowEnabled}, because a collection can opt in or out on its own.
 */
export const workflowEnabled = createDerivedState(
  () => isWorkflowConfigured(cmsConfig.current) && !!backend.current?.workflow,
);

/**
 * Check whether the entries in the given collection go through Editorial Workflow. The
 * collection-level `publish_mode` option overrides the site-level one. A contributor working on a
 * fork with Open Authoring can’t write to the configured repository, so their changes always go
 * through a pull request, whatever the collection says.
 * @param {Collection | undefined} collection Collection. `undefined` falls back to the site-level
 * publish mode.
 * @returns {boolean} `true` if a change to an entry in the collection is saved to a pull request
 * rather than committed to the configured branch.
 * @see https://github.com/decaporg/decap-cms/issues/1571
 */
export const isWorkflowEnabled = (collection) =>
  !!backend.current?.workflow &&
  (openAuthoring.current ||
    getPublishMode({ cmsConfig: cmsConfig.current, collection }) === 'editorial_workflow');

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
 * Workflow branches of the entries being published, which is to say whose pull request is being
 * merged. A merge can take minutes when the Git service waits for a pipeline, and the view that
 * started it is created afresh each time it opens, so the wait is recorded here rather than in that
 * view: any view can then show the entry as busy.
 * @type {{ current: string[] }}
 */
export const publishingBranches = createRawState([]);

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
 * Find the unpublished entry that corresponds to the given workflow branch.
 * @param {string} branch Branch name.
 * @returns {UnpublishedEntry | undefined} Unpublished entry.
 */
export const getUnpublishedEntryByBranch = (branch) =>
  unpublishedEntries.current.find(({ workflow }) => workflow.pullRequest.branch === branch);

/**
 * Find the unpublished entry that the given draft is editing. The draft holds the entry as it was
 * when the editor opened it, and the entry can change while the editor stays open — its status from
 * the status menu or the Editorial Workflow page, its head commit with each save — so the entry is
 * read from the store rather than from that snapshot. The branch the entry is already associated
 * with is preferred over the one derived from the slug: the branch keeps the slug the pull request
 * was opened with, so an entry whose slug has been edited since no longer matches it by slug.
 * @param {object} args Arguments. A draft can be passed as is.
 * @param {string} args.collectionName Collection name.
 * @param {string} [args.fileName] Collection file name, if the entry is a collection file.
 * @param {Entry} [args.originalEntry] Entry being edited, before the changes. `undefined` for a new
 * entry, which has no pull request yet.
 * @returns {UnpublishedEntry | undefined} Unpublished entry.
 */
export const getUnpublishedEntryByDraft = ({ collectionName, fileName, originalEntry }) => {
  if (!originalEntry) {
    return undefined;
  }

  const branch = /** @type {UnpublishedEntry} */ (originalEntry).workflow?.pullRequest?.branch;

  return (
    (branch ? getUnpublishedEntryByBranch(branch) : undefined) ??
    getUnpublishedEntryBySlug({ collectionName, slug: fileName ?? originalEntry.slug })
  );
};

/**
 * Check whether the changes made in the given draft go to a pull request rather than the configured
 * branch. That’s the case when the draft’s collection uses Editorial Workflow, but also when the
 * entry already has a pull request: a contributor working on a fork always opens one, whatever the
 * collection’s publish mode, and a maintainer editing that entry has to keep working in it — saving
 * the pull request’s unreviewed content straight to the configured branch would bypass the review
 * and leave the pull request open.
 * @param {object} args Arguments. A draft can be passed as is.
 * @param {Collection} [args.collection] Collection.
 * @param {string} args.collectionName Collection name.
 * @param {string} [args.fileName] Collection file name, if the entry is a collection file.
 * @param {Entry} [args.originalEntry] Entry being edited, before the changes.
 * @returns {boolean} `true` if the draft is saved through Editorial Workflow.
 */
export const isWorkflowDraft = ({ collection, collectionName, fileName, originalEntry }) =>
  isWorkflowEnabled(collection) ||
  !!getUnpublishedEntryByDraft({ collectionName, fileName, originalEntry });

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
 * Get the entry on the production branch that the given unpublished entry updates. Files are
 * matched by path, because an entry keeps its slug when updated.
 * @param {Entry} entry Entry, which is only looked up when it’s an unpublished one.
 * @returns {Entry | undefined} Published version, or `undefined` if the entry isn’t unpublished, or
 * is an entirely new one that has never been published.
 */
export const getPublishedVersion = (entry) => {
  const { workflow } = /** @type {UnpublishedEntry} */ (entry);

  if (!workflow) {
    return undefined;
  }

  const paths = new Set([
    ...Object.values(entry.locales).map(({ path }) => path),
    // The pull request may have renamed the entry, in which case the published version is still at
    // one of the previous paths
    ...(workflow.previousPaths ?? []),
  ]);

  // `allEntries` only holds published entries; an unpublished one lives in `unpublishedEntries`
  // until it’s merged
  return findEntryByPaths(paths);
};

/**
 * Check if the given unpublished entry updates an entry that already exists on the production
 * branch, rather than being an entirely new one. The result decides whether the pull request can be
 * discarded, leaving the published version behind, or the entry has to be deleted outright.
 * @param {UnpublishedEntry} entry Unpublished entry.
 * @returns {boolean} `true` if a published version of the entry exists.
 */
export const hasPublishedVersion = (entry) => {
  // A collection file is part of the collection definition, so it stays on the site whether or not
  // it has been written yet. Discarding the pull request is the only way to undo the changes
  if (entry.workflow.fileName) {
    return true;
  }

  return !!getPublishedVersion(entry);
};
