import equal from 'fast-deep-equal';

import { backend } from '$lib/services/backends';
import { runConcurrently } from '$lib/services/backends/git/shared/concurrency';
import { createStaleCheck, repositoryHead } from '$lib/services/backends/git/shared/head';
import { checkForRemoteChanges } from '$lib/services/backends/refresh';
import { cmsConfig } from '$lib/services/config';
import { getEntryPaths } from '$lib/services/contents/entry/paths';
import {
  publishingBranches,
  unpublishedEntries,
  unpublishedEntriesLoaded,
  unpublishedEntriesLoading,
  workflowEnabled,
} from '$lib/services/workflow';
import { mergeWorkflowAssets, removeWorkflowAssets } from '$lib/services/workflow/assets';
import { convertPullRequests } from '$lib/services/workflow/entries';
import { openAuthoringInitialized } from '$lib/services/workflow/open-authoring';

/**
 * @import {
 * BackendService,
 * CompanionEntry,
 * UnpublishedEntry,
 * WorkflowPullRequest,
 * } from '$lib/types/private';
 */

/**
 * How long the unpublished entries are taken to be fresh, in milliseconds, unless the configured
 * branch has moved in the meantime. Listing the pull requests costs a couple of requests rather
 * than the one small request a branch check does, so they’re not listed on every check: a merge
 * made on the Git service moves the branch, which prompts a reload on the next check anyway, and
 * this interval catches the rest — a pull request opened, closed or relabelled by someone else.
 */
export const WORKFLOW_CHECK_INTERVAL = 5 * 60 * 1000;

/**
 * Shortest gap between two reloads prompted by the user coming back to the tab, in milliseconds.
 * The user may well have been on the Git service, reviewing or merging, so the board is brought up
 * to date then rather than on the next scheduled check, but switching tabs back and forth shouldn’t
 * send a burst of requests.
 */
export const WORKFLOW_RETURN_GAP = 30 * 1000;

/**
 * When the unpublished entries were last loaded, as a Unix timestamp in milliseconds, and the head
 * of the configured branch at the time.
 */
let lastLoad = { time: 0, head: '' };
/**
 * The reload in flight, if any. A second caller gets the same promise rather than a second round of
 * requests.
 * @type {Promise<boolean> | undefined}
 */
let pendingReload;

/**
 * Remember that the unpublished entries have just been loaded.
 * @param {string} head Head of the configured branch the load started at.
 */
const recordLoad = (head) => {
  lastLoad = { time: Date.now(), head };
};

/**
 * Forget when the unpublished entries were loaded, and any reload in flight. Used in tests.
 */
export const _resetWorkflowLoadState = () => {
  lastLoad = { time: 0, head: '' };
  pendingReload = undefined;
};

/**
 * Check whether the pull requests can be listed yet. With Open Authoring, whether they live in the
 * signed-in user’s fork or, for a maintainer, in the configured repository is only found out while
 * the files are being fetched; listing them before that would look in the wrong repository.
 * @returns {boolean} Result.
 */
const isWorkflowReady = () => {
  const { backend: backendConfig } = cmsConfig.current ?? {};

  const openAuthoringConfigured =
    !!backendConfig && 'open_authoring' in backendConfig && !!backendConfig.open_authoring;

  return !openAuthoringConfigured || openAuthoringInitialized.current;
};

/**
 * Get the backend’s workflow service, if Editorial Workflow is enabled and the pull requests can be
 * listed yet.
 * @returns {NonNullable<BackendService['workflow']> | undefined} Workflow service, or `undefined`
 * if it’s not in use or not ready.
 */
const getReadyWorkflow = () => {
  const workflow = backend.current?.workflow;

  return workflowEnabled.current && workflow && isWorkflowReady() ? workflow : undefined;
};

/**
 * Start retrieving the backend’s open pull requests, if Editorial Workflow is enabled. Listing them
 * doesn’t depend on the published entries, so this is called before the files are fetched and the
 * request overlaps that work; {@link loadUnpublishedEntries} then picks the result up once the
 * entries are there to match the pull requests against.
 * @returns {Promise<WorkflowPullRequest[]> | undefined} Pull requests, or `undefined` if the
 * feature is not in use or the listing can’t start yet, in which case
 * {@link loadUnpublishedEntries} requests them itself once the files are fetched. A rejection is
 * left for {@link loadUnpublishedEntries} to handle.
 */
