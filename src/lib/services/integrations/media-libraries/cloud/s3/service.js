import { ObjectStorageService } from '$lib/services/integrations/media-libraries/cloud/shared/service';

import { isS3ObjectUrl, s3Operations } from './core';

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
 * @property {string} [objectAcl] Canned ACL sent in the `x-amz-acl` header when creating an object,
 * for a service where objects are private by default, even in a public bucket, such as DigitalOcean
 * Spaces and Scaleway. It can’t be set in the library options. Default: none, as Amazon S3 rejects
 * ACLs on buckets created since April 2023, and services without per-object ACLs don’t implement
 * the header.
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
  constructor({
    requiredOption = 'region',
    objectAcl,
    resolveConfig = (libOptions) => libOptions,
    ...definition
  }) {
    super({
      ...definition,
      /**
       * Resolve the configuration, replacing any `acl` in the library options with the service’s
       * own object ACL.
       * @param {S3MediaLibrary} libOptions Library options.
       * @returns {S3Config} Resolved configuration.
       */
      resolveConfig: (libOptions) => ({ ...resolveConfig(libOptions), acl: objectAcl }),
      /**
       * Check if the access key ID, the bucket and the service-specific option are all set.
       * @param {S3Config} config Resolved configuration.
       * @returns {boolean} Result.
       */
      isConfigured: (config) => !!(config.access_key_id && config.bucket && config[requiredOption]),
      isConfigURL: isS3ObjectUrl,
      operations: s3Operations,
    });

    this.requiredOption = requiredOption;
  }
}
