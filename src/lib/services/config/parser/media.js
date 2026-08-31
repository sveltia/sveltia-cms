/* eslint-disable camelcase */

import { _ } from '@sveltia/i18n';

import { checkName } from '$lib/services/config/parser/utils/validator';
import { CLOUD_MEDIA_LIBRARY_NAMES } from '$lib/services/integrations/media-libraries/cloud';

/**
 * @import { CmsConfig } from '$lib/types/public';
 * @import { ConfigParserCollectors } from '$lib/types/private';
 */

/**
 * Check whether a cloud media library is configured, in which case an internal media folder is not
 * needed.
 * @param {CmsConfig} cmsConfig Raw CMS configuration.
 * @returns {boolean} Result.
 */
const hasCloudMediaLibrary = ({ media_library, media_libraries }) =>
  CLOUD_MEDIA_LIBRARY_NAMES.includes(/** @type {any} */ (media_library?.name ?? '')) ||
  Object.keys(media_libraries ?? {}).some((name) =>
    CLOUD_MEDIA_LIBRARY_NAMES.includes(/** @type {any} */ (name)),
  );

/**
 * Parse and validate media folder configuration. The type of each option is checked against the
 * JSON schema, so only the rules the schema can’t express are verified here.
 * @param {CmsConfig} cmsConfig Raw CMS configuration.
 * @param {ConfigParserCollectors} collectors Collectors.
 * @throws {Error} If there is an error in the media folder config.
 */
export const parseMediaConfig = (cmsConfig, collectors) => {
  const { media_folder, public_folder, asset_collections } = cmsConfig;
  const { errors } = collectors;

  if (media_folder === undefined && !hasCloudMediaLibrary(cmsConfig)) {
    errors.add(_('config.error.missing_media_folder'));
  }

  if (typeof public_folder === 'string') {
    if (/^\.{1,2}\//.test(public_folder)) {
      errors.add(_('config.error.public_folder_relative_path'));
    }

    if (/^https?:/.test(public_folder)) {
      errors.add(_('config.error.public_folder_absolute_url'));
    }
  }

  if (Array.isArray(asset_collections)) {
    const checkNameArgs = { nameCounts: {}, strKeyBase: 'asset_collection_name', collectors };

    asset_collections.forEach(({ name }, index) => {
      checkName({ ...checkNameArgs, name, index, context: { cmsConfig } });
    });
  }
};
