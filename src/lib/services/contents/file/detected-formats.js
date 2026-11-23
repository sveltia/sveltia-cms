import { FRONTMATTER_DELIMITER_MAP } from '$lib/services/contents/file/constants';

/**
 * @import { FileConfig } from '$lib/types/private';
 * @import { FrontMatterFormat } from '$lib/types/public';
 */

/**
 * Get the configuration to save a file with. In a collection in the `frontmatter` format, an
 * existing file keeps the front matter format it was read in, with the default delimiters of that
 * format unless the collection sets its own; only a new file gets YAML front matter.
 * @param {object} args Arguments.
 * @param {FileConfig} args._file Configuration of the collection’s files.
 * @param {FrontMatterFormat} [args.format] Front matter format detected in the file before the
 * save, if it exists.
 * @returns {FileConfig} Configuration.
 */
export const getSavedFileConfig = ({ _file, format }) => {
  if (_file.format !== 'frontmatter' || !format) {
    return _file;
  }

  return {
    ..._file,
    format,
    configuredFormat: _file.format,
    fmDelimiters: _file.fmDelimiters ?? FRONTMATTER_DELIMITER_MAP[format],
  };
};
