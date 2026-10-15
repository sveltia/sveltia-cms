import { addMessage } from '$lib/services/config/parser/utils/validator';
import { WORKFLOW_STAGES } from '$lib/services/workflow/constants';

/**
 * @import { ConfigParserCollectors, ConfigParserContext } from '$lib/types/private';
 * @import { CmsConfig, Collection } from '$lib/types/public';
 */

/**
 * Check whether the given `stages` option value lists the review stages in the canonical order,
 * starting with the drafting stage, without repeating any. The JSON schema has already checked the
 * values themselves.
 * @param {unknown[]} stages Option value.
 * @returns {boolean} Result.
 */
const isValidStageList = (stages) =>
  stages[0] === 'draft' &&
  stages.every(
    (stage, index) =>
      index === 0 ||
      WORKFLOW_STAGES.indexOf(/** @type {any} */ (stage)) >
        WORKFLOW_STAGES.indexOf(/** @type {any} */ (stages[index - 1])),
  );

/**
 * Parse and validate the `publish_mode` option, either the site-level one or a collection-level
 * one. Its type is checked against the JSON schema, so only the rules the schema can’t express are
 * checked here.
 * @param {object} args Arguments.
 * @param {CmsConfig['publish_mode'] | Collection['publish_mode']} args.value Option value.
 * @param {ConfigParserContext} args.context Context, with the collection for a collection-level
 * option.
 * @param {ConfigParserCollectors} args.collectors Collectors.
 */
export const parsePublishMode = ({ value, context, collectors }) => {
  if (!value || typeof value !== 'object' || !Array.isArray(value.stages)) {
    return;
  }

  // Every pull request starts in the drafting stage, and an entry can only be published from the
  // last stage, so the order matters
  if (!isValidStageList(value.stages)) {
    addMessage({ strKey: 'invalid_publish_mode_stages', context, collectors });
  }

  // The stages only apply to Editorial Workflow: Preview Workflow has the drafting stage alone, and
  // the simple publish mode has none. A collection-level option without a type inherits the
  // site-level one, which may well be Editorial Workflow, so it’s left alone
  if (value.type === 'preview' || value.type === 'simple') {
    addMessage({
      type: 'warning',
      strKey: 'publish_mode_stages_ignored',
      values: { type: value.type },
      context,
      collectors,
    });
  }
};