export const startLoadingPullRequests = () => {
  const workflow = getReadyWorkflow();

  if (!workflow) {
    return undefined;
  }

  unpublishedEntriesLoading.current = true;

  const promise = workflow.fetchPullRequests();

  promise.catch(() => {
    // Handled in `loadUnpublishedEntries()`
  });

  return promise;
};

/**
 * Retrieve the unpublished entries from the backend’s open pull requests and update the
 * {@link unpublishedEntries} store. Any error is logged and swallowed, because a failure here
 * should not prevent the user from working with published content.
 * @param {Promise<WorkflowPullRequest[]> | undefined} [pullRequests] Pull requests being
 * retrieved, from {@link startLoadingPullRequests}. Requested here if omitted.
 * @returns {Promise<void>}
 */
export const loadUnpublishedEntries = async (pullRequests = startLoadingPullRequests()) => {
  if (!pullRequests) {
    return;
  }

  const head = repositoryHead.current;
  // The site data may be discarded while the requests are on their way, e.g. by signing out; the
  // results then belong to the previous session and must not be written back, nor mark the next
  // session’s entries as loaded
  const isStale = createStaleCheck();

  try {
    const { entries, assets } = await convertPullRequests(await pullRequests);

    if (!isStale()) {
      unpublishedEntries.current = entries;
      mergeWorkflowAssets(assets);
      recordLoad(head);
    }
  } catch (/** @type {any} */ ex) {
    // eslint-disable-next-line no-console
    console.error(ex);
  } finally {
    if (!isStale()) {
      unpublishedEntriesLoading.current = false;
      // Mark as loaded even on failure, so a deep link isn’t stuck on the loading state forever
      unpublishedEntriesLoaded.current = true;
    }
  }
};

/**
 * Group the given unpublished entries by workflow branch. A branch usually holds a single entry,
 * but a pull request can technically contain more.
 * @param {UnpublishedEntry[]} entries Unpublished entries.
 * @returns {Map<string, UnpublishedEntry[]>} Entries keyed by branch, in the order given.
 */
const groupByBranch = (entries) =>
  Map.groupBy(entries, ({ workflow }) => workflow.pullRequest.branch);

/**
 * Check whether two lists hold the same entry objects in the same order.
 * @param {UnpublishedEntry[] | undefined} a List.
 * @param {UnpublishedEntry[] | undefined} b Another list.
 * @returns {boolean} Result. Two missing lists are the same.
 */
const isSameList = (a = [], b = []) =>
  a.length === b.length && a.every((entry, index) => entry === b[index]);

/**
 * Give the new entries read afresh from a pull request the IDs of the ones already in the store,
 * matched by their first file, as they’re parsed with new IDs each time. Without that, the entry
 * they ride along with would never be the same as before.
 * @param {CompanionEntry[] | undefined} fetched Entries read from the pull request.
 * @param {CompanionEntry[] | undefined} existing Entries in the store.
 * @returns {CompanionEntry[] | undefined} Entries.
 */
const carryOverCompanions = (fetched, existing = []) => {
  const ids = new Map(existing.map(({ entry }) => [getEntryPaths(entry)[0], entry.id]));

  return fetched?.map((companion) => {
    const id = ids.get(getEntryPaths(companion.entry)[0]);

    return id ? { ...companion, entry: { ...companion.entry, id } } : companion;
  });
};

/**
 * Bring the entries read afresh from a pull request in line with the ones already in the store, so
 * the board and the editor don’t lose track of them: each keeps the ID of the entry it replaces,
 * along with those of the new entries riding along with it, and an entry that hasn’t changed at all
 * stays the same object.
 * @param {UnpublishedEntry[]} fetched Entries read from the pull request.
 * @param {UnpublishedEntry[]} existing Entries of the same branch in the store.
 * @returns {UnpublishedEntry[]} Entries to store.
 */
