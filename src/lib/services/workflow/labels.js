import { get } from 'svelte/store';

import { cmsConfig } from '$lib/services/config';
import {
  DEFAULT_CMS_LABEL_PREFIX,
  LEGACY_CMS_LABEL_PREFIXES,
  WORKFLOW_STATUSES,
} from '$lib/services/workflow/constants';

/**
 * @import { WorkflowStatus } from '$lib/types/private';
 */

/**
 * Get the pull request label prefix configured with the backend’s `cms_label_prefix` option. This
 * is the prefix used when writing labels.
 * @returns {string} Label prefix, e.g. `sveltia-cms/`.
 */
export const getLabelPrefix = () => {
  const { backend } = get(cmsConfig) ?? {};
  const prefix = backend && 'cms_label_prefix' in backend ? backend.cms_label_prefix : undefined;

  return prefix || DEFAULT_CMS_LABEL_PREFIX;
};

/**
 * Get all the pull request label prefixes recognized when reading labels: the configured prefix,
 * the Sveltia CMS default, and the Netlify/Decap CMS prefixes. This allows the CMS to pick up
 * unpublished entries created with a different prefix or a different CMS.
 * @returns {string[]} Label prefixes, in priority order.
 */
export const getKnownLabelPrefixes = () => [
  ...new Set([getLabelPrefix(), DEFAULT_CMS_LABEL_PREFIX, ...LEGACY_CMS_LABEL_PREFIXES]),
];

/**
 * Get the pull request label for the given Editorial Workflow status. Labels are always written
 * with the configured prefix, so a pull request created with another CMS is migrated to the
 * configured prefix once its status is updated.
 * @param {WorkflowStatus} status Status.
 * @returns {string} Label, e.g. `sveltia-cms/draft`.
 */
export const getStatusLabel = (status) => `${getLabelPrefix()}${status}`;

/**
 * Get all the pull request labels recognized as CMS-managed, including the legacy ones. These are
 * removed from a pull request before a new status label is applied.
 * @returns {string[]} Labels, e.g. `[sveltia-cms/draft, ...]`.
 */
export const getAllStatusLabels = () =>
  getKnownLabelPrefixes().flatMap((prefix) =>
    WORKFLOW_STATUSES.map((status) => `${prefix}${status}`),
  );

/**
 * Determine the Editorial Workflow status from the given pull request labels. Labels with a legacy
 * prefix are recognized as well, but the configured prefix takes precedence in the unlikely case
 * that a pull request carries labels with multiple prefixes.
 * @param {string[]} labels Label names on a pull request.
 * @returns {WorkflowStatus | undefined} Status, or `undefined` if the pull request is not managed
 * by the CMS.
 */
export const getStatusFromLabels = (labels) => {
  /** @type {WorkflowStatus | undefined} */
  let result = undefined;

  getKnownLabelPrefixes().some((prefix) => {
    result = WORKFLOW_STATUSES.find((status) => labels.includes(`${prefix}${status}`));

    return !!result;
  });

  return result;
};
