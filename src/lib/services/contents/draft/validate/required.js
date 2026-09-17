import { getUnpublishedEntryByDraft, isWorkflowDraft } from '$lib/services/workflow';

/**
 * @import { EntryDraft, UnpublishedEntry, WorkflowStatus } from '$lib/types/private';
 */

/**
 * Get the current Editorial Workflow status of the entry the given draft is editing. The status can
 * change while the editor stays open — from the status menu, or on the Editorial Workflow page — so
 * it’s read from the store rather than from the draft’s snapshot of the entry.
 * @param {EntryDraft} draft Draft being edited.
 * @returns {WorkflowStatus | undefined} Status, or `undefined` if the entry has no pull request.
 */
const getWorkflowStatus = (draft) =>
  getUnpublishedEntryByDraft(draft)?.workflow.status ??
  /** @type {UnpublishedEntry | undefined} */ (draft.originalEntry)?.workflow?.status;

/**
 * Check whether the required fields of the given draft have to be filled in for it to be saved.
 * With Editorial Workflow an entry lives in a pull request until it’s published, so one that’s
 * still in the drafting stage can be saved incomplete, and the fields left empty aren’t marked as
 * errors. Anywhere else a save puts the entry straight on the site, and a workflow entry that has
 * moved on from the drafting stage is on its way there too.
 * @param {EntryDraft} draft Draft to check.
 * @returns {boolean} `true` if an empty required field is an error.
 * @see https://github.com/decaporg/decap-cms/issues/464
 */
export const isRequiredEnforced = (draft) =>
  // An entry that has no pull request yet starts as a draft
  !isWorkflowDraft(draft) || (getWorkflowStatus(draft) ?? 'draft') !== 'draft';
