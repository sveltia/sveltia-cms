import { _ } from '@sveltia/i18n';
import { getPathInfo } from '@sveltia/utils/file';

/**
 * Get the localized label of the type of the given file, e.g. `PNG image`, from its extension. The
 * extension is matched case-insensitively, so `PHOTO.JPG` is labelled like `photo.jpg`. The MIME
 * subtype of a file can’t be used instead, as it doesn’t always match a label, e.g. `svg+xml`.
 * @param {string} fileName File name or path.
 * @param {object} [options] Options.
 * @param {string} [options.fallback] Label to use for an unknown type. Default: the extension in
 * upper case, or nothing if the file has no extension.
 * @returns {string} Label.
 */
export const getFileTypeLabel = (fileName, { fallback } = {}) => {
  const extension = getPathInfo(fileName).extension?.toLowerCase() ?? '';

  return _(`file_type_labels.${extension}`, { default: fallback ?? extension.toUpperCase() });
};
