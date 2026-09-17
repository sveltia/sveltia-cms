/**
 * @import { CmsConfig, Collection } from '$lib/types/public';
 */

/**
 * Publish modes an entry can be saved with.
 * @typedef {'simple' | 'editorial_workflow'} PublishMode
 */

/**
 * Get the publish mode a collection uses. The collection-level `publish_mode` option overrides the
 * site-level one, so Editorial Workflow can be enabled for some collections only, or turned off for
 * a collection while it’s enabled everywhere else.
 * @param {object} args Arguments.
 * @param {CmsConfig | undefined} args.cmsConfig Site configuration.
 * @param {Collection} [args.collection] Collection. Omit it for the site-level publish mode, which
 * is what a collection without the option, such as the singleton collection, falls back to.
 * @returns {PublishMode} Publish mode. An empty string at the site level is the same as `simple`.
 * @see https://github.com/decaporg/decap-cms/issues/1571
 */
export const getPublishMode = ({ cmsConfig, collection }) =>
  collection?.publish_mode || cmsConfig?.publish_mode || 'simple';

/**
 * Check whether Editorial Workflow is configured anywhere: for the whole site, or for at least one
 * collection. This is about the configuration alone; whether the backend implements the feature is
 * a separate matter.
 * @param {CmsConfig | undefined} cmsConfig Site configuration.
 * @returns {boolean} `true` if some content goes through the workflow.
 */
export const isWorkflowConfigured = (cmsConfig) =>
  getPublishMode({ cmsConfig }) === 'editorial_workflow' ||
  // The parser runs on the raw configuration, where the collections may not be a list at all
  (Array.isArray(cmsConfig?.collections) &&
    cmsConfig.collections.some(
      (collection) =>
        // A divider has no publish mode
        !('divider' in collection) &&
        getPublishMode({ cmsConfig, collection }) === 'editorial_workflow',
    ));
