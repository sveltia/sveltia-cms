import { WORKFLOW_STAGES, WORKFLOW_STATUS_LABELS } from '$lib/services/workflow/constants';

/**
 * @import { UnpublishedEntry, WorkflowStatus } from '$lib/types/private';
 */

/**
 * Column headings of the Editorial Workflow board. The `drafts` heading is plural, unlike the
 * singular status label used in the entry editor’s status button.
 * @type {Record<WorkflowStatus, string>}
 */
export const COLUMN_LABELS = { ...WORKFLOW_STATUS_LABELS, draft: 'status.drafts' };

/**
 * I18n string keys of the toast notification reporting an Editorial Workflow action.
 * @typedef {object} ToastMessages
 * @property {string} info Key shown while the action is in progress.
 * @property {string} success Key shown once the action has completed.
 * @property {string} error Key shown when the action has failed.
 */

/** @type {ToastMessages} */
export const STATUS_UPDATE_MESSAGES = {
  info: 'workflow.updating_status',
  success: 'workflow.status_updated',
  error: 'workflow.status_change_failed',
};

/** @type {ToastMessages} */
const DELETION_MESSAGES = {
  info: 'workflow.deleting_entry',
  success: 'workflow.entry_deleted',
  error: 'deleting_entry_failed',
};

/** @type {ToastMessages} */
const CANCELLATION_MESSAGES = {
  info: 'workflow.cancelling_deletion',
  success: 'workflow.deletion_cancelled',
  error: 'workflow.cancelling_deletion_failed',
};

/** @type {ToastMessages} */
const PUBLISHING_MESSAGES = {
  info: 'workflow.publishing_entry',
  success: 'workflow.entry_published',
  error: 'workflow.publishing_entry_failed',
};

/**
 * Get the toast messages for discarding an unpublished entry. Discarding a pending deletion calls
 * the deletion off.
 * @param {boolean} pendingDeletion Whether the entry is a pending deletion.
 * @returns {ToastMessages} Messages.
 */
export const getDiscardMessages = (pendingDeletion) =>
  pendingDeletion ? CANCELLATION_MESSAGES : DELETION_MESSAGES;

/**
 * Get the toast messages for publishing an unpublished entry. Publishing a pending deletion carries
 * the deletion out.
 * @param {boolean} pendingDeletion Whether the entry is a pending deletion.
 * @returns {ToastMessages} Messages.
 */
export const getPublishMessages = (pendingDeletion) =>
  pendingDeletion ? DELETION_MESSAGES : PUBLISHING_MESSAGES;

/**
 * Sort the unpublished entries into the columns of the Editorial Workflow board. A pending deletion
 * has a status of its own, so it never lands in a stage column; such entries are listed separately.
 * An entry is placed by the stage it’s in, which may differ from its status: see `resolveStage()`
 * in the stages module. A stage that isn’t configured for the board still gets a column while it
 * holds an entry, e.g. one left in a pull request of a collection that no longer uses a workflow,
 * so no entry goes missing.
 * @param {WorkflowStatus[]} stages Statuses of the stage columns, in order.
 * @param {UnpublishedEntry[]} entries Unpublished entries.
 * @param {(entry: UnpublishedEntry) => WorkflowStatus} [getStage] Function to get the stage an
 * entry is in. Default: the entry’s status.
 * @returns {{ columns: { status: WorkflowStatus, entries: UnpublishedEntry[] }[],
 * pendingDeletions: UnpublishedEntry[] }} Stage columns and pending deletions.
 */
export const groupEntriesByStatus = (
  stages,
  entries,
  getStage = (entry) => entry.workflow.status,
) => {
  const entryStages = new Map(entries.map((entry) => [entry, getStage(entry)]));
  const occupied = new Set(entryStages.values());

  return {
    columns: WORKFLOW_STAGES.filter(
      (status) => stages.includes(status) || occupied.has(status),
    ).map((status) => ({
      status,
      entries: entries.filter((entry) => entryStages.get(entry) === status),
    })),
    pendingDeletions: entries.filter((entry) => entryStages.get(entry) === 'pending_deletion'),
  };
};
