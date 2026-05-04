import { get } from 'svelte/store';

import { cmsConfig } from '$lib/services/config';

/**
 * @import { MediaField, MediaLibraryName } from '$lib/types/public';
 */

/**
 * Get any media library options. Support both new and legacy options at the field level and global.
 * @param {object} [options] Options.
 * @param {MediaLibraryName} [options.libraryName] Library name.
 * @param {MediaField} [options.fieldConfig] Field configuration.
 * @returns {Record<string, any> | false} Options, or `false` if the library is explicitly disabled.
 */
export const getMediaLibraryOptions = ({ libraryName = 'default', fieldConfig } = {}) => {
  const _cmsConfig = get(cmsConfig);

  // `all` provides shared defaults merged into the `default` library's `config`. Other libraries
  // (e.g. Cloudinary) pass `config` directly to their SDK, so we must not pollute it.
  const sharedConfig =
    libraryName === 'default'
      ? { ..._cmsConfig?.media_libraries?.all, ...fieldConfig?.media_libraries?.all }
      : undefined;

  // Merge shared options into the library config's `config` property (default library only).
  /**
   * Merge shared (`all`) options into library-specific options.
   * @param {Record<string, any> | null | undefined} opts Library-specific options.
   * @returns {Record<string, any>} Merged options.
   */
  const withShared = (opts) => ({
    ...opts,
    ...(sharedConfig &&
      Object.keys(sharedConfig).length > 0 && {
        config: { ...sharedConfig, ...opts?.config },
      }),
  });

  // Priority 1: fieldConfig.media_libraries (including explicit `false` to disable)
  if (fieldConfig?.media_libraries && libraryName in fieldConfig.media_libraries) {
    const opts = fieldConfig.media_libraries[libraryName];

    return opts === false ? false : withShared(opts);
  }

  // Priority 2: fieldConfig.media_library (legacy)
  if (fieldConfig?.media_library) {
    const siteLibName = _cmsConfig?.media_library?.name ?? 'default';
    const fieldLib = fieldConfig.media_library;
    const fieldLibName = fieldLib.name;

    if (
      siteLibName === libraryName &&
      (fieldLibName === libraryName || fieldLibName === undefined)
    ) {
      return withShared(fieldLib);
    }
  }

  // Priority 3: cmsConfig.media_libraries (including explicit `false` to disable)
  if (_cmsConfig?.media_libraries && libraryName in _cmsConfig.media_libraries) {
    const opts = _cmsConfig.media_libraries[libraryName];

    return opts === false ? false : withShared(opts);
  }

  // Priority 4: cmsConfig.media_library (legacy)
  if (_cmsConfig?.media_library?.name === libraryName) {
    return withShared(_cmsConfig.media_library);
  }

  return withShared(null);
};
