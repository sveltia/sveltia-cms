import { S3CompatibleService } from './service';

/**
 * DigitalOcean Spaces media library service integration. Spaces uses the region endpoint for API
 * calls (path-style) and virtual-hosted-style for public asset URLs, unless the user has configured
 * a custom CDN `public_url`. Files are private by default, and a public file listing doesn’t make
 * them readable, so new objects get the `public-read` ACL.
 */
export default new S3CompatibleService({
  serviceId: 'digitalocean_spaces',
  serviceLabel: 'DigitalOcean Spaces',
  serviceURL: 'https://www.digitalocean.com/products/spaces',
  developerURL: 'https://docs.digitalocean.com/products/spaces/',
  apiKeyURL: 'https://cloud.digitalocean.com/account/api/spaces',
  objectAcl: 'public-read',
  apiKeyPattern: /^[A-Za-z0-9/+=]{43}$/,
  /**
   * Get the host name of the Spaces API endpoint in the given region.
   * @param {string | undefined} region Region.
   * @returns {string} Host name.
   */
  regionalHost: (region) => `${region}.digitaloceanspaces.com`,
});
