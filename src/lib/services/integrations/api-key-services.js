import { allAiServices } from '$lib/services/integrations/ai';
import { allCloudStorageServices } from '$lib/services/integrations/media-libraries/cloud';
import {
  allStockAssetProviders,
  getStockAssetMediaLibraryOptions,
} from '$lib/services/integrations/media-libraries/stock';
import { machineTranslationServices } from '$lib/services/integrations/translators';
import { isInvalidApiKey } from '$lib/services/user/api-keys';

/**
 * @import { AiService, MediaLibraryService, TranslationService } from '$lib/types/private';
 */

/**
 * Services that take an API key, listed together, e.g. the translation services.
 * @typedef {object} ApiKeyServiceGroup
 * @property {string} key Key, e.g. `translators`.
 * @property {string} titleKey Message key of the group’s title.
 * @property {string} fieldLabelKey Message key of a service’s field label, which takes the service
 * name as `service`.
 * @property {[string, AiService | MediaLibraryService | TranslationService][]} entries Services,
 * with their IDs.
 */

/**
 * Get the cloud storage services the CMS configuration turns on, which take an API key. Cloudinary
 * signs in with its own widget instead.
 * @returns {[string, MediaLibraryService][]} Services, with their IDs.
 */
export const getCloudStorageServiceEntries = () =>
  Object.entries(allCloudStorageServices).filter(
    ([, { isEnabled, authType }]) => (isEnabled?.() ?? true) && authType !== 'widget',
  );

/**
 * Get the stock photo services the CMS configuration turns on, which take an API key. Lorem Picsum
 * needs none.
 * @returns {[string, MediaLibraryService][]} Services, with their IDs.
 */
export const getStockPhotoServiceEntries = () => {
  const { providers = [] } = getStockAssetMediaLibraryOptions();

  return Object.entries(allStockAssetProviders).filter(
    ([serviceId, { authType }]) =>
      providers.includes(/** @type {any} */ (serviceId)) && authType !== 'none',
  );
};

/**
 * Get the services that take an API key, in groups, leaving out the groups with none turned on.
 * @returns {ApiKeyServiceGroup[]} Groups.
 */
export const getApiKeyServiceGroups = () =>
  /** @type {ApiKeyServiceGroup[]} */ ([
    {
      key: 'translators',
      titleKey: 'prefs.i18n.translators.api_keys.title',
      fieldLabelKey: 'prefs.i18n.translators.field_label',
      entries: Object.entries(machineTranslationServices),
    },
    {
      key: 'ai',
      titleKey: 'prefs.ai.api_keys.title',
      fieldLabelKey: 'prefs.ai.field_label',
      entries: Object.entries(allAiServices),
    },
    {
      key: 'cloud_storage',
      titleKey: 'prefs.media.cloud_storage.api_keys.title',
      fieldLabelKey: 'prefs.media.cloud_storage.field_label',
      entries: getCloudStorageServiceEntries(),
    },
    {
      key: 'stock_photos',
      titleKey: 'prefs.media.stock_photos.api_keys.title',
      fieldLabelKey: 'prefs.media.stock_photos.field_label',
      entries: getStockPhotoServiceEntries(),
    },
  ]).filter(({ entries }) => entries.length);

/**
 * Find an API key that doesn’t match the pattern its service expects.
 * @param {Record<string, string>} apiKeys API keys by service ID. Empty ones are ignored.
 * @param {ApiKeyServiceGroup[]} groups Services the keys are for.
 * @returns {string | undefined} Label of the first service whose key is wrong, if any.
 */
export const findInvalidApiKey = (apiKeys, groups) =>
  groups
    .flatMap(({ entries }) => entries)
    .find(([serviceId, { apiKeyPattern }]) =>
      isInvalidApiKey(apiKeys[serviceId]?.trim() ?? '', apiKeyPattern),
    )?.[1].serviceLabel;
