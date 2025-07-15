import { getPathInfo } from '@sveltia/utils/file';
import { escapeRegExp, stripSlashes } from '@sveltia/utils/string';
import { isEntryCollection } from '$lib/services/contents/collection';
import { getIndexFile } from '$lib/services/contents/collection/index-file';
import { getLocalePath } from '$lib/services/contents/i18n';

/**
 * @import { CustomFileFormat, FileConfig, InternalI18nOptions } from '$lib/types/private';
 * @import { Collection, CollectionFile, FileExtension, FileFormat } from '$lib/types/public';
 */

/**
 * @type {Record<string, CustomFileFormat>}
 */
export const customFileFormats = {};

/**
 * Detect a file extension from the given entry file configuration.
 * @param {object} args Arguments.
 * @param {FileExtension} [args.extension] Developer-defined file extension.
 * @param {FileFormat} [args.format] Developer-defined file format.
 * @returns {FileExtension} Determined extension.
 * @see https://decapcms.org/docs/configuration-options/#extension-and-format
 */
const detectFileExtension = ({ extension, format }) => {
  const customExtension = format ? customFileFormats[format]?.extension : undefined;

  if (customExtension) {
    return customExtension;
  }

  if (extension) {
    return extension;
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
 * @param {object} args Arguments.
 * @param {FileExtension} args.extension File extension.
 * @param {FileFormat} [args.format] Developer-defined file format.
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
 * @param {object} args Arguments.
 * @param {FileExtension} args.extension File extension.
 * @param {FileFormat} args.format File format.
 * @param {string} args.basePath Normalized `folder` collection option.
 * @param {string} [args.subPath] Normalized `path` collection option.
 * @param {string} [args.indexFileName] File name for index file inclusion. Typically `_index`.
 * @param {InternalI18nOptions} args._i18n I18n configuration.
 * @returns {RegExp} Regular expression.
 */
const getEntryPathRegEx = ({ extension, format, basePath, subPath, indexFileName, _i18n }) => {
  const { i18nEnabled, structure, allLocales, defaultLocale, omitDefaultLocaleFromFileName } =
    _i18n;

  const i18nMultiFile = i18nEnabled && structure === 'multiple_files';
  const i18nMultiFolder = i18nEnabled && structure === 'multiple_folders';
  const i18nRootMultiFolder = i18nEnabled && structure === 'multiple_folders_i18n_root';

  /**
   * The path pattern in the middle, which should match the filename (without extension),
   * possibly with the parent directory. If the collection’s `path` is configured, use it to
   * generate a pattern, so that unrelated files are excluded.
   * @see https://decapcms.org/docs/collection-folder/#folder-collections-path
   */
  const filePathMatcher = subPath
    ? `(?<subPath>${subPath
        .replace(/\//g, '\\/')
        .replace(/{{.+?}}/g, '[^/]+?')}${indexFileName ? `|${indexFileName}` : ''})`
    : '(?<subPath>[^/]+?)';

  const localeMatcher = `(?<locale>${allLocales.join('|')})`;

  const pattern = [
    '^',
    i18nRootMultiFolder ? `${localeMatcher}\\/` : '',
    basePath ? `${escapeRegExp(basePath)}\\/` : '',
    i18nMultiFolder ? `${localeMatcher}\\/` : '',
    filePathMatcher,
    i18nMultiFile
      ? omitDefaultLocaleFromFileName
        ? `(?:\\.(?<locale>${allLocales.filter((locale) => locale !== defaultLocale).join('|')}))?`
        : `\\.${localeMatcher}`
      : '',
    '\\.',
    detectFileExtension({ format, extension }),
    '$',
  ].join('');

  return new RegExp(pattern);
};

/**
 * Detect the front matter format’s delimiters from the given entry file configuration.
 * @param {object} args Arguments.
 * @param {FileFormat} args.format File format.
 * @param {string | string[]} [args.delimiter] Configured delimiter.
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
 * Whether the deprecated `yaml_quote` collection option is warned.
 * @todo Remove the option prior to the 1.0 release.
 */
let yamlQuoteWarnedOnce = false;

/**
 * Get the normalized entry file configuration for the given collection or collection file.
 * @param {object} args Arguments.
 * @param {Collection} args.rawCollection Developer-defined collection.
 * @param {CollectionFile} [args.file] Developer-defined collection file.
 * @param {InternalI18nOptions} args._i18n I18n configuration.
 * @returns {FileConfig} Entry file configuration.
 */
export const getFileConfig = ({ rawCollection, file, _i18n }) => {
  const {
    folder,
    path: subPath,
    extension: _extension,
    format: _format,
    frontmatter_delimiter: _delimiter,
    yaml_quote: yamlQuote,
  } = rawCollection;

  const _isEntryCollection = isEntryCollection(rawCollection);
  const filePath = file?.file ? stripSlashes(file.file) : undefined;
  const __extension = filePath ? getPathInfo(filePath).extension : _extension;
  const __format = file?.format ?? _format;
  const extension = detectFileExtension({ format: __format, extension: __extension });
  const format = detectFileFormat({ format: __format, extension });
  const delimiter = file?.frontmatter_delimiter ?? _delimiter;
  const basePath = _isEntryCollection ? stripSlashes(/** @type {string} */ (folder)) : undefined;
  const indexFileName = _isEntryCollection ? getIndexFile(rawCollection)?.name : undefined;

  if (yamlQuote !== undefined && !yamlQuoteWarnedOnce) {
    yamlQuoteWarnedOnce = true;
    // eslint-disable-next-line no-console
    console.warn(
      'The yaml_quote collection option is deprecated and will be removed in Sveltia CMS 1.0. ' +
        'Use the global output.yaml.quote option instead. ' +
        'https://github.com/sveltia/sveltia-cms#controlling-data-output',
    );
  }

  return {
    extension,
    format,
    basePath,
    subPath: _isEntryCollection ? subPath : undefined,
    fullPathRegEx:
      basePath !== undefined
        ? getEntryPathRegEx({ extension, format, basePath, subPath, indexFileName, _i18n })
        : undefined,
    fullPath: filePath
      ? getLocalePath({ _i18n, locale: _i18n.defaultLocale, path: filePath })
      : undefined,
    fmDelimiters: getFrontMatterDelimiters({ format, delimiter }),
    yamlQuote: !!yamlQuote,
  };
};
