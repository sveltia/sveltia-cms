import { isObject } from '@sveltia/utils/object';

import { WORKFLOW_STAGES } from '$lib/services/workflow/constants';

/**
 * @import { WorkflowStatus } from '$lib/types/private';
 * @import { CmsConfig, Collection, PublishModeOptions } from '$lib/types/public';
 */

/**
 * Publish modes an entry can be saved with.
 * @typedef {'simple' | 'preview' | 'editorial_workflow'} PublishMode
 */

/**
 * Publish mode options resolved for a collection, with the defaults filled in.
 * @typedef {object} ResolvedPublishMode
 * @property {PublishMode} type Publish mode.
 * @property {WorkflowStatus[]} stages Review stages an unpublished entry moves through, ordered
 * from the earliest to the latest. Always starts with `draft`. An entry can be published from the
 * last one. Preview mode has the drafting stage only, so an entry can be published right away.
 * @property {boolean} directPublish Whether an entry can be saved and published in one go,
 * bypassing the pull request.
 * @property {boolean} allowIncompleteDrafts Whether an entry in the drafting stage can be saved
 * with its required fields left empty.
 */

/**
 * Publish modes that save a change to a pull request rather than to the configured branch.
 * @type {PublishMode[]}
 */
const WORKFLOW_MODES = ['preview', 'editorial_workflow'];

/**
 * Turn the given `publish_mode` option value into its object form. The string form is a shorthand
 * for `{ type }`, and an empty string or a missing option says nothing at all.
 * @param {CmsConfig['publish_mode'] | Collection['publish_mode']} value Option value.
 * @returns {PublishModeOptions} Options.
 */
const normalizePublishMode = (value) => {
  if (typeof value === 'string') {
    return value ? { type: /** @type {PublishMode} */ (value) } : {};
  }

  return isObject(value) ? /** @type {PublishModeOptions} */ (value) : {};
};

/**
 * Get the review stages configured with the `stages` option, in the canonical order. The drafting
 * stage is always included: it’s where a new pull request starts. Unknown values are dropped; the
 * configuration parser reports them.
 * @param {unknown} stages Option value.
 * @returns {WorkflowStatus[]} Stages. All of them if the option isn’t a list.
 */
const getConfiguredStages = (stages) =>
  Array.isArray(stages)
    ? WORKFLOW_STAGES.filter((stage) => stage === 'draft' || stages.includes(stage))
    : WORKFLOW_STAGES;

/**
 * Get the publish mode options a collection uses. The collection-level `publish_mode` option
 * overrides the site-level one option by option, so Editorial Workflow can be enabled for some
 * collections only, or turned off for a collection while it’s enabled everywhere else, and a
 * collection can change one option while inheriting the others. Options that don’t apply to the
 * resulting publish mode are ignored.
 * @param {object} args Arguments.
 * @param {CmsConfig | undefined} args.cmsConfig Site configuration.
 * @param {Collection} [args.collection] Collection. Omit it for the site-level options, which is
 * what a collection without the option, such as the singleton collection, falls back to.
 * @returns {ResolvedPublishMode} Options.
 * @see https://github.com/decaporg/decap-cms/issues/1571
 * @see https://github.com/decaporg/decap-cms/issues/942
 */
export const getPublishModeOptions = ({ cmsConfig, collection }) => {
  const {
    type,
    stages,
    direct_publish: directPublish = false,
    allow_incomplete_drafts: allowIncompleteDrafts = true,
  } = {
    ...normalizePublishMode(cmsConfig?.publish_mode),
    ...normalizePublishMode(collection?.publish_mode),
  };

  // An unknown mode is reported by the configuration parser; until then, it’s the same as `simple`
  /** @type {PublishMode} */
  const mode = type && WORKFLOW_MODES.includes(type) ? type : 'simple';

  return {
    type: mode,
    // A simple collection may still have pull requests, e.g. one opened by an Open Authoring
    // contributor or before the option was changed, so they keep all the stages
    stages: mode === 'preview' ? ['draft'] : getConfiguredStages(stages),
    directPublish: mode !== 'simple' && directPublish === true,
    allowIncompleteDrafts: allowIncompleteDrafts !== false,
  };
};

/**
 * Get the publish mode a collection uses. See {@link getPublishModeOptions} for details.
 * @param {object} args Arguments.
 * @param {CmsConfig | undefined} args.cmsConfig Site configuration.
 * @param {Collection} [args.collection] Collection. Omit it for the site-level publish mode.
 * @returns {PublishMode} Publish mode. An empty string at the site level is the same as `simple`.
 */
export const getPublishMode = ({ cmsConfig, collection }) =>
  getPublishModeOptions({ cmsConfig, collection }).type;

/**
 * Check whether the given publish mode saves changes to a pull request: Editorial Workflow, or its
 * single-stage variant, Preview Workflow.
 * @param {PublishMode} mode Publish mode.
 * @returns {boolean} Result.
 */
export const isWorkflowMode = (mode) => WORKFLOW_MODES.includes(mode);

/**
 * Check whether a workflow is configured anywhere: for the whole site, or for at least one
 * collection. This is about the configuration alone; whether the backend implements the feature is
 * a separate matter.
 * @param {CmsConfig | undefined} cmsConfig Site configuration.
 * @returns {boolean} `true` if some content goes through Editorial Workflow or Preview Workflow.
 */
export const isWorkflowConfigured = (cmsConfig) =>
  isWorkflowMode(getPublishMode({ cmsConfig })) ||
  // The parser runs on the raw configuration, where the collections may not be a list at all
  (Array.isArray(cmsConfig?.collections) &&
    cmsConfig.collections.some(
      (collection) =>
        // A divider has no publish mode
        !('divider' in collection) && isWorkflowMode(getPublishMode({ cmsConfig, collection })),
    ));
