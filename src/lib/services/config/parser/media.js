/* eslint-disable camelcase */

import { _ } from '@sveltia/i18n';

import { checkName } from '$lib/services/config/parser/utils/validator';
import { CLOUD_MEDIA_LIBRARY_NAMES } from '$lib/services/integrations/media-libraries/cloud';

/**
 * @import { CmsConfig } from '$lib/types/public';
 * @import { ConfigParserCollectors } from '$lib/types/private';
 */

/**
 * Parse and validate media folder configuration.
 * @param {CmsConfig} cmsConfig Raw CMS configuration.
 * @param {ConfigParserCollectors} collectors Collectors.
 * @throws {Error} If there is an error in the media folder config.
 */
export const parseMediaConfig = (cmsConfig, collectors) => {
  const { media_folder, public_folder, media_library, media_libraries, asset_collections } =
    cmsConfig;

  const { errors } = collectors;

  if (media_folder === undefined) {
    // Require `media_folder` unless a cloud media library is configured
    if (
      !CLOUD_MEDIA_LIBRARY_NAMES.includes(/** @type {any} */ (media_library?.name ?? '')) &&
      !Object.keys(media_libraries || {}).some((name) =>
        CLOUD_MEDIA_LIBRARY_NAMES.includes(/** @type {any} */ (name)),
      )
    ) {
      errors.add(_('config.error.missing_media_folder'));
    }
  } else if (typeof media_folder !== 'string') {
    errors.add(_('config.error.invalid_media_folder'));
  }

  if (public_folder !== undefined) {
    if (typeof public_folder !== 'string') {
      errors.add(_('config.error.invalid_public_folder'));
    } else {
      if (/^\.{1,2}\//.test(public_folder)) {
        errors.add(_('config.error.public_folder_relative_path'));
      }

      if (/^https?:/.test(public_folder)) {
        errors.add(_('config.error.public_folder_absolute_url'));
      }
    }
  }

  if (asset_collections !== undefined) {
    if (!Array.isArray(asset_collections)) {
      errors.add(_('config.error.invalid_asset_collections'));
    } else {
      const checkNameArgs = { nameCounts: {}, strKeyBase: 'asset_collection_name', collectors };

      asset_collections.forEach((assetCollection, index) => {
        const { name, media_folder: mediaFolder } = assetCollection;
        const context = { cmsConfig };

        if (checkName({ ...checkNameArgs, name, index, context })) {
          // media_folder is required
          if (typeof mediaFolder !== 'string') {
            errors.add(
              _('config.error.asset_collection_invalid_media_folder', { values: { name } }),
            );
          }
        }
      });
    }
  }
};
