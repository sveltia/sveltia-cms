import { get } from 'svelte/store';

import { siteConfig } from '$lib/services/config';

/**
 * @import { MediaField, MediaLibraries, MediaLibrary } from '$lib/types/public';
 */

/**
 * Helper to check `multiple` option in media libraries config.
 * @param {MediaLibraries | undefined} mediaLibraries Media libraries configuration.
 * @returns {boolean | undefined} Result of checking if any media library allows multiple files.
 */
const hasMultipleInMediaLibraries = (mediaLibraries) => {
  if (!mediaLibraries) {
    return undefined;
  }

  // @ts-ignore Stock Asset library doesn't have `config` property
  const multiArray = Object.values(mediaLibraries).map((lib) => lib.config?.multiple);

  if (multiArray.includes(true)) {
    return true;
  }

  if (multiArray.includes(false)) {
    return false;
  }

  return undefined;
};

/**
 * Helper to check `multiple` option in media library config.
 * @param {MediaLibrary | undefined} mediaLibrary Media library configuration.
 * @returns {boolean | undefined} Result of checking if any media library allows multiple files.
 */
const hasMultipleInMediaLibrary = (mediaLibrary) => {
  // @ts-ignore Stock Asset library doesn't have `config` property
  if (!mediaLibrary?.config) {
    return undefined;
  }

  // @ts-ignore Stock Asset library doesn't have `config` property
  const { multiple } = mediaLibrary.config;

  if (typeof multiple === 'boolean') {
    return multiple;
  }

  return undefined;
};

/**
 * Check if the field configuration allows multiple files.
 * @param {MediaField} fieldConfig Field configuration to check.
 * @returns {boolean} `true` if the field allows multiple files, `false` otherwise.
 */
export const isMultiple = (fieldConfig) => {
  const _siteConfig = get(siteConfig);

  return (
    fieldConfig.multiple ??
    hasMultipleInMediaLibraries(fieldConfig.media_libraries) ??
    hasMultipleInMediaLibrary(fieldConfig.media_library) ??
    hasMultipleInMediaLibraries(_siteConfig?.media_libraries) ??
    hasMultipleInMediaLibrary(_siteConfig?.media_library) ??
    false
  );
};