const carryOverEntries = (fetched, existing) => {
  const entries = fetched.map((entry, index) => {
    const previous = existing[index];

    if (!previous) {
      return entry;
    }

    const { workflow } = entry;

    const carried = {
      ...entry,
      id: previous.id,
      ...(workflow.companions
        ? {
            workflow: {
              ...workflow,
              companions: carryOverCompanions(workflow.companions, previous.workflow.companions),
            },
          }
        : {}),
    };

    return equal(carried, previous) ? previous : carried;
  });

  return isSameList(entries, existing) ? existing : entries;
};

/**
 * Get the head commit the given entries of a branch were read at.
 * @param {UnpublishedEntry[]} [entries] Entries of the branch.
 * @returns {string | undefined} Git object ID, if any.
 */
const getHeadSHA = (entries) => entries?.[0]?.workflow.pullRequest.headSHA;

/**
 * Find the branches whose entries in the store are more recent than what the listing reports. A Git
 * service can report a pull request as of an earlier commit for a moment after a push: Gitea and
 * Forgejo work out the changed files from a reference they move to the branch head in the
 * background, and the head GitHub reports for a pull request may trail its branch as well. Taking
 * that snapshot would roll back the entry just saved in this tab, and the next save, made on top of
 * the older head, would be refused as a conflict. So where the heads differ, the branch is read,
 * which is a small request: if it still points at the head in the store, nothing has been committed
 * since, and the listing is the one behind. Anything else it reports for the pull request, such as
 * a label changed on the Git service, comes in with the next reload. A snapshot that yields no
 * entry at all, with none of the files listed yet, is behind just the same. A branch that can’t be
 * read leaves the listing to be taken as it is.
 * @param {NonNullable<BackendService['workflow']>} workflow Workflow service.
 * @param {Map<string, UnpublishedEntry[]>} stored Entries in the store, keyed by branch.
 * @param {Map<string, UnpublishedEntry[]>} fetched Entries read from the pull requests, keyed by
 * branch.
 * @param {Set<string>} openBranches Branches of the pull requests listed.
 * @returns {Promise<Set<string>>} Branches whose entries in the store are to be kept.
 */
const findUpToDateBranches = async (workflow, stored, fetched, openBranches) => {
  /** @type {Set<string>} */
  const branches = new Set();

  const candidates = [...stored.keys()].filter((branch) => {
    const head = getHeadSHA(stored.get(branch));

    return openBranches.has(branch) && !!head && head !== getHeadSHA(fetched.get(branch));
  });

  await runConcurrently(candidates, async (branch) => {
    try {
      if ((await workflow.fetchBranchHead(branch)) === getHeadSHA(stored.get(branch))) {
        branches.add(branch);
      }
    } catch (ex) {
      // eslint-disable-next-line no-console
      console.error('Failed to check the workflow branch for changes.', ex);
    }
  });

  return branches;
};

/**
 * Read the open pull requests again and bring the {@link unpublishedEntries} store up to date with
 * them. See {@link reloadUnpublishedEntries}.
 * @param {NonNullable<BackendService['workflow']>} workflow Workflow service.
 * @returns {Promise<boolean>} Whether anything has changed.
 */
