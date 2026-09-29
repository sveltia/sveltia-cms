import { isObject } from '@sveltia/utils/object';

import { cmsConfig } from '$lib/services/config/state';

/**
 * @import { CmsConfig, MediaField, MediaLibraries } from '$lib/types/public';
 */

/**
 * Find a media library’s options in the given site or field configuration, supporting both the
 * `media_libraries` map and the legacy `media_library` option. A legacy `media_library` option
 * without a `name`, which is only valid at the field level, applies to the library named in the
 * site-level legacy option.
 * @template {keyof MediaLibraries} T
 * @param {T} libraryName Library name.
 * @param {CmsConfig | MediaField | undefined} config Site or field configuration.
 * @returns {MediaLibraries[T] | undefined} Options, `false` if the library is explicitly disabled,
 * or `undefined` if the library is not configured.
 */
export const findLibraryOptions = (libraryName, config) => {
  const options = config?.media_libraries?.[libraryName];

  if (options !== undefined && options !== null) {
    return options;
  }

  const { media_library: legacyOptions } = config ?? {};
  const legacyName = legacyOptions?.name ?? cmsConfig.current?.media_library?.name;

  return legacyOptions && legacyName === libraryName
    ? /** @type {MediaLibraries[T]} */ (legacyOptions)
    : undefined;
};

/**
 * Merge a media library’s field-level options over its site-level ones, so a field only needs to
 * set the options it overrides: the top-level properties are replaced, and those holding an object,
 * such as `config`, are merged one level deep. A field-level `false` disables the library for the
 * field, while field-level options enable a library the site disables.
 * @template {Record<string, any> | false | undefined} T
 * @param {T} siteOptions Site-level options, `false` if the library is explicitly disabled, or
 * `undefined` if the library is not configured.
 * @param {T} fieldOptions Field-level options, in the same form.
 * @returns {T} Merged options.
 */
export const mergeLibraryOptions = (siteOptions, fieldOptions) => {
  if (fieldOptions === undefined) {
    return siteOptions;
  }

  if (!fieldOptions || !siteOptions) {
    return fieldOptions;
  }

  /** @type {Record<string, any>} */
  const merged = { ...siteOptions, ...fieldOptions };

  Object.entries(fieldOptions).forEach(([key, value]) => {
    if (isObject(value) && isObject(siteOptions[key])) {
      merged[key] = { ...siteOptions[key], ...value };
    }
  });

  return /** @type {T} */ (merged);
};

/**
 * Resolve a media library’s options for the given field, with the field-level options merged over
 * the site-level ones. See {@link mergeLibraryOptions} for details.
 * @template {keyof MediaLibraries} T
 * @param {T} libraryName Library name.
 * @param {MediaField} [fieldConfig] Field configuration.
 * @returns {MediaLibraries[T] | undefined} Options, `false` if the library is explicitly disabled,
 * or `undefined` if the library is not configured.
 */
export const resolveLibraryOptions = (libraryName, fieldConfig) =>
  /** @type {MediaLibraries[T] | undefined} */ (
    mergeLibraryOptions(
      /** @type {any} */ (findLibraryOptions(libraryName, cmsConfig.current)),
      /** @type {any} */ (findLibraryOptions(libraryName, fieldConfig)),
    )
  );
