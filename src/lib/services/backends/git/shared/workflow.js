import { fetchAPI } from '$lib/services/backends/git/shared/api';
import { cmsConfig } from '$lib/services/config';

/**
 * Whether the `squash_merges` backend option is enabled, so a pull request of Editorial Workflow is
 * squash-merged when the entry is published.
 * @returns {boolean} Result.
 */
export const isSquashMergeEnabled = () => {
  const { backend } = cmsConfig.current ?? {};

  return backend && 'squash_merges' in backend ? !!backend.squash_merges : false;
};

/**
 * Delete a branch with the given REST API request. A branch that’s already gone, for example when
 * its pull request was merged, is fine, and any other failure is only reported in the console.
 * @param {object} args Arguments.
 * @param {string} args.branch Branch name.
 * @param {string} args.path REST API path to send the `DELETE` request to.
 * @param {number[]} args.goneStatuses HTTP status codes meaning the branch is already gone.
 */
export const deleteRemoteBranch = async ({ branch, path, goneStatuses }) => {
  try {
    await fetchAPI(path, { method: 'DELETE', responseType: 'text' });
  } catch (/** @type {any} */ ex) {
    // The branch is already gone, which is what was wanted
    if (goneStatuses.includes(ex.cause?.status)) {
      return;
    }

    // Leaving the branch behind is harmless, but it makes the next pull request for the same entry
    // start from an existing branch, so make the failure visible rather than swallowing it
    // eslint-disable-next-line no-console
    console.warn(`Failed to delete the ${branch} branch.`, ex);
  }
};
