import { customComponentRegistry } from '$lib/services/api/registries';
import { parseBackendConfig } from '$lib/services/config/parser/backend';
import { parseCollections } from '$lib/services/config/parser/collections';
import { parseFields } from '$lib/services/config/parser/fields';
import { parseMediaConfig } from '$lib/services/config/parser/media';
import { parseMediaLibraries } from '$lib/services/config/parser/media-libraries';
import { addMessage, checkUnsupportedOptions } from '$lib/services/config/parser/utils/validator';

/**
 * @import { CmsConfig } from '$lib/types/public';
 * @import { ConfigParserCollectors, UnsupportedOption } from '$lib/types/private';
 */

/**
 * Unsupported options.
 * @type {UnsupportedOption[]}
 */
const UNSUPPORTED_OPTIONS = [
  // Sveltia CMS doesn’t use a proxy server for local workflow, so this option is not applicable.
  { type: 'warning', prop: 'local_backend', strKey: 'unsupported_ignored_option' },
  // Sveltia CMS detects user’s locale from the browser, so this option is not applicable.
  { type: 'warning', prop: 'locale', strKey: 'unsupported_ignored_option' },
  // Sveltia CMS doesn’t have performance issues with searching content, so this option is not
  // applicable.
  { type: 'warning', prop: 'search', strKey: 'unsupported_ignored_option' },
];

/**
 * Backend services that support Editorial Workflow.
 * @type {(string | undefined)[]}
 */
const WORKFLOW_BACKENDS = ['github', 'gitlab'];

/**
 * Parse and validate the CMS configuration.
 * @param {CmsConfig} cmsConfig Raw CMS configuration.
 * @param {ConfigParserCollectors} collectors Collectors.
 * @throws {Error} If there is an error in the config.
 * @see https://decapcms.org/docs/configuration-options/
 * @todo Add more validations.
 */
export const parseCmsConfig = (cmsConfig, collectors) => {
  parseBackendConfig(cmsConfig, collectors);

  // Editorial Workflow is not implemented for every backend yet
  if (
    cmsConfig.publish_mode === 'editorial_workflow' &&
    !WORKFLOW_BACKENDS.includes(cmsConfig.backend?.name)
  ) {
    addMessage({
      type: 'warning',
      strKey: 'editorial_workflow_unsupported',
      context: { cmsConfig },
      collectors,
    });
  }

  parseMediaConfig(cmsConfig, collectors);
  parseMediaLibraries({ config: cmsConfig, context: { cmsConfig }, collectors });
  parseCollections(cmsConfig, collectors);

  checkUnsupportedOptions({
    UNSUPPORTED_OPTIONS,
    config: cmsConfig,
    context: { cmsConfig },
    collectors,
  });

  // Parse fields in custom editor components registered with `CMS.registerEditorComponent()`.
  // @todo Figure out how to handle lazy-loaded components, as they may not be parsed here.
  customComponentRegistry.forEach(({ fields }, componentName) => {
    parseFields(fields, { cmsConfig, componentName }, collectors);
  });
};
