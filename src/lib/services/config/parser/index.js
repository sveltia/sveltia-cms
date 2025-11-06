/* eslint-disable camelcase */

import { parseBackendConfig } from '$lib/services/config/parser/backend';
import { parseCollections } from '$lib/services/config/parser/collections';
import { parseMediaConfig } from '$lib/services/config/parser/media';
import { checkUnsupportedOptions } from '$lib/services/config/parser/utils/messages';

/**
 * @import { SiteConfig } from '$lib/types/public';
 * @import { ConfigParserCollectors, UnsupportedOption } from '$lib/types/private';
 */

/**
 * Unsupported options.
 * @type {UnsupportedOption[]}
 */
const UNSUPPORTED_OPTIONS = [
  {
    type: 'warning',
    prop: 'publish_mode',
    value: 'editorial_workflow',
    strKey: 'editorial_workflow_unsupported',
  },
  { type: 'warning', prop: 'local_backend', strKey: 'unsupported_ignored_option' },
  { type: 'warning', prop: 'locale', strKey: 'unsupported_ignored_option' },
  { type: 'warning', prop: 'search', strKey: 'unsupported_ignored_option' },
];

/**
 * Parse and validate the site configuration.
 * @param {SiteConfig} siteConfig Raw site configuration.
 * @param {ConfigParserCollectors} collectors Collectors.
 * @throws {Error} If there is an error in the config.
 * @see https://decapcms.org/docs/configuration-options/
 * @todo Add more validations.
 */
export const parseSiteConfig = (siteConfig, collectors) => {
  parseBackendConfig(siteConfig, collectors);
  parseMediaConfig(siteConfig, collectors);
  parseCollections(siteConfig, collectors);

  checkUnsupportedOptions({
    UNSUPPORTED_OPTIONS,
    config: siteConfig,
    context: { siteConfig },
    collectors,
  });
};
