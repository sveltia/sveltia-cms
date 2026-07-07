import { parseBackendConfig } from '$lib/services/config/parser/backend';
import { parseCollections } from '$lib/services/config/parser/collections';
import { parseFields } from '$lib/services/config/parser/fields';
import { parseMediaConfig } from '$lib/services/config/parser/media';
import { checkUnsupportedOptions } from '$lib/services/config/parser/utils/validator';
import { customComponentRegistry } from '$lib/services/contents/api/registries';

/**
 * @import { CmsConfig } from '$lib/types/public';
 * @import { ConfigParserCollectors, UnsupportedOption } from '$lib/types/private';
 */

/**
 * Unsupported options.
 * @type {UnsupportedOption[]}
 */
const UNSUPPORTED_OPTIONS = [
  // @todo Remove this warning when Sveltia CMS adds support for editorial workflow.
  {
    type: 'warning',
    prop: 'publish_mode',
    value: 'editorial_workflow',
    strKey: 'editorial_workflow_unsupported',
  },
  // Sveltia CMS doesn’t use a proxy server for local workflow, so this option is not applicable.
  { type: 'warning', prop: 'local_backend', strKey: 'unsupported_ignored_option' },
  // Sveltia CMS detects user’s locale from the browser, so this option is not applicable.
  { type: 'warning', prop: 'locale', strKey: 'unsupported_ignored_option' },
  // Sveltia CMS doesn’t have performance issues with searching content, so this option is not
  // applicable.
  { type: 'warning', prop: 'search', strKey: 'unsupported_ignored_option' },
];

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
  parseMediaConfig(cmsConfig, collectors);
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
