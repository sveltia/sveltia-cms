import { cmsConfig } from '$lib/services/config/state';
import {
  findLibraryOptions,
  resolveLibraryOptions,
} from '$lib/services/integrations/media-libraries/options';

import {
  deleteS3Objects,
  isS3ObjectUrl,
  listS3Objects,
  renameS3Object,
  replaceS3Object,
  searchS3Objects,
  uploadToS3,
} from './core';

/**
 * @import {
 * ExternalAsset,
 * MediaLibraryFetchOptions,
 * MediaLibraryService,
 * S3Config,
 * } from '$lib/types/private';
 * @import { CmsConfig, MediaField, MediaLibraries, S3MediaLibrary } from '$lib/types/public';
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
 * default public URL. Default: the library options are used as is.
 */

/**
 * Media library service for an S3-compatible object storage service. The S3 API calls are shared
 * in the `core` module; this class resolves the service’s configuration from the CMS or field
 * configuration and delegates the operations to those functions.
 * @implements {MediaLibraryService}
 */
export class S3CompatibleService {
  /** @type {'cloud_storage'} */
  serviceType = 'cloud_storage';

  showServiceLink = true;

  hotlinking = true;

  /** @type {'api_key'} */
  authType = 'api_key';

  /**
   * Initialize an `S3CompatibleService` instance with the given service definition.
   * @param {S3CompatibleServiceOptions} options Service definition.
   */
  constructor({
    serviceId,
    serviceLabel,
    serviceURL,
    developerURL,
    apiKeyURL,
    apiKeyPattern,
    requiredOption = 'region',
    resolveConfig = (libOptions) => libOptions,
  }) {
    this.serviceId = serviceId;
    this.serviceLabel = serviceLabel;
    this.serviceURL = serviceURL;
    this.developerURL = developerURL;
    this.apiKeyURL = apiKeyURL;
    this.apiKeyPattern = apiKeyPattern;
    this.requiredOption = requiredOption;
    this.resolveConfig = resolveConfig;
  }

  /**
   * Get the service’s library options from site config.
   * @param {CmsConfig | MediaField} [config] CMS configuration or field configuration.
   * @returns {S3MediaLibrary | false | undefined} Configuration object, or `false` if explicitly
   * disabled.
   */
  getLibraryOptions(config = cmsConfig.current) {
    return /** @type {S3MediaLibrary | false | undefined} */ (
      findLibraryOptions(this.serviceId, config)
    );
  }

  /**
   * Get the resolved S3 configuration for the given field or global library options.
   * @param {MediaLibraryFetchOptions} options Options containing the configuration.
   * @returns {S3Config} Resolved configuration.
   * @throws {Error} If the service is not configured.
   */
  getConfig({ fieldConfig }) {
    const libOptions = /** @type {S3MediaLibrary | false | undefined} */ (
      resolveLibraryOptions(this.serviceId, fieldConfig)
    );

    if (!libOptions) {
      throw new Error(`${this.serviceLabel} configuration is not available`);
    }

    return this.resolveConfig(libOptions);
  }

  // The `MediaLibraryService` members below are arrow functions rather than prototype methods,
  // because consumers destructure them from the service object, which would lose `this` otherwise.

  /**
   * Check if the service is enabled.
   * @param {MediaField} [fieldConfig] Field configuration.
   * @returns {boolean} True if enabled, false otherwise.
   */
  isEnabled = (fieldConfig) => {
    const options = /** @type {S3MediaLibrary | false | undefined} */ (
      resolveLibraryOptions(this.serviceId, fieldConfig)
    );

    return !!(options && options.access_key_id && options.bucket && options[this.requiredOption]);
  };

  /**
   * Whether the given URL points to a file on the service.
   * @param {string} url URL.
   * @returns {boolean} Result.
   */
  isAssetURL = (url) => {
    try {
      return isS3ObjectUrl(this.getConfig(/** @type {any} */ ({})), url);
    } catch {
      // The service is not configured
      return false;
    }
  };

  /**
   * List files on the service.
   * @param {MediaLibraryFetchOptions} options Options containing the configuration.
   * @returns {Promise<ExternalAsset[]>} Assets.
   */
  list = async (options) => listS3Objects(this.getConfig(options), options);

  /**
   * Search files on the service.
   * @param {string} query Search query.
   * @param {MediaLibraryFetchOptions} options Options containing the configuration.
   * @returns {Promise<ExternalAsset[]>} Assets.
   */
  search = async (query, options) => searchS3Objects(query, this.getConfig(options), options);

  /**
   * Upload files to the service.
   * @param {File[]} files Files to upload.
   * @param {MediaLibraryFetchOptions} options Options containing the configuration.
   * @returns {Promise<ExternalAsset[]>} Uploaded assets.
   */
  upload = async (files, options) => uploadToS3(files, this.getConfig(options), options);

  /**
   * Delete files from the service.
   * @param {ExternalAsset[]} assets Assets to delete.
   * @param {MediaLibraryFetchOptions} options Options containing the configuration.
   * @returns {Promise<void>}
   */
  delete = async (assets, options) => deleteS3Objects(assets, this.getConfig(options), options);

  /**
   * Rename a file on the service.
   * @param {ExternalAsset} asset Asset to rename.
   * @param {string} newName New file name.
   * @param {MediaLibraryFetchOptions} options Options containing the configuration.
   * @returns {Promise<ExternalAsset>} Renamed asset.
   */
  rename = async (asset, newName, options) =>
    renameS3Object(asset, newName, this.getConfig(options), options);

  /**
   * Replace a file on the service with a new file.
   * @param {ExternalAsset} asset Asset to replace.
   * @param {File} file New file.
   * @param {MediaLibraryFetchOptions} options Options containing the configuration.
   * @returns {Promise<ExternalAsset>} Replaced asset.
   */
  replace = async (asset, file, options) =>
    replaceS3Object(asset, file, this.getConfig(options), options);
}
