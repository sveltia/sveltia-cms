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
