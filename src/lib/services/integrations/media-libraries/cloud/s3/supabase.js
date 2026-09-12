import { S3CompatibleService } from './service';

/**
 * @import { S3Config } from '$lib/types/private';
 * @import { S3MediaLibrary } from '$lib/types/public';
 */

/**
 * Build the Supabase Storage S3 API endpoint for the given project.
 * @param {S3MediaLibrary} libOptions Library options.
 * @returns {string} Endpoint URL.
 * @see https://supabase.com/docs/guides/storage/s3/authentication
 */
const getEndpoint = ({ project_id: projectId }) =>
  `https://${projectId}.storage.supabase.co/storage/v1/s3`;

/**
 * Build the Supabase Storage public base URL for the given project and bucket.
 * @param {S3MediaLibrary} libOptions Library options.
 * @returns {string} Public base URL (bucket included; key is appended by core).
 */
const getPublicUrl = ({ project_id: projectId, bucket }) =>
  `https://${projectId}.supabase.co/storage/v1/object/public/${bucket}`;

/**
 * Supabase Storage media library service integration.
 */
export default new S3CompatibleService({
  serviceId: 'supabase_storage',
  serviceLabel: 'Supabase Storage',
  serviceURL: 'https://supabase.com/storage',
  developerURL: 'https://supabase.com/docs/guides/storage',
  apiKeyURL: 'https://supabase.com/dashboard/project/_/storage/settings',
  apiKeyPattern: /^[A-Za-z0-9/+=]{40,}$/,
  requiredOption: 'project_id',
  /**
   * Add the Supabase S3 endpoint and public URL to the library options.
   * @param {S3MediaLibrary} libOptions Library options.
   * @returns {S3Config} Resolved configuration.
   */
  resolveConfig: (libOptions) => ({
    ...libOptions,
    endpoint: getEndpoint(libOptions),
    public_url: libOptions.public_url ?? getPublicUrl(libOptions),
  }),
});
