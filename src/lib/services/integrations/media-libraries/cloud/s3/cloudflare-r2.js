import { S3CompatibleService } from './service';

/**
 * @import { S3Config } from '$lib/types/private';
 * @import { S3MediaLibrary } from '$lib/types/public';
 */

/**
 * Map of Cloudflare R2 jurisdiction identifiers to their endpoint infixes.
 * @type {Record<string, string>}
 * @see https://github.com/sveltia/sveltia-cms/issues/752
 * @see https://developers.cloudflare.com/r2/reference/data-location/#jurisdictional-restrictions
 */
const JURISDICTION_INFIXES = {
  default: '',
  eu: 'eu.',
  fedramp: 'fedramp.',
};

/**
 * Build the Cloudflare R2 S3 API endpoint for the given account and jurisdiction.
 * @param {S3MediaLibrary} libOptions Library options.
 * @returns {string} Endpoint URL.
 */
const getEndpoint = ({ account_id: accountId, jurisdiction = 'default' }) => {
  const infix = JURISDICTION_INFIXES[jurisdiction] ?? '';

  return `https://${accountId}.${infix}r2.cloudflarestorage.com`;
};

/**
 * Cloudflare R2 media library service integration. R2 uses the `auto` region.
 */
export default new S3CompatibleService({
  serviceId: 'cloudflare_r2',
  serviceLabel: 'Cloudflare R2',
  serviceURL: 'https://www.cloudflare.com/developer-platform/r2/',
  developerURL: 'https://developers.cloudflare.com/r2/',
  apiKeyURL: 'https://dash.cloudflare.com/?to=/:account/r2/api-tokens',
  apiKeyPattern: /^[A-Za-z0-9/+=]{40,}$/,
  requiredOption: 'account_id',
  /**
   * Add the R2 endpoint and the `auto` region to the library options.
   * @param {S3MediaLibrary} libOptions Library options.
   * @returns {S3Config} Resolved configuration.
   */
  resolveConfig: (libOptions) => ({
    ...libOptions,
    region: 'auto',
    endpoint: getEndpoint(libOptions),
  }),
});
