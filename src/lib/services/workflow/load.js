import { backend } from '$lib/services/backends';
import {
  unpublishedEntries,
  unpublishedEntriesLoaded,
  unpublishedEntriesLoading,
  workflowEnabled,
} from '$lib/services/workflow';
import { mergeWorkflowAssets } from '$lib/services/workflow/assets';
import { convertPullRequests } from '$lib/services/workflow/entries';

/**
 * @import { WorkflowPullRequest } from '$lib/types/private';
 */

/**
 * Start retrieving the backend’s open pull requests, if Editorial Workflow is enabled. Listing them
 * doesn’t depend on the published entries, so this is called before the files are fetched and the
 * request overlaps that work; {@link loadUnpublishedEntries} then picks the result up once the
 * entries are there to match the pull requests against.
 * @returns {Promise<WorkflowPullRequest[]> | undefined} Pull requests, or `undefined` if the
 * feature is not in use. A rejection is left for {@link loadUnpublishedEntries} to handle.
 */
export const startLoadingPullRequests = () => {
  const workflow = backend.current?.workflow;

  if (!workflowEnabled.current || !workflow) {
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

  try {
    const { entries, assets } = await convertPullRequests(await pullRequests);

    unpublishedEntries.current = entries;
    mergeWorkflowAssets(assets);
  } catch (/** @type {any} */ ex) {
    // eslint-disable-next-line no-console
    console.error(ex);
  } finally {
    unpublishedEntriesLoading.current = false;
    // Mark as loaded even on failure, so a deep link isn’t stuck on the loading state forever
    unpublishedEntriesLoaded.current = true;
  }
};
