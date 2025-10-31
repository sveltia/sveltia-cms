import { get } from 'svelte/store';
import { _ } from 'svelte-i18n';

/**
 * @import { SiteConfig } from '$lib/types/public';
 */

/**
 * Parse and validate the collections configuration from the site config.
 * @param {SiteConfig} config Raw config object.
 * @throws {Error} If there is an error in the collections config.
 */
export const parseCollections = (config) => {
  const { collections, singletons } = config;

  if (!Array.isArray(collections) && !Array.isArray(singletons)) {
    throw new Error(get(_)('config.error.no_collection'));
  }

  if (collections?.some((collection) => 'nested' in collection)) {
    // eslint-disable-next-line no-console
    console.warn('Nested collections are not yet supported in Sveltia CMS.');
  }
};
