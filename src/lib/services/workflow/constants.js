/**
 * @import { WorkflowStatus } from '$lib/types/private';
 */

/**
 * Default pull request label prefix, which can be overridden with the backend’s `cms_label_prefix`
 * option. The prefix is used to distinguish CMS-managed pull requests from others.
 * @see https://decapcms.org/docs/editorial-workflows/
 */
export const DEFAULT_CMS_LABEL_PREFIX = 'sveltia-cms/';

/**
 * Pull request label prefixes used by Netlify CMS and Decap CMS. They are recognized when reading
 * labels, so unpublished entries created with those CMSes remain editable after migrating to
 * Sveltia CMS. New labels are always written with the configured prefix.
 */
export const LEGACY_CMS_LABEL_PREFIXES = ['netlify-cms/', 'decap-cms/'];

/**
 * All the possible Editorial Workflow statuses, ordered from the earliest to the latest stage.
 * @type {WorkflowStatus[]}
 */
export const WORKFLOW_STATUSES = ['draft', 'pending_review', 'pending_publish'];

/**
 * Map of Editorial Workflow statuses to i18n string keys used for UI labels.
 * @type {Record<WorkflowStatus, string>}
 */
export const WORKFLOW_STATUS_LABELS = {
  draft: 'status.draft',
  pending_review: 'status.in_review',
  pending_publish: 'status.ready',
};
