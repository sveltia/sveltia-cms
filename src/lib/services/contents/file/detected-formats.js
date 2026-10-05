import { FRONTMATTER_DELIMITER_MAP } from '$lib/services/contents/file/constants';

/**
 * @import { FileConfig } from '$lib/types/private';
 * @import { FrontMatterFormat } from '$lib/types/public';
 */

/**
 * Front matter format detected in each file of a collection in the `frontmatter` format, keyed by
 * file path. Such a collection reads YAML, TOML and JSON front matter alike, and an existing file
 * is saved back in the format it was read in; only a new file gets YAML front matter.
 * @type {Map<string, FrontMatterFormat>}
 */
export const detectedFrontMatterFormats = new Map();

/**
 * Get the configuration to save a file with. In a collection in the `frontmatter` format, an
 * existing file keeps the front matter format it was read in, with the default delimiters of that
 * format unless the collection sets its own.
 * @param {object} args Arguments.
 * @param {FileConfig} args._file Configuration of the collection’s files.
 * @param {string} [args.previousPath] Path of the file before the save, if it exists.
 * @param {string} args.path Path of the file after the save, which takes over the detected format,
 * so the file keeps it once it has been renamed.
 * @returns {FileConfig} Configuration.
 */
export const getSavedFileConfig = ({ _file, previousPath, path }) => {
  if (_file.format !== 'frontmatter') {
    return _file;
  }

  const format = previousPath ? detectedFrontMatterFormats.get(previousPath) : undefined;

  if (!format) {
    return _file;
  }

  detectedFrontMatterFormats.set(path, format);

  return {
    ..._file,
    format,
    fmDelimiters: _file.fmDelimiters ?? FRONTMATTER_DELIMITER_MAP[format],
  };
};
