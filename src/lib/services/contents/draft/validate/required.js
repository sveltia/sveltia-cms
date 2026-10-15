import { cmsConfig } from '$lib/services/config';
import { getUnpublishedEntryByDraft, isWorkflowDraft } from '$lib/services/workflow';
import { getPublishModeOptions } from '$lib/services/workflow/config';
import { getEntryStage } from '$lib/services/workflow/stages';

/**
 * @import { EntryDraft, UnpublishedEntry, WorkflowStatus } from '$lib/types/private';
 */

/**
 * Get the Editorial Workflow stage of the entry the given draft is editing. The status can change
 * while the editor stays open — from the status menu, or on the Editorial Workflow page — so it’s
 * read from the store rather than from the draft’s snapshot of the entry.
 * @param {EntryDraft} draft Draft being edited.
 * @returns {WorkflowStatus} Stage. An entry that has no pull request yet starts as a draft.
 */
const getWorkflowStage = (draft) => {
  const entry =
    getUnpublishedEntryByDraft(draft) ??
    /** @type {UnpublishedEntry | undefined} */ (draft.originalEntry);

  return entry?.workflow ? getEntryStage(entry, draft.collection) : 'draft';
};

/**
 * Check whether the required fields of the given draft have to be filled in for it to be saved.
 * With a workflow an entry lives in a pull request until it’s published, so one that’s still in the
 * drafting stage can be saved incomplete, and the fields left empty aren’t marked as errors, unless
 * the `allow_incomplete_drafts` publish mode option is turned off. Anywhere else a save puts the
 * entry straight on the site, and a workflow entry that has moved on from the drafting stage is on
 * its way there too.
 * @param {EntryDraft} draft Draft to check.
 * @returns {boolean} `true` if an empty required field is an error.
 * @see https://github.com/decaporg/decap-cms/issues/464
 * @see https://github.com/decaporg/decap-cms/issues/5013
 */
export const isRequiredEnforced = (draft) =>
  !isWorkflowDraft(draft) ||
  !getPublishModeOptions({ cmsConfig: cmsConfig.current, collection: draft.collection })
    .allowIncompleteDrafts ||
  getWorkflowStage(draft) !== 'draft';
