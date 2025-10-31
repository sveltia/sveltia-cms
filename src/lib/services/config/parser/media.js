/* eslint-disable camelcase */

import { get } from 'svelte/store';
import { _ } from 'svelte-i18n';

import { CLOUD_MEDIA_LIBRARIES } from '$lib/services/integrations/media-libraries';

/**
 * @import { SiteConfig } from '$lib/types/public';
 */

/**
 * Parse and validate media folder configuration.
 * @param {SiteConfig} config Raw config object.
 * @throws {Error} If there is an error in the media folder config.
 */
export const parseMediaConfig = (config) => {
  const { media_folder, public_folder, media_library, media_libraries } = config;

  if (media_folder === undefined) {
    // Require `media_folder` unless a cloud media library is configured
    if (
      !CLOUD_MEDIA_LIBRARIES.includes(/** @type {any} */ (media_library?.name ?? '')) &&
      !Object.keys(media_libraries || {}).some((name) =>
        CLOUD_MEDIA_LIBRARIES.includes(/** @type {any} */ (name)),
      )
    ) {
      throw new Error(get(_)('config.error.missing_media_folder'));
    }
  } else if (typeof media_folder !== 'string') {
    throw new Error(get(_)('config.error.invalid_media_folder'));
  }

  if (public_folder !== undefined) {
    if (typeof public_folder !== 'string') {
      throw new Error(get(_)('config.error.invalid_public_folder'));
    }

    if (/^\.{1,2}\//.test(public_folder)) {
      throw new Error(get(_)('config.error.public_folder_relative_path'));
    }

    if (/^https?:/.test(public_folder)) {
      throw new Error(get(_)('config.error.public_folder_absolute_url'));
    }
  }
};
