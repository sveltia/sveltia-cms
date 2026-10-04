import { FIELD_TAG_PREFIX_REGEX } from '$lib/services/common/template/constants';

/**
 * @import { InternalCollection } from '$lib/types/private';
 */

/**
 * Remove the `fields.` prefix from a template tag, e.g. `fields.title` becomes `title`. A tag
 * without the prefix is returned as is.
 * @param {string} tag Template tag, without the surrounding braces.
 * @returns {string} Tag without the prefix, which is a field key path.
 */
export const stripFieldTagPrefix = (tag) => tag.replace(FIELD_TAG_PREFIX_REGEX, '');

/**
 * Split the name of a file at its last dot into the `{{filename}}` and `{{extension}}` template tag
 * values, as Netlify/Decap CMS does with `basename(path, extname(path))`. A name with several dots
 * like `my.post.md` keeps everything but the last extension, and a name without a dot has no
 * extension. Unlike `getPathInfo()`, any characters can follow the last dot, and `.tar.gz` is not
 * treated as a single extension.
 * @param {string} path File path or name.
 * @param {string[]} [localeSuffixes] Locale codes that can follow the file name, as the
 * `multiple_files` i18n structure names a file like `my-post.en.md`. A matching one is removed
 * from the file name, so it’s the same for every locale.
 * @returns {{ filename: string, extension: string }} File name without the extension, and the
 * extension without the leading dot.
 */
export const getFileNameParts = (path, localeSuffixes = []) => {
  const fileName = /** @type {string} */ (path.split('/').pop());
  const dotIndex = fileName.lastIndexOf('.');
  const extension = dotIndex === -1 ? '' : fileName.slice(dotIndex + 1);
  let filename = dotIndex === -1 ? fileName : fileName.slice(0, dotIndex);
  const locale = localeSuffixes.find((code) => filename.endsWith(`.${code}`));

  if (locale) {
    filename = filename.slice(0, -(locale.length + 1));
  }

  return { filename, extension };
};

/**
 * Get the locale codes that can follow an entry file name in the given collection, which are only
 * there with the `multiple_files` i18n structure.
 * @param {InternalCollection} collection Collection. Its i18n configuration can be missing from a
 * partial collection object, which is then treated as not localized.
 * @returns {string[]} Locale codes.
 */
export const getFileNameLocaleSuffixes = ({ _i18n }) =>
  _i18n?.structureMap?.i18nMultiFile ? _i18n.allLocales : [];
