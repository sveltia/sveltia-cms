import { isURL } from '@sveltia/utils/string';

import { customComponentRegistry } from '$lib/services/api/registries';
import { parseBackendConfig } from '$lib/services/config/parser/backend';
import { parseCollections } from '$lib/services/config/parser/collections';
import { parseFields } from '$lib/services/config/parser/fields';
import { parseI18nConfig } from '$lib/services/config/parser/i18n';
import { parseMediaConfig } from '$lib/services/config/parser/media';
import { parseMediaLibraries } from '$lib/services/config/parser/media-libraries';
import { parseSlugConfig } from '$lib/services/config/parser/slug';
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
 * Options that hold the URL of the site and have to be absolute. A `site_url` that isn’t a URL
 * isn’t rejected at runtime, but it’s then unusable as the base of every preview link, so the links
 * are silently dropped. The `display_url` option is only ever opened in a new tab, where a relative
 * path resolves against the CMS origin as well as an absolute URL does, so it’s not checked.
 * @type {(keyof CmsConfig)[]}
 */
const URL_OPTIONS = ['site_url'];
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

  URL_OPTIONS.forEach((option) => {
    const url = cmsConfig[option];

    // An empty string is as good as none, and a value of another type is reported against the
    // JSON schema
    if (typeof url === 'string' && url.trim() && !isURL(url.trim())) {
      addMessage({
        strKey: 'invalid_url_option',
        values: { option, url },
        context: { cmsConfig },
        collectors,
      });
    }
  });

  parseMediaConfig(cmsConfig, collectors);
  parseMediaLibraries({ config: cmsConfig, context: { cmsConfig }, collectors });
  parseSlugConfig(cmsConfig, collectors);
  parseI18nConfig(cmsConfig, collectors);
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
