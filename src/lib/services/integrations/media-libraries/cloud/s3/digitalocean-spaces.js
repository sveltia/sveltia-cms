import { S3CompatibleService } from './service';

/**
 * @import { S3Config } from '$lib/types/private';
 * @import { S3MediaLibrary } from '$lib/types/public';
 */

/**
 * DigitalOcean Spaces media library service integration. Spaces uses the region endpoint for API
 * calls (path-style) and virtual-hosted-style for public asset URLs, unless the user has configured
 * a custom CDN `public_url`.
 */
export default new S3CompatibleService({
  serviceId: 'digitalocean_spaces',
  serviceLabel: 'DigitalOcean Spaces',
  serviceURL: 'https://www.digitalocean.com/products/spaces',
  developerURL: 'https://docs.digitalocean.com/products/spaces/',
  apiKeyURL: 'https://cloud.digitalocean.com/account/api/spaces',
  apiKeyPattern: /^[A-Za-z0-9/+=]{43}$/,
  /**
   * Add the Spaces region endpoint and public URL to the library options.
   * @param {S3MediaLibrary} libOptions Library options.
   * @returns {S3Config} Resolved configuration.
   */
  resolveConfig: (libOptions) => ({
    ...libOptions,
    endpoint: `https://${libOptions.region}.digitaloceanspaces.com`,
    public_url:
      libOptions.public_url ??
      `https://${libOptions.bucket}.${libOptions.region}.digitaloceanspaces.com`,
  }),
});
