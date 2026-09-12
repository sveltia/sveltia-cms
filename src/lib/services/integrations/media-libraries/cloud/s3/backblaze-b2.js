import { S3CompatibleService } from './service';

/**
 * @import { S3Config } from '$lib/types/private';
 * @import { S3MediaLibrary } from '$lib/types/public';
 */

/**
 * Backblaze B2 media library service integration. B2 uses the region endpoint for API calls
 * (path-style) and virtual-hosted-style for public asset URLs, unless the user has configured a
 * custom CDN `public_url`. B2 does not support per-object ACLs; omit the `x-amz-acl` header on
 * uploads.
 */
export default new S3CompatibleService({
  serviceId: 'backblaze_b2',
  serviceLabel: 'Backblaze B2',
  serviceURL: 'https://www.backblaze.com/cloud-storage',
  developerURL: 'https://www.backblaze.com/docs/cloud-storage-s3-compatible-api',
  apiKeyURL: 'https://secure.backblaze.com/app_keys.htm',
  apiKeyPattern: /^[A-Za-z0-9/+=]{30,}$/,
  /**
   * Add the B2 region endpoint and public URL to the library options, and disable ACLs.
   * @param {S3MediaLibrary} libOptions Library options.
   * @returns {S3Config} Resolved configuration.
   */
  resolveConfig: (libOptions) => ({
    ...libOptions,
    endpoint: `https://s3.${libOptions.region}.backblazeb2.com`,
    acl: false,
    public_url:
      libOptions.public_url ??
      `https://${libOptions.bucket}.s3.${libOptions.region}.backblazeb2.com`,
  }),
});
