import { cmsConfig } from '$lib/services/config/state';
import {
  findLibraryOptions,
  resolveLibraryOptions,
} from '$lib/services/integrations/media-libraries/options';

/**
 * @import {
 * ExternalAsset,
 * ExternalFolderListing,
 * MediaLibraryFetchOptions,
 * MediaLibraryService,
 * } from '$lib/types/private';
 * @import { CmsConfig, MediaField, MediaLibraries } from '$lib/types/public';
 */

/**
 * Operations of an object storage service, which take the resolved service configuration.
 * @template C Service configuration type.
 * @typedef {object} ObjectStorageOperations
 * @property {(config: C, options: MediaLibraryFetchOptions) => Promise<ExternalAsset[]>} list
 * Function to list files.
 * @property {(config: C, options: MediaLibraryFetchOptions) => Promise<ExternalFolderListing>}
 * browse Function to list the files and the empty folders.
 * @property {(query: string, config: C, options: MediaLibraryFetchOptions) =>
 * Promise<ExternalAsset[]>} search Function to search files.
 * @property {(files: File[], config: C, options: MediaLibraryFetchOptions) =>
 * Promise<ExternalAsset[]>} upload Function to upload files.
 * @property {(assets: ExternalAsset[], config: C, options: MediaLibraryFetchOptions) =>
 * Promise<void>} delete Function to delete files.
 * @property {(asset: ExternalAsset, newName: string, config: C, options: MediaLibraryFetchOptions)
 * => Promise<ExternalAsset>} rename Function to rename a file.
 * @property {(asset: ExternalAsset, file: File, config: C, options: MediaLibraryFetchOptions) =>
 * Promise<ExternalAsset>} replace Function to replace a file.
 * @property {(asset: ExternalAsset, newPath: string, config: C, options: MediaLibraryFetchOptions)
 * => Promise<ExternalAsset>} move Function to move a file.
 * @property {(dirPath: string, config: C, options: MediaLibraryFetchOptions) => Promise<void>}
 * createFolder Function to create an empty folder.
 * @property {(dirPath: string, config: C, options: MediaLibraryFetchOptions) => Promise<void>}
 * deleteFolder Function to remove the placeholder of a folder.
 */

/**
 * Options to define an object storage media library service.
 * @template C Service configuration type.
 * @typedef {object} ObjectStorageServiceOptions
 * @property {keyof MediaLibraries} serviceId Service identifier matching the `media_libraries`
 * key.
 * @property {string} serviceLabel Service label.
 * @property {string} serviceURL Service URL.
 * @property {string} developerURL URL of the page that provides the API/developer service.
 * @property {string} apiKeyURL URL of the page that provides the API key.
 * @property {RegExp} apiKeyPattern API key pattern.
 * @property {(libOptions: any) => C} [resolveConfig] Function to derive the service configuration
 * from the library options. Default: the library options are used as is.
 * @property {(config: C) => boolean} isConfigured Function to check whether the resolved
 * configuration has every option the service needs to be enabled.
 * @property {(config: C, url: string) => boolean} isConfigURL Function to check whether the given
 * URL points to a file on the service with the resolved configuration.
 * @property {ObjectStorageOperations<C>} operations Operations of the service.
 */

/**
 * Media library service for an object storage service, such as Azure Blob Storage or an
 * S3-compatible service. It resolves the service’s configuration from the CMS or field
 * configuration and delegates the operations to the given functions.
 * @template C Service configuration type.
 * @implements {MediaLibraryService}
 */
export class ObjectStorageService {
  /** @type {'cloud_storage'} */
  serviceType = 'cloud_storage';

  showServiceLink = true;

  hotlinking = true;

  /** @type {'api_key'} */
  authType = 'api_key';

  /**
   * Initialize an `ObjectStorageService` instance with the given service definition.
   * @param {ObjectStorageServiceOptions<C>} options Service definition.
   */
  constructor({
    serviceId,
    serviceLabel,
    serviceURL,
    developerURL,
    apiKeyURL,
    apiKeyPattern,
    resolveConfig = (libOptions) => libOptions,
    isConfigured,
    isConfigURL,
    operations,
  }) {
    this.serviceId = serviceId;
    this.serviceLabel = serviceLabel;
    this.serviceURL = serviceURL;
    this.developerURL = developerURL;
    this.apiKeyURL = apiKeyURL;
    this.apiKeyPattern = apiKeyPattern;
    this.resolveConfig = resolveConfig;
    this.isConfigured = isConfigured;
    this.isConfigURL = isConfigURL;
    this.operations = operations;
  }

