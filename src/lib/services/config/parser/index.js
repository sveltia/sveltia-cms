/* eslint-disable camelcase */

import { get } from 'svelte/store';
import { _ } from 'svelte-i18n';

import { parseBackendConfig } from '$lib/services/config/parser/backend';
import { parseCollections } from '$lib/services/config/parser/collections';
import { parseMediaConfig } from '$lib/services/config/parser/media';

/**
 * @import { SiteConfig } from '$lib/types/public';
 * @import { ConfigParserCollectors } from '$lib/types/private';
 */

/**
 * Parse and validate the site configuration.
 * @param {SiteConfig} config Raw site configuration.
 * @param {ConfigParserCollectors} collectors Collectors.
 * @throws {Error} If there is an error in the config.
 * @see https://decapcms.org/docs/configuration-options/
 * @todo Add more validations.
 */
export const parseSiteConfig = (config, collectors) => {
  const { publish_mode } = config;
  const { warnings } = collectors;

  parseBackendConfig(config, collectors);
  parseMediaConfig(config, collectors);
  parseCollections(config, collectors);

  if (publish_mode === 'editorial_workflow') {
    warnings.add(get(_)('config.warning.editorial_workflow_unsupported'));
  }
};
