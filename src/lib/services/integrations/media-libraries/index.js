import { cmsConfig } from '$lib/services/config';
import { mergeLibraryOptions } from '$lib/services/integrations/media-libraries/options';

/**
 * @import { MediaField, MediaLibraryName } from '$lib/types/public';
 */

/**
 * Get any media library options. Support both new and legacy options at the field level and global.
 * The field-level options are merged over the global ones, one level deep.
 * @param {object} [options] Options.
 * @param {MediaLibraryName} [options.libraryName] Library name.
 * @param {MediaField} [options.fieldConfig] Field configuration.
 * @returns {Record<string, any> | false} Options, or `false` if the library is explicitly disabled.
 */
export const getMediaLibraryOptions = ({ libraryName = 'default', fieldConfig } = {}) => {
  const _cmsConfig = cmsConfig.current;
  // The legacy `media_library` option without a name configures the default library
  const siteLibName = _cmsConfig?.media_library?.name ?? 'default';

  /**
   * Find the library’s options in the field configuration.
   * @returns {Record<string, any> | false | undefined} Options, `false` if the library is
   * explicitly disabled, or `undefined` if the field doesn’t configure the library.
   */
  const getFieldOptions = () => {
    const opts = fieldConfig?.media_libraries?.[libraryName];

    // `media_libraries` (including explicit `false` to disable)
    if (opts !== undefined && opts !== null) {
      return opts;
    }

    // `media_library` (legacy), which applies to the site-level library if it has no name
    const fieldLib = fieldConfig?.media_library;

    return fieldLib &&
      siteLibName === libraryName &&
      (fieldLib.name === libraryName || fieldLib.name === undefined)
      ? fieldLib
      : undefined;
  };

  /**
   * Find the library’s options in the site configuration.
   * @returns {Record<string, any> | false | undefined} Options, `false` if the library is
   * explicitly disabled, or `undefined` if the site doesn’t configure the library.
   */
  const getSiteOptions = () => {
    const opts = _cmsConfig?.media_libraries?.[libraryName];

    // `media_libraries` (including explicit `false` to disable)
    if (opts !== undefined && opts !== null) {
      return opts;
    }

    // `media_library` (legacy)
    return _cmsConfig?.media_library && siteLibName === libraryName
      ? _cmsConfig.media_library
      : undefined;
  };

  const siteOptions = getSiteOptions();
  const fieldOptions = getFieldOptions();
  // The field-level options are merged over the site-level ones
  const opts = mergeLibraryOptions(siteOptions, fieldOptions);

  if (opts === false) {
    return false;
  }

  // `all` provides shared defaults merged into the `default` library’s `config`. Other libraries
  // (e.g. Cloudinary) pass `config` directly to their SDK, so we must not pollute it. The layers
  // are applied from the lowest priority: site-level `all`, site-level `config`, field-level `all`
  // and field-level `config`, so a field-level option always wins over a site-level one.
  if (libraryName !== 'default') {
    return { ...opts };
  }

  const config = {
    ..._cmsConfig?.media_libraries?.all,
    ...(siteOptions ? siteOptions.config : undefined),
    ...fieldConfig?.media_libraries?.all,
    ...(fieldOptions ? fieldOptions.config : undefined),
  };

  return opts?.config !== undefined || Object.keys(config).length > 0
    ? { ...opts, config }
    : { ...opts };
};
