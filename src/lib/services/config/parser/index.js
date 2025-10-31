/* eslint-disable camelcase */

import { parseBackendConfig } from '$lib/services/config/parser/backend';
import { parseCollections } from '$lib/services/config/parser/collections';
import { parseMediaConfig } from '$lib/services/config/parser/media';

/**
 * @import { SiteConfig } from '$lib/types/public';
 */

/**
 * Parse and validate the site configuration.
 * @param {SiteConfig} config Raw config object.
 * @throws {Error} If there is an error in the config.
 * @see https://decapcms.org/docs/configuration-options/
 * @todo Add more validations.
 */
export const parseSiteConfig = (config) => {
  parseBackendConfig(config);
  parseMediaConfig(config);
  parseCollections(config);

  const { publish_mode } = config;

  if (publish_mode === 'editorial_workflow') {
    // eslint-disable-next-line no-console
    console.warn('Editorial workflow is not yet supported in Sveltia CMS.');
  }
};
