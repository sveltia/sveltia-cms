import { get } from 'svelte/store';
import { siteConfig } from '$lib/services/config';

/**
 * @import { FileField, ImageField } from '$lib/types/public';
 */

/**
 * Get a default media library option. Support both new and legacy options at the field level and
 * global.
 * @param {'max_file_size'} key Option key.
 * @param {ImageField | FileField} [fieldConfig] Field configuration.
 * @returns {any} Option.
 */
const getMediaLibraryOption = (key, fieldConfig) => {
  const _siteConfig = get(siteConfig);

  return (
    fieldConfig?.media_libraries?.default?.config?.[key] ??
    fieldConfig?.media_library?.config?.[key] ??
    _siteConfig?.media_libraries?.default?.config?.[key] ??
    (_siteConfig?.media_library?.name === 'default'
      ? _siteConfig.media_library.config?.[key]
      : undefined)
  );
};

/**
 * Get the maximum file size for uploads.
 * @param {ImageField | FileField} [fieldConfig] Field configuration.
 * @returns {number} Size.
 */
export const getMaxFileSize = (fieldConfig) => {
  const size = getMediaLibraryOption('max_file_size', fieldConfig);

  if (typeof size === 'number' && Number.isInteger(size)) {
    return size;
  }

  return Infinity;
};
