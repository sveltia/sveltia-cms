import cloudinary from './cloudinary';
import awsS3 from './s3/aws-s3';
import cloudflareR2 from './s3/cloudflare-r2';
import digitaloceanSpaces from './s3/digitalocean-spaces';
import uploadcare from './uploadcare';

/**
 * @import { MediaLibraryService } from '$lib/types/private';
 * @import { CloudMediaLibraryName } from '$lib/types/public';
 */

/**
 * List of all the supported cloud storage services.
 * @type {Record<string, MediaLibraryService>}
 */
export const allCloudStorageServices = {
  aws_s3: awsS3,
  cloudflare_r2: cloudflareR2, // S3-compatible
  cloudinary,
  digitalocean_spaces: digitaloceanSpaces, // S3-compatible
  uploadcare,
};

/**
 * List of all supported cloud media library names.
 * @type {CloudMediaLibraryName[]}
 */
export const CLOUD_MEDIA_LIBRARY_NAMES = /** @type {any} */ (Object.keys(allCloudStorageServices));
