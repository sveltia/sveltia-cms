import { isObject } from '@sveltia/utils/object';

import { cmsConfig } from '$lib/services/config/state';

/**
 * @import { MediaLibraryService } from '$lib/types/private';
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
 * @param {string} [siteDefaultName] Name of the library the site-level legacy option configures
 * when it has no `name`, e.g. `default`. When given, a legacy option, even a field-level one
 * naming the library, only applies to the library the site-level legacy option configures.
 * Default: none, so a nameless site-level legacy option configures no library.
 * @returns {MediaLibraries[T] | undefined} Options, `false` if the library is explicitly disabled,
 * or `undefined` if the library is not configured.
 */
export const findLibraryOptions = (libraryName, config, siteDefaultName) => {
  const options = config?.media_libraries?.[libraryName];

  if (options !== undefined && options !== null) {
    return /** @type {MediaLibraries[T]} */ (options);
  }

  const { media_library: legacyOptions } = config ?? {};
  const siteName = cmsConfig.current?.media_library?.name ?? siteDefaultName;

  return legacyOptions &&
    (legacyOptions.name ?? siteName) === libraryName &&
    (!siteDefaultName || siteName === libraryName)
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

/**
 * Get the names of the media libraries marked with the `default` option, which the Select Assets
 * dialog opens on instead of the first repository folder: those marked at the field level first,
 * then those marked at the site level, so the first one offered can be picked. A field can clear
 * the mark of a site-level one with `default: false`. Only the `media_libraries` map is read, as
 * the legacy `media_library` option configures a single library.
 * @param {MediaField} [fieldConfig] Field configuration.
 * @returns {(keyof MediaLibraries)[]} Library names.
 */
export const getPreferredLibraryNames = (fieldConfig) => {
  const fieldLibraries = fieldConfig?.media_libraries ?? {};
  const siteLibraries = cmsConfig.current?.media_libraries ?? {};
  /**
   * Get a library’s options in the given map, treating `null`, e.g. an empty YAML key, as not
   * configured, like {@link findLibraryOptions} does.
   * @param {Record<string, any>} libraries Library option map.
   * @param {string} name Library name.
   * @returns {any} Options.
   */
  const get = (libraries, name) => libraries[name] ?? undefined;

  // A library marked in the field itself comes first, then the site’s libraries in their order. A
  // library whose mark is inherited from the site is among the latter, even when the field
  // configures it too.
  const names = /** @type {(keyof MediaLibraries)[]} */ ([
    ...new Set([
      ...Object.keys(fieldLibraries).filter((name) => get(fieldLibraries, name)?.default === true),
      ...Object.keys(siteLibraries),
    ]),
  ]);

  return names.filter((name) => {
    // `all` holds shared defaults, not the options of a library
    if (name === 'all') {
      return false;
    }

    const options = mergeLibraryOptions(get(siteLibraries, name), get(fieldLibraries, name));

    return isObject(options) && options.default === true;
  });
};

/**
 * Get the cloud storage services that can take files from the CMS. A service without an upload
 * function, like Cloudinary, only takes files through its own widget.
 * @param {[string, MediaLibraryService][]} cloudServiceEntries Cloud storage services.
 * @returns {[string, MediaLibraryService][]} Services that can upload files.
 */
export const getUploadableServiceEntries = (cloudServiceEntries) =>
  cloudServiceEntries.filter(([, { upload }]) => !!upload);

/**
 * Find the first media library marked with the `default` option that’s offered.
 * @param {object} args Arguments.
 * @param {string[]} args.preferredLibraryNames Names of the media libraries marked with the
 * `default` option, in order of precedence, as returned by {@link getPreferredLibraryNames}.
 * `default` stands for the repository.
 * @param {boolean} args.repositoryAvailable Whether a repository folder is offered.
 * @param {[string, MediaLibraryService][]} args.cloudServiceEntries Cloud storage services offered.
 * @param {boolean} [args.uploadRequired] Whether the library has to take files to be uploaded,
 * which leaves out a cloud storage service that can’t upload them.
 * @returns {string | undefined} Library name, or `undefined` if none of the marked libraries is
 * offered.
 */
export const findPreferredLibraryName = ({
  preferredLibraryNames,
  repositoryAvailable,
  cloudServiceEntries,
  uploadRequired = false,
}) => {
  const serviceEntries = uploadRequired
    ? getUploadableServiceEntries(cloudServiceEntries)
    : cloudServiceEntries;

  return preferredLibraryNames.find((name) =>
    name === 'default'
      ? repositoryAvailable
      : serviceEntries.some(([serviceId]) => serviceId === name),
  );
};
