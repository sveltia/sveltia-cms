import { S3CompatibleService } from './service';

/**
 * @import { S3Config } from '$lib/types/private';
 * @import { S3MediaLibrary } from '$lib/types/public';
 */

/**
 * Bunny Storage media library service integration. Bunny exposes an S3-compatible endpoint per
 * storage region (path-style), where the access key ID is the storage zone name and the secret
 * access key is the storage zone password. Since the storage zone name is also the bucket name,
 * `access_key_id` defaults to `bucket`. The storage endpoint always requires authentication, so the
 * user must front the zone with a pull zone and set its hostname as `public_url`. Bunny does not
 * support per-object ACLs; omit the `x-amz-acl` header on uploads.
 * @see https://bunny.net/docs/storage/s3
 */
export default new S3CompatibleService({
  serviceId: 'bunny_storage',
  serviceLabel: 'Bunny Storage',
  serviceURL: 'https://bunny.net/storage/',
  developerURL: 'https://bunny.net/docs/storage/s3',
  apiKeyURL: 'https://dash.bunny.net/storage',
  // Hyphen-separated hex groups, e.g. `a2350e09-57ec-3f4e-d7a38d0858a6-a5c7-47aa`. Kept loose on
  // the group count and length, as Bunny doesn’t document the exact format.
  apiKeyPattern: /^[0-9a-f]{8}(?:-[0-9a-f]{4,12}){3,7}$/i,
  /**
   * Add the Bunny region endpoint to the library options, default the access key ID to the storage
   * zone name, and disable ACLs.
   * @param {S3MediaLibrary} libOptions Library options.
   * @returns {S3Config} Resolved configuration.
   */
  resolveConfig: (libOptions) => ({
    ...libOptions,
    access_key_id: libOptions.access_key_id ?? libOptions.bucket,
    endpoint: `https://${libOptions.region}-s3.storage.bunnycdn.com`,
    acl: false,
  }),
});
