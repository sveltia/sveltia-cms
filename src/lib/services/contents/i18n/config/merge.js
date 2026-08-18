import { isObject } from '@sveltia/utils/object';

/**
 * @import { InternalSingletonCollection } from '$lib/types/private';
 * @import {
 * CmsConfig,
 * Collection,
 * CollectionDivider,
 * CollectionFile,
 * I18nOptions,
 * } from '$lib/types/public';
 */

/**
 * Merge the i18n configuration from the site, collection and file levels. The site configuration is
 * passed in rather than read from the `cmsConfig` store, so the function can also be used by the
 * config parser, which runs before the store is populated.
 * @internal
 * @param {object} args Arguments.
 * @param {CmsConfig | undefined} args.cmsConfig The site configuration.
 * @param {Collection | CollectionDivider | InternalSingletonCollection} args.collection The
 * collection configuration.
 * @param {CollectionFile} [args.file] The collection file configuration.
 * @returns {I18nOptions | undefined} Merged configuration or `undefined` if i18n is not enabled.
 */
export const mergeI18nConfigs = ({ cmsConfig, collection, file }) => {
  const siteConfig = cmsConfig?.i18n;

  if (!isObject(siteConfig)) {
    return undefined;
  }

  const config = structuredClone(/** @type {I18nOptions} */ (siteConfig));
  const { name, i18n: collectionI18n } = /** @type {Collection} */ (collection);

  // Check if the collection has its own i18n configuration. The singleton collection doesn’t have
  // its own i18n configuration, so it will inherit the global one if defined.
  if (!collectionI18n && name !== '_singletons') {
    return undefined;
  }

  if (isObject(collectionI18n)) {
    Object.assign(config, collectionI18n);
  }

  if (file) {
    if (!file.i18n) {
      return undefined;
    }

    if (isObject(file.i18n)) {
      Object.assign(config, file.i18n);
    }
  }

  return config;
};
