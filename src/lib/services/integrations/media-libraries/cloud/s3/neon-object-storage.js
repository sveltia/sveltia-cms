import { S3CompatibleService } from './service';

/**
 * @import { S3Config } from '$lib/types/private';
 * @import { S3MediaLibrary } from '$lib/types/public';
 */

/**
 * Get the region from a Neon storage endpoint, e.g. `us-east-2` from
 * `https://br-cool-darkness-a1b2c3d4.storage.c-1.us-east-2.aws.neon.tech`.
 * @param {string} endpoint Endpoint URL.
 * @returns {string | undefined} Region, or `undefined` if the URL isn’t a Neon storage endpoint.
 */
export const getRegionFromEndpoint = (endpoint) =>
  endpoint.match(
    /^https:\/\/[^/]+\.storage\.(?:[^./]+\.)?([a-z]+-[a-z]+-\d+)\.aws\.neon\.tech(?:\/|$)/,
  )?.[1];

/**
 * Neon Object Storage media library service integration. Each Neon branch has its own S3 endpoint
 * (path-style), shown as `AWS_ENDPOINT_URL_S3` in the Neon Console, so `endpoint` is required
 * instead of a region; the region is read from the endpoint’s hostname. Objects in a `public_read`
 * bucket are served anonymously from `{endpoint}/{bucket}/{key}`, which is the URL the core uses
 * when `public_url` isn’t set. Neon doesn’t implement the `x-amz-acl` header, so no object ACL is
 * sent.
 * @see https://neon.com/docs/storage/s3-compatibility
 */
export default new S3CompatibleService({
  serviceId: 'neon_object_storage',
  serviceLabel: 'Neon Object Storage',
  serviceURL: 'https://neon.com/docs/storage/overview',
  developerURL: 'https://neon.com/docs/storage/get-started',
  apiKeyURL: 'https://neon.com/docs/storage/authentication',
  // `nsk_live_` followed by 64 hex digits. Kept loose on the environment label and the length.
  apiKeyPattern: /^nsk_[a-z]+_[0-9a-f]{32,}$/i,
  requiredOption: 'endpoint',
  /**
   * Add the region read from the endpoint to the library options, unless it’s set explicitly.
   * @param {S3MediaLibrary} libOptions Library options.
   * @returns {S3Config} Resolved configuration.
   */
  resolveConfig: (libOptions) => ({
    ...libOptions,
    region: libOptions.region ?? getRegionFromEndpoint(libOptions.endpoint ?? ''),
  }),
});
