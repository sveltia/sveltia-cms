import { S3CompatibleService } from './service';

/**
 * @import { S3Config } from '$lib/types/private';
 * @import { S3MediaLibrary } from '$lib/types/public';
 */

/**
 * Hostname pattern of a Neon Object Storage endpoint, e.g.
 * `br-cool-darkness-a1b2c3d4.storage.c-1.us-east-2.aws.neon.tech`, where `c-1` is the cell and
 * `us-east-2` the region. The cell is optional, in case a region has none.
 */
const ENDPOINT_HOSTNAME_REGEX =
  /^[a-z0-9-]+\.storage\.(?:[a-z0-9-]+\.)?([a-z]{2}-[a-z]+-\d+)\.aws\.neon\.tech$/;

/**
 * Parse the Neon Object Storage endpoint given in the library options. Anything other than an HTTPS
 * URL on a Neon storage hostname is rejected, so the signed requests can’t be sent to another host.
 * @param {S3MediaLibrary} libOptions Library options.
 * @returns {{ endpoint: string, region: string } | undefined} Normalized endpoint URL (origin only)
 * and the region in its hostname, or `undefined` if the endpoint is missing or invalid.
 */
const parseEndpoint = ({ endpoint }) => {
  const url = URL.parse(endpoint ?? '');

  if (url?.protocol !== 'https:' || url.port) {
    return undefined;
  }

  const [, region] = url.hostname.match(ENDPOINT_HOSTNAME_REGEX) ?? [];

  return region ? { endpoint: url.origin, region } : undefined;
};

/**
 * Neon Object Storage media library service integration. Each Neon branch has its own endpoint,
 * which includes a cell ID and can’t be derived from other options, so the user must set
 * `endpoint`. Objects are addressed path-style, which is also how a `public_read` bucket serves
 * them anonymously; a private bucket needs a `public_url`. Neon doesn’t implement object ACLs.
 * @see https://neon.com/docs/storage/s3-compatibility
 */
export default new S3CompatibleService({
  serviceId: 'neon_object_storage',
  serviceLabel: 'Neon Object Storage',
  serviceURL: 'https://neon.com/docs/storage/overview',
  developerURL: 'https://neon.com/docs/storage/s3-compatibility',
  apiKeyURL: 'https://neon.com/docs/storage/authentication',
  // `nsk_live_` followed by 64 hex digits
  apiKeyPattern: /^nsk_[a-z]+_[0-9a-f]{64}$/,
  requiredOption: 'endpoint',
  /**
   * Validate the endpoint and take the region from its hostname unless `region` is set.
   * @param {S3MediaLibrary} libOptions Library options.
   * @returns {S3Config} Resolved configuration. `endpoint` is `undefined` if invalid, which
   * disables the service.
   */
  resolveConfig: (libOptions) => {
    const parsed = parseEndpoint(libOptions);

    return {
      ...libOptions,
      endpoint: parsed?.endpoint,
      region: libOptions.region ?? parsed?.region,
    };
  },
});
