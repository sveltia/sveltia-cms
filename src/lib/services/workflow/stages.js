import { cmsConfig } from '$lib/services/config';
import { createDerivedState } from '$lib/services/utils/state.svelte';
import { getPublishModeOptions, isWorkflowMode } from '$lib/services/workflow/config';
import { OPEN_AUTHORING_STAGES, WORKFLOW_STAGES } from '$lib/services/workflow/constants';
import { openAuthoring } from '$lib/services/workflow/open-authoring';

/**
 * @import { UnpublishedEntry, WorkflowStatus } from '$lib/types/private';
 * @import { Collection } from '$lib/types/public';
 */

/**
 * Get the review stages an unpublished entry in the given collection moves through, which are the
 * options in the editor’s status menu. They’re configured with the `stages` option of the
 * `publish_mode` option, and Preview Workflow has the drafting stage only. An Open Authoring
 * contributor always gets the stages available to them, whatever the collection says: their last
 * step is to hand the entry over for review.
 * @param {Collection | undefined} collection Collection. `undefined` falls back to the site-level
 * publish mode.
 * @returns {WorkflowStatus[]} Stages, ordered from the earliest to the latest.
 */
export const getWorkflowStages = (collection) =>
  openAuthoring.current
    ? OPEN_AUTHORING_STAGES
    : getPublishModeOptions({ cmsConfig: cmsConfig.current, collection }).stages;

/**
 * Get the stage the given status stands for among the given stages. A pull request labelled with a
 * stage that isn’t configured — by another CMS, before the configuration was changed, or by an Open
 * Authoring contributor handing it over for review in Preview Workflow — is treated as being in the
 * nearest earlier stage, so a review is never skipped. The label itself is left alone until the
 * entry is moved.
 * @param {WorkflowStatus} status Status read from the pull request’s labels.
 * @param {WorkflowStatus[]} stages Configured stages, which always include `draft`.
 * @returns {WorkflowStatus} Stage. A pending deletion has no stages, so it’s returned as is.
 */
export const resolveStage = (status, stages) => {
  if (status === 'pending_deletion') {
    return status;
  }

  const index = WORKFLOW_STAGES.indexOf(status);

  return stages.findLast((stage) => WORKFLOW_STAGES.indexOf(stage) <= index) ?? 'draft';
};

/**
 * Get the stage the given unpublished entry is in. See {@link resolveStage} for details.
 * @param {UnpublishedEntry} entry Unpublished entry.
 * @param {Collection | undefined} collection Collection the entry belongs to.
 * @returns {WorkflowStatus} Stage, or `pending_deletion` for a pending deletion.
 */
export const getEntryStage = (entry, collection) =>
  resolveStage(entry.workflow.status, getWorkflowStages(collection));

/**
 * Get the stage that comes after the one the given unpublished entry is in.
 * @param {UnpublishedEntry} entry Unpublished entry.
 * @param {Collection | undefined} collection Collection the entry belongs to.
 * @returns {WorkflowStatus | undefined} Next stage, or `undefined` if the entry is in the last
 * stage or is a pending deletion.
 */
export const getNextStage = (entry, collection) => {
  const stages = getWorkflowStages(collection);
  const stage = resolveStage(entry.workflow.status, stages);

  return stage === 'pending_deletion' ? undefined : stages[stages.indexOf(stage) + 1];
};

/**
 * Check whether the given unpublished entry is in the last stage, which is where it can be
 * published from. With Preview Workflow, that’s the drafting stage.
 * @param {UnpublishedEntry} entry Unpublished entry.
 * @param {Collection | undefined} collection Collection the entry belongs to.
 * @returns {boolean} Result. Always `false` for a pending deletion.
 */
export const isLastStage = (entry, collection) => {
  const stages = getWorkflowStages(collection);

  return resolveStage(entry.workflow.status, stages) === stages.at(-1);
};

/**
 * Review stages shown as the columns of the Editorial Workflow board: every stage configured for
 * the site or for any collection that goes through a workflow, in the canonical order. The board
 * has a single column when everything uses Preview Workflow. An Open Authoring contributor gets the
 * stages available to them.
 */
export const boardStages = createDerivedState(() => {
  if (openAuthoring.current) {
    return OPEN_AUTHORING_STAGES;
  }

  const config = cmsConfig.current;
  /** @type {Set<WorkflowStatus>} */
  const stages = new Set(['draft']);

  [undefined, ...(config?.collections ?? [])].forEach((collection) => {
    if (collection && 'divider' in collection) {
      return;
    }

    const options = getPublishModeOptions({ cmsConfig: config, collection });

    if (isWorkflowMode(options.type)) {
      options.stages.forEach((stage) => stages.add(stage));
    }
  });

  return WORKFLOW_STAGES.filter((stage) => stages.has(stage));
});

/**
 * I18n string key of the Editorial Workflow page’s name. When everything uses Preview Workflow, the
 * page is a plain list of drafts rather than a board with review stages, so it’s named after them.
 */
export const workflowPageLabelKey = createDerivedState(() =>
  boardStages.current.length === 1 ? 'drafts' : 'editorial_workflow',
);
