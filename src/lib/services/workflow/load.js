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
 * Retrieve the unpublished entries from the backend’s open pull requests and update the
 * {@link unpublishedEntries} store. Any error is logged and swallowed, because a failure here
 * should not prevent the user from working with published content.
 * @returns {Promise<void>}
 */
export const loadUnpublishedEntries = async () => {
  const workflow = backend.current?.workflow;

  if (!workflowEnabled.current || !workflow) {
    return;
  }

  unpublishedEntriesLoading.current = true;

  try {
    const { entries, assets } = await convertPullRequests(await workflow.fetchPullRequests());

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
