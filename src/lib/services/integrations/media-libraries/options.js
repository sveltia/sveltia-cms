import { cmsConfig } from '$lib/services/config/state';

/**
 * @import { CmsConfig, MediaField, MediaLibraries } from '$lib/types/public';
 */

/**
 * Find a media library’s options in the given site or field configuration, supporting both the
 * `media_libraries` map and the legacy `media_library` option.
 * @template {keyof MediaLibraries} T
 * @param {T} libraryName Library name.
 * @param {CmsConfig | MediaField | undefined} config Site or field configuration.
 * @returns {MediaLibraries[T] | undefined} Options, `false` if the library is explicitly disabled,
 * or `undefined` if the library is not configured.
 */
export const findLibraryOptions = (libraryName, config) =>
  config?.media_libraries?.[libraryName] ??
  (config?.media_library?.name === libraryName
    ? /** @type {MediaLibraries[T]} */ (config.media_library)
    : undefined);

/**
 * Resolve a media library’s options for the given field, falling back to the site configuration
 * when the field doesn’t configure the library.
 * @template {keyof MediaLibraries} T
 * @param {T} libraryName Library name.
 * @param {MediaField} [fieldConfig] Field configuration.
 * @returns {MediaLibraries[T] | undefined} Options, `false` if the library is explicitly disabled,
 * or `undefined` if the library is not configured.
 */
export const resolveLibraryOptions = (libraryName, fieldConfig) =>
  findLibraryOptions(libraryName, fieldConfig) ??
  findLibraryOptions(libraryName, cmsConfig.current);