  /**
   * Get the service’s library options from site config.
   * @param {CmsConfig | MediaField} [config] CMS configuration or field configuration.
   * @returns {any} Configuration object, `false` if explicitly disabled, or `undefined` if not
   * configured.
   */
  getLibraryOptions(config = cmsConfig.current) {
    return findLibraryOptions(this.serviceId, config);
  }

  /**
   * Get the resolved configuration for the given field or global library options.
   * @param {MediaLibraryFetchOptions} options Options containing the configuration.
   * @returns {C} Resolved configuration.
   * @throws {Error} If the service is not configured.
   */
  getConfig({ fieldConfig }) {
    const libOptions = resolveLibraryOptions(this.serviceId, fieldConfig);

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
    const options = resolveLibraryOptions(this.serviceId, fieldConfig);

    return !!options && this.isConfigured(this.resolveConfig(options));
  };

  /**
   * Whether the given URL points to a file on the service.
   * @param {string} url URL.
   * @returns {boolean} Result.
   */
  isAssetURL = (url) => {
    try {
      return this.isConfigURL(this.getConfig(/** @type {any} */ ({})), url);
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
  list = async (options) => this.operations.list(this.getConfig(options), options);

  /**
   * List the files and the empty folders on the service.
   * @param {MediaLibraryFetchOptions} options Options containing the configuration.
   * @returns {Promise<ExternalFolderListing>} Files and folders.
   */
  browse = async (options) => this.operations.browse(this.getConfig(options), options);

  /**
   * Search files on the service.
   * @param {string} query Search query.
   * @param {MediaLibraryFetchOptions} options Options containing the configuration.
   * @returns {Promise<ExternalAsset[]>} Assets.
   */
  search = async (query, options) =>
    this.operations.search(query, this.getConfig(options), options);

  /**
   * Upload files to the service.
   * @param {File[]} files Files to upload.
   * @param {MediaLibraryFetchOptions} options Options containing the configuration.
   * @returns {Promise<ExternalAsset[]>} Uploaded assets.
   */
  upload = async (files, options) =>
    this.operations.upload(files, this.getConfig(options), options);

  /**
   * Delete files from the service.
   * @param {ExternalAsset[]} assets Assets to delete.
   * @param {MediaLibraryFetchOptions} options Options containing the configuration.
   * @returns {Promise<void>}
   */
  delete = async (assets, options) =>
    this.operations.delete(assets, this.getConfig(options), options);

  /**
   * Rename a file on the service.
   * @param {ExternalAsset} asset Asset to rename.
   * @param {string} newName New file name.
   * @param {MediaLibraryFetchOptions} options Options containing the configuration.
   * @returns {Promise<ExternalAsset>} Renamed asset.
   */
  rename = async (asset, newName, options) =>
    this.operations.rename(asset, newName, this.getConfig(options), options);

  /**
   * Replace a file on the service with a new file.
   * @param {ExternalAsset} asset Asset to replace.
   * @param {File} file New file.
   * @param {MediaLibraryFetchOptions} options Options containing the configuration.
   * @returns {Promise<ExternalAsset>} Replaced asset.
   */
  replace = async (asset, file, options) =>
    this.operations.replace(asset, file, this.getConfig(options), options);

  /**
   * Move a file on the service to another path.
   * @param {ExternalAsset} asset Asset to move.
   * @param {string} newPath New path relative to the configured prefix.
   * @param {MediaLibraryFetchOptions} options Options containing the configuration.
   * @returns {Promise<ExternalAsset>} Moved asset.
   */
  move = async (asset, newPath, options) =>
    this.operations.move(asset, newPath, this.getConfig(options), options);

  /**
   * Create an empty folder on the service.
   * @param {string} dirPath Folder path relative to the configured prefix.
   * @param {MediaLibraryFetchOptions} options Options containing the configuration.
   * @returns {Promise<void>}
   */
  createFolder = async (dirPath, options) =>
    this.operations.createFolder(dirPath, this.getConfig(options), options);

  /**
   * Remove the placeholder of a folder on the service.
   * @param {string} dirPath Folder path relative to the configured prefix.
   * @param {MediaLibraryFetchOptions} options Options containing the configuration.
   * @returns {Promise<void>}
   */
  deleteFolder = async (dirPath, options) =>
    this.operations.deleteFolder(dirPath, this.getConfig(options), options);
}
