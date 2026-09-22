import { ObjectStorageService } from '$lib/services/integrations/media-libraries/cloud/shared/service';

import {
  browseS3Objects,
  createS3Folder,
  deleteS3Folder,
  deleteS3Objects,
  isS3ObjectUrl,
  listS3Objects,
  moveS3Object,
  renameS3Object,
  replaceS3Object,
  searchS3Objects,
  uploadToS3,
} from './core';

/**
 * @import { S3Config } from '$lib/types/private';
 * @import { MediaLibraries, S3MediaLibrary } from '$lib/types/public';
 */

/**
 * Options to define an S3-compatible media library service.
 * @typedef {object} S3CompatibleServiceOptions
 * @property {keyof MediaLibraries} serviceId Service identifier matching the `media_libraries`
 * key.
 * @property {string} serviceLabel Service label.
 * @property {string} serviceURL Service URL.
 * @property {string} developerURL URL of the page that provides the API/developer service.
 * @property {string} apiKeyURL URL of the page that provides the secret access key.
 * @property {RegExp} apiKeyPattern Secret access key pattern.
 * @property {keyof S3MediaLibrary} [requiredOption] Service-specific option that must be set along
 * with `access_key_id` and `bucket` for the service to be enabled, such as `region` or
 * `account_id`. Default: `region`.
 * @property {(libOptions: S3MediaLibrary) => S3Config} [resolveConfig] Function to derive the S3
 * configuration from the library options, typically to add the service’s fixed API endpoint and
 * default public URL, or to fill in a default `access_key_id`. The result is also used to decide
 * whether the service is enabled. Default: the library options are used as is.
 */

/**
 * Media library service for an S3-compatible object storage service. The S3 API calls are shared
 * in the `core` module; the base class resolves the service’s configuration from the CMS or field
 * configuration and delegates the operations to those functions.
 * @augments {ObjectStorageService<S3Config>}
 */
export class S3CompatibleService extends ObjectStorageService {
  /**
   * Initialize an `S3CompatibleService` instance with the given service definition.
   * @param {S3CompatibleServiceOptions} options Service definition.
   */
  constructor({ requiredOption = 'region', ...definition }) {
    super({
      ...definition,
      /**
       * Check if the access key ID, the bucket and the service-specific option are all set.
       * @param {S3Config} config Resolved configuration.
       * @returns {boolean} Result.
       */
      isConfigured: (config) => !!(config.access_key_id && config.bucket && config[requiredOption]),
      isConfigURL: isS3ObjectUrl,
      operations: {
        list: listS3Objects,
        browse: browseS3Objects,
        search: searchS3Objects,
        upload: uploadToS3,
        delete: deleteS3Objects,
        rename: renameS3Object,
        replace: replaceS3Object,
        move: moveS3Object,
        createFolder: createS3Folder,
        deleteFolder: deleteS3Folder,
      },
    });

    this.requiredOption = requiredOption;
  }
}
