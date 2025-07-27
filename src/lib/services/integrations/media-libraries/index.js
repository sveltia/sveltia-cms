import { get } from 'svelte/store';

import { siteConfig } from '$lib/services/config';

/**
 * @import { FileField, ImageField, MediaLibraryName } from '$lib/types/public';
 */

/**
 * Get any media library options. Support both new and legacy options at the field level and global.
 * @param {object} [options] Options.
 * @param {MediaLibraryName} [options.libraryName] Library name.
 * @param {FileField | ImageField} [options.fieldConfig] Field configuration.
 * @returns {Record<string, any>} Options.
 */
export const getMediaLibraryOptions = ({ libraryName = 'default', fieldConfig } = {}) => {
  const _siteConfig = get(siteConfig);

  // Priority 1: fieldConfig.media_libraries
  if (fieldConfig?.media_libraries?.[libraryName]) {
    return fieldConfig.media_libraries[libraryName];
  }

  // Priority 2: fieldConfig.media_library (legacy)
  if (fieldConfig?.media_library) {
    const siteLibName = _siteConfig?.media_library?.name ?? 'default';
    const fieldLib = fieldConfig.media_library;
    const fieldLibName = fieldLib.name;

    if (
      siteLibName === libraryName &&
      (fieldLibName === libraryName || fieldLibName === undefined)
    ) {
      return fieldLib;
    }
  }

  // Priority 3: siteConfig.media_libraries
  if (_siteConfig?.media_libraries?.[libraryName]) {
    return _siteConfig.media_libraries[libraryName];
  }

  // Priority 4: siteConfig.media_library (legacy)
  if (_siteConfig?.media_library?.name === libraryName) {
    return _siteConfig.media_library;
  }

  return {};
};
