import { S3CompatibleService } from './service';

/**
 * @import { S3Config } from '$lib/types/private';
 * @import { S3MediaLibrary } from '$lib/types/public';
 */

/**
 * Scaleway Object Storage media library service integration. Scaleway uses the region endpoint for
 * API calls (path-style) and virtual-hosted-style for public asset URLs, unless the user has
 * configured a custom CDN `public_url`.
 */
export default new S3CompatibleService({
  serviceId: 'scaleway_object_storage',
  serviceLabel: 'Scaleway Object Storage',
  serviceURL: 'https://www.scaleway.com/en/object-storage/',
  developerURL: 'https://www.scaleway.com/en/docs/object-storage/',
  apiKeyURL: 'https://console.scaleway.com/iam/api-keys',
  apiKeyPattern: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  /**
   * Add the Scaleway region endpoint and public URL to the library options.
   * @param {S3MediaLibrary} libOptions Library options.
   * @returns {S3Config} Resolved configuration.
   */
  resolveConfig: (libOptions) => ({
    ...libOptions,
    endpoint: `https://s3.${libOptions.region}.scw.cloud`,
    public_url:
      libOptions.public_url ?? `https://${libOptions.bucket}.s3.${libOptions.region}.scw.cloud`,
  }),
});
