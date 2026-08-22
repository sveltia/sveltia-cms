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
 * The review stages an unpublished entry moves through, ordered from the earliest to the latest.
 * These are the board columns and the options in the editor’s status menu.
 * @type {WorkflowStatus[]}
 */
export const WORKFLOW_STAGES = ['draft', 'pending_review', 'pending_publish'];

/**
 * The review stages available to an Open Authoring contributor. They can’t merge a pull request on
 * the configured repository, so there’s no point in marking an entry ready to be published: the
 * last thing they can do is hand it over for review.
 * @type {WorkflowStatus[]}
 * @see https://sveltiacms.app/en/docs/workflows/open
 */
export const OPEN_AUTHORING_STAGES = ['draft', 'pending_review'];

/**
 * All the Editorial Workflow statuses, including the one for a pending removal. A removal has no
 * stages to move through — it’s either carried out or called off — so it’s absent from
 * {@link WORKFLOW_STAGES}, which drives the board columns and the editor’s status menu.
 * @type {WorkflowStatus[]}
 */
export const WORKFLOW_STATUSES = [...WORKFLOW_STAGES, 'pending_deletion'];

/**
 * Map of Editorial Workflow statuses to i18n string keys used for UI labels.
 * @type {Record<WorkflowStatus, string>}
 */
export const WORKFLOW_STATUS_LABELS = {
  draft: 'status.draft',
  pending_review: 'status.in_review',
  pending_publish: 'status.ready',
  pending_deletion: 'status.pending_deletion',
};
