import { S3CompatibleService } from './service';

/**
 * Scaleway Object Storage media library service integration. Scaleway uses the region endpoint for
 * API calls (path-style) and virtual-hosted-style for public asset URLs, unless the user has
 * configured a custom CDN `public_url`. Objects are private by default, even in a public bucket, so
 * new objects get the `public-read` ACL.
 */
export default new S3CompatibleService({
  serviceId: 'scaleway_object_storage',
  serviceLabel: 'Scaleway Object Storage',
  serviceURL: 'https://www.scaleway.com/en/object-storage/',
  developerURL: 'https://www.scaleway.com/en/docs/object-storage/',
  apiKeyURL: 'https://console.scaleway.com/iam/api-keys',
  objectAcl: 'public-read',
  apiKeyPattern: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  /**
   * Get the host name of the Scaleway API endpoint in the given region.
   * @param {string | undefined} region Region.
   * @returns {string} Host name.
   */
  regionalHost: (region) => `s3.${region}.scw.cloud`,
});
