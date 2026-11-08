import { S3CompatibleService } from './service';

/**
 * Backblaze B2 media library service integration. B2 uses the region endpoint for API calls
 * (path-style) and virtual-hosted-style for public asset URLs, unless the user has configured a
 * custom CDN `public_url`.
 */
export default new S3CompatibleService({
  serviceId: 'backblaze_b2',
  serviceLabel: 'Backblaze B2',
  serviceURL: 'https://www.backblaze.com/cloud-storage',
  developerURL: 'https://www.backblaze.com/docs/cloud-storage-s3-compatible-api',
  apiKeyURL: 'https://secure.backblaze.com/app_keys.htm',
  apiKeyPattern: /^[A-Za-z0-9/+=]{30,}$/,
  /**
   * Get the host name of the B2 API endpoint in the given region.
   * @param {string | undefined} region Region.
   * @returns {string} Host name.
   */
  regionalHost: (region) => `s3.${region}.backblazeb2.com`,
});