const reload = async (workflow) => {
  // The site data may be discarded while the requests are on their way, e.g. by signing out; the
  // results then belong to the previous session and must not be written back
  const isStale = createStaleCheck();
  const head = repositoryHead.current;
  // The store as it stands before the request, to tell the changes made in this tab in the meantime
  // — a save, a status change, a publish — from the ones the request reports
  const before = groupByBranch(unpublishedEntries.current);
  const pullRequests = await workflow.fetchPullRequests();

  if (isStale()) {
    return false;
  }

  const openBranches = new Set(pullRequests.map(({ branch }) => branch));

  // A pull request that has gone has most likely been merged on the Git service. The published
  // entry is brought in first, so the entry doesn’t drop out of the entry list until the next
  // check for remote changes. A pull request closed without merging moves nothing, so it costs one
  // small request
  if ([...before.keys()].some((branch) => !openBranches.has(branch))) {
    try {
      await checkForRemoteChanges();
    } catch (ex) {
      // eslint-disable-next-line no-console
      console.error('Failed to check the repository for changes.', ex);
    }

    if (isStale()) {
      return false;
    }
  }

  const { entries, assets } = await convertPullRequests(pullRequests);

  if (isStale()) {
    return false;
  }

  const fetched = groupByBranch(entries);
  const upToDate = await findUpToDateBranches(workflow, before, fetched, openBranches);

  if (isStale()) {
    return false;
  }

  const current = groupByBranch(unpublishedEntries.current);
  const publishing = new Set(publishingBranches.current);
  /** @type {Set<string>} */
  const changedBranches = new Set();

  /**
   * Get the entries to store for the given branch.
   * @param {string} branch Workflow branch.
   * @returns {UnpublishedEntry[]} Entries; empty if the pull request has gone.
   */
  const resolve = (branch) => {
    const existing = current.get(branch) ?? [];

    // A change made in this tab while the request was on its way is more recent than what the
    // request reports, and so is an entry being published, which leaves the store once merged, and
    // one whose branch hasn’t moved since it was stored
    if (
      publishing.has(branch) ||
      upToDate.has(branch) ||
      !isSameList(existing, before.get(branch))
    ) {
      return existing;
    }

    const resolved = carryOverEntries(fetched.get(branch) ?? [], existing);

    if (resolved !== existing) {
      changedBranches.add(branch);
    }

    return resolved;
  };

  // The entries already listed keep their places, so a card doesn’t jump around on the board, and
  // the new ones come after them in the order the backend lists them
  const branches = new Set([...current.keys(), ...fetched.keys()]);
  const resolved = [...branches].flatMap(resolve);

  recordLoad(head);

  if (!changedBranches.size) {
    return false;
  }

  unpublishedEntries.current = resolved;

  // The assets committed to a branch that has changed or gone are replaced with the ones it holds
  // now, if any, restoring the published versions they were shadowing
  changedBranches.forEach(removeWorkflowAssets);
  mergeWorkflowAssets(
    assets.filter(({ workflow: assetWorkflow }) =>
      changedBranches.has(/** @type {string} */ (assetWorkflow?.branch)),
    ),
  );

  return true;
};

/**
 * Read the backend’s open pull requests again and bring the {@link unpublishedEntries} store up to
 * date with them, so the Editorial Workflow board and the entry lists notice the pull requests
 * opened, updated, merged or closed by anyone else — a colleague, a bot, the Git service itself —
 * since they were loaded. Unlike {@link loadUnpublishedEntries}, the result is merged into the
 * store rather than replacing it: an unchanged entry stays the same object, a changed one keeps its
 * ID, and anything changed in this tab while the request was on its way is left as it is.
 *
 * Nothing is reloaded before the entries have been loaded once, or when Editorial Workflow isn’t
 * in use.
 * @param {object} [options] Options.
 * @param {boolean} [options.fresh] Make sure the pull requests are listed after the call, rather
 * than joining a reload already in flight, which may have listed them before a change the caller
 * knows about.
 * @returns {Promise<boolean>} Whether anything has changed.
 * @throws {Error} When the backend couldn’t be reached.
 */
export const reloadUnpublishedEntries = async ({ fresh = false } = {}) => {
  const workflow = getReadyWorkflow();

  if (!workflow || !unpublishedEntriesLoaded.current) {
    return false;
  }

  if (fresh && pendingReload) {
    // Waiting is what matters; the result, or a failure, is the other caller’s
    await pendingReload.catch(() => undefined);
  }

  if (!pendingReload) {
    pendingReload = reload(workflow).finally(() => {
      pendingReload = undefined;
    });
  }

  return pendingReload;
};

/**
 * Reload the unpublished entries if they may be out of date: the configured branch has moved since
 * they were loaded, which is what a pull request merged on the Git service does, or they were
 * loaded longer ago than the given time.
 * @param {object} [options] Options.
 * @param {number} [options.maxAge] Reload if the entries were loaded more than this many
 * milliseconds ago.
 * @returns {Promise<boolean>} Whether anything has changed.
 * @throws {Error} When the backend couldn’t be reached.
 */
export const checkForWorkflowChanges = async ({ maxAge = WORKFLOW_CHECK_INTERVAL } = {}) => {
  if (
    !pendingReload &&
    repositoryHead.current === lastLoad.head &&
    Date.now() - lastLoad.time < maxAge
  ) {
    return false;
  }

  return reloadUnpublishedEntries();
};
