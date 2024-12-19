import { getPathInfo } from '@sveltia/utils/file';
import { escapeRegExp, stripSlashes } from '@sveltia/utils/string';

/**
 * @type {Record<string, CustomFileFormat>}
 */
export const customFileFormats = {};

/**
 * Detect a file extension from the given entry file configuration.
 * @param {object} args - Arguments.
 * @param {FileExtension} [args.extension] - Developer-defined file extension.
 * @param {FileFormat} [args.format] - Developer-defined file format.
 * @param {string} [args.path] - File path, e.g. `about.json`.
 * @returns {FileExtension} Determined extension.
 * @see https://decapcms.org/docs/configuration-options/#extension-and-format
 */
const detectFileExtension = ({ extension, format, path }) => {
  const customExtension = format ? customFileFormats[format]?.extension : undefined;

  if (customExtension) {
    return customExtension;
  }

  if (extension) {
    return extension;
  }

  if (path) {
    return getPathInfo(path).extension ?? 'md';
  }

  if (format === 'yaml' || format === 'yml') {
    return 'yml';
  }

  if (format === 'toml') {
    return 'toml';
  }

  if (format === 'json') {
    return 'json';
  }

  return 'md';
};

/**
 * Detect a file format from the given entry file configuration.
 * @param {object} args - Arguments.
 * @param {FileExtension} args.extension - File extension.
 * @param {FileFormat} [args.format] - Developer-defined file format.
 * @returns {FileFormat} Determined format.
 * @see https://decapcms.org/docs/configuration-options/#extension-and-format
 */
const detectFileFormat = ({ extension, format }) => {
  if (format) {
    return format; // supported or custom format
  }

  if (extension === 'yaml' || extension === 'yml') {
    return 'yaml';
  }

  if (extension === 'toml') {
    return 'toml';
  }

  if (extension === 'json') {
    return 'json';
  }

  if (['md', 'mkd', 'mkdn', 'mdwn', 'mdown', 'markdown'].includes(extension)) {
    return 'frontmatter'; // auto detect
  }

  return 'yaml-frontmatter';
};

/**
 * Get a regular expression that matches the entry paths of the given entry collection, taking the
 * i18n structure into account.
 * @param {object} args - Arguments.
 * @param {FileExtension} args.extension - File extension.
 * @param {FileFormat} args.format - File format.
 * @param {string} args.basePath - Normalized `folder` collection option.
 * @param {string} [args.subPath] - Normalized `path` collection option.
 * @param {I18nConfig} args._i18n - I18n configuration.
 * @returns {RegExp} Regular expression.
 */
const getEntryPathRegEx = ({ extension, format, basePath, subPath, _i18n }) => {
  const { i18nEnabled, structure, locales } = _i18n;
  const i18nMultiFile = i18nEnabled && structure === 'multiple_files';
  const i18nMultiFolder = i18nEnabled && structure === 'multiple_folders';

  /**
   * The path pattern in the middle, which should match the filename (without extension),
   * possibly with the parent directory. If the collection’s `path` is configured, use it to
   * generate a pattern, so that unrelated files are excluded.
   * @see https://decapcms.org/docs/collection-folder/#folder-collections-path
   */
  const filePathMatcher = subPath
    ? `(?<subPath>${subPath.replace(/\//g, '\\/').replace(/{{.+?}}/g, '[^/]+')})`
    : '(?<subPath>.+)';

  const localeMatcher = `(?<locale>${locales.join('|')})`;

  return new RegExp(
    `${basePath ? `^${escapeRegExp(basePath)}\\/` : '^'}` +
      `${i18nMultiFolder ? `${localeMatcher}\\/` : ''}` +
      `${filePathMatcher}` +
      `${i18nMultiFile ? `\\.${localeMatcher}` : ''}` +
      `\\.${detectFileExtension({ format, extension })}$`,
  );
};

/**
 * Detect the front matter format’s delimiters from the given entry file configuration.
 * @param {object} args - Arguments.
 * @param {FileFormat} args.format - File format.
 * @param {string | string[]} [args.delimiter] - Configured delimiter.
 * @returns {[string, string] | undefined} Start and end delimiters. If `undefined`, the parser
 * automatically detects the delimiters, while the formatter uses the YAML delimiters.
 * @see https://decapcms.org/docs/configuration-options/#frontmatter_delimiter
 */
export const getFrontMatterDelimiters = ({ format, delimiter }) => {
  if (typeof delimiter === 'string' && delimiter.trim()) {
    return [delimiter, delimiter];
  }

  if (Array.isArray(delimiter) && delimiter.length === 2) {
    return /** @type {[string, string]} */ (delimiter);
  }

  if (format === 'json-frontmatter') {
    return ['{', '}'];
  }

  if (format === 'toml-frontmatter') {
    return ['+++', '+++'];
  }

  if (format === 'yaml-frontmatter') {
    return ['---', '---'];
  }

  return undefined;
};

/**
 * Get the normalized entry file configuration for the given collection or collection file.
 * @param {object} args - Arguments.
 * @param {RawCollection} args.rawCollection - Developer-defined collection.
 * @param {RawCollectionFile} [args.file] - Developer-defined collection file.
 * @param {I18nConfig} args._i18n - I18n configuration.
 * @returns {FileConfig} Entry file configuration.
 */
export const getFileConfig = ({ rawCollection, file, _i18n }) => {
  const {
    folder,
    path: subPath,
    extension: _extension,
    format: _format,
    frontmatter_delimiter: delimiter,
    yaml_quote: yamlQuote = false,
  } = rawCollection;

  const isEntryCollection = typeof folder === 'string';
  const filePath = file?.file;
  const extension = detectFileExtension({ format: _format, extension: _extension, path: filePath });
  const format = detectFileFormat({ format: _format, extension });
  const basePath = isEntryCollection ? stripSlashes(folder) : undefined;

  return {
    extension,
    format,
    basePath,
    subPath: isEntryCollection ? subPath : undefined,
    fullPathRegEx:
      basePath !== undefined
        ? getEntryPathRegEx({ extension, format, basePath, subPath, _i18n })
        : undefined,
    fullPath: filePath
      ? stripSlashes(filePath).replace('{{locale}}', _i18n.defaultLocale)
      : undefined,
    fmDelimiters: getFrontMatterDelimiters({ format, delimiter }),
    yamlQuote,
  };
};
