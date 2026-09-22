import { getPathInfo } from '@sveltia/utils/file';
import { escapeRegExp, stripSlashes } from '@sveltia/utils/string';

import { customFileFormatRegistry } from '$lib/services/api/registries';
import { ESCAPED_PLACEHOLDER_REGEX } from '$lib/services/common/template/constants';
import { warnDeprecation } from '$lib/services/config/deprecations';
import { isEntryCollection } from '$lib/services/contents/collection';
import { getIndexFile } from '$lib/services/contents/collection/entries/index-file';
import { getNestedConfig } from '$lib/services/contents/collection/nested';
import {
  EXTENSION_FORMAT_MAP,
  FORMAT_EXTENSION_MAP,
  FRONTMATTER_DELIMITER_MAP,
  MARKDOWN_EXTENSIONS,
} from '$lib/services/contents/file';
import { getLocalePath } from '$lib/services/contents/i18n';
import {
  getLocaleFolderPattern,
  hasLocalePlaceholder,
} from '$lib/services/contents/i18n/placeholder';

/**
 * @import {
 * FileConfig,
 * InternalCollection,
 * InternalCollectionFile,
 * InternalEntryCollection,
 * InternalI18nOptions,
 * } from '$lib/types/private';
 * @import {
 * Collection,
 * CollectionFile,
 * CollectionIndexFile,
 * FileExtension,
 * FileFormat,
 * } from '$lib/types/public';
 */

/**
 * Detect a file extension from the given entry file configuration.
 * @param {object} args Arguments.
 * @param {FileExtension} [args.extension] Developer-defined file extension.
 * @param {FileFormat} [args.format] Developer-defined file format.
 * @returns {FileExtension} Determined extension.
 * @see https://decapcms.org/docs/configuration-options/#extension-and-format
 * @see https://sveltiacms.app/en/docs/collections/entries/formats
 */
export const detectFileExtension = ({ extension, format }) => {
  const customExtension = format ? customFileFormatRegistry.get(format)?.extension : undefined;

  if (customExtension) {
    return customExtension;
  }

  if (extension) {
    return extension;
  }

  if (format) {
    return FORMAT_EXTENSION_MAP[format] ?? 'md';
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
 * @see https://sveltiacms.app/en/docs/collections/entries/formats
 */
export const detectFileFormat = ({ extension, format }) => {
  if (format) {
    return format; // supported or custom format
  }

  if (MARKDOWN_EXTENSIONS.includes(extension)) {
    return 'frontmatter'; // auto detect
  }

  return EXTENSION_FORMAT_MAP[extension] ?? 'yaml-frontmatter';
};

/**
 * Get the file path matcher pattern for the regex. The path pattern in the middle should match the
 * filename (without extension), possibly with the parent directory. If the collection’s `path` is
 * configured, use it to generate a pattern, so that unrelated files are excluded. Note that the
 * `path` may contain `{{variable}}` placeholders, which should be replaced with a non-greedy
 * wildcard that excludes slashes. It may also contain brackets, like `app/(pages)`, which are used
 * for route groups in frameworks like SvelteKit or Next.js, and should be matched literally.
 * @param {object} args Arguments.
 * @param {string} [args.subPath] Normalized `path` collection option.
 * @param {string} [args.indexFileName] File name for index file inclusion. Typically `_index`.
 * @param {number} [args.nestedDepth] Maximum number of path segments below the collection folder,
 * for a nested collection. `undefined` for a regular collection, where an entry is always a direct
 * child of the collection folder.
 * @param {string} [args.entrySuffix] Lookahead pattern for what follows an entry’s sub path (the
 * locale and extension) when the index file has an extension of its own.
 * @param {string} [args.indexSuffix] Lookahead pattern for what follows the index file’s sub path,
 * when the index file has an extension of its own.
 * @returns {string} File path matcher pattern.
 * @see https://decapcms.org/docs/collection-folder/#folder-collections-path
 * @see https://decapcms.org/docs/collection-nested/
 * @see https://sveltiacms.app/en/docs/collections/entries/slugs#file-paths
 */
const getFilePathMatcher = ({
  subPath,
  indexFileName,
  nestedDepth,
  entrySuffix = '',
  indexSuffix = '',
}) => {
  const escapedIndexFileName = indexFileName ? escapeRegExp(indexFileName) : '';
  // An index file with an extension of its own is told apart from the entries by that extension,
  // and it can only be right under the collection folder, where the special index file is
  const separateIndex = !!escapedIndexFileName && !!indexSuffix;
  const indexAlternative = escapedIndexFileName && !separateIndex ? `|${escapedIndexFileName}` : '';
  /** @type {string} */
  let entryMatcher;

  if (!subPath) {
    if (nestedDepth === undefined) {
      entryMatcher = '[^/]+?';
    } else {
      // An entry can be stored in any folder below the collection folder, down to the configured
      // depth. The depth is the number of path segments, the last of which is the file name.
      const extraSegments = Number.isFinite(nestedDepth)
        ? `{0,${Math.max(0, nestedDepth - 1)}}`
        : '*';

      entryMatcher = `[^/]+?(?:\\/[^/]+?)${extraSegments}`;
    }
  } else {
    const escapedSubPath = escapeRegExp(subPath).replace(ESCAPED_PLACEHOLDER_REGEX, '[^/]+?');
    const fileMatcher = `${escapedSubPath}${indexAlternative}`;

    if (nestedDepth === undefined) {
      entryMatcher = fileMatcher;
    } else {
      // In a nested collection, the `path` option says where an entry sits within the folder
      // holding it, not within the collection folder, so any number of folders can come first —
      // down to the configured depth, which the `path` option itself already takes some of
      const remainingDepth = Number.isFinite(nestedDepth)
        ? Math.max(0, nestedDepth - subPath.split('/').length)
        : undefined;

      const folderMatcher =
        remainingDepth === undefined ? '(?:[^/]+\\/)*' : `(?:[^/]+\\/){0,${remainingDepth}}`;

      entryMatcher = `${folderMatcher}(?:${fileMatcher})`;
    }
  }

  if (!separateIndex) {
    return `(?<subPath>${entryMatcher})`;
  }

  // The index file’s name is reserved: an entry going by the same name, like `posts.md` beside
  // `posts.json`, would get the same sub path and be opened in its place, so it’s left out of the
  // collection altogether
  const reservedNameMatcher = `(?!${escapedIndexFileName}${entrySuffix})`;

  return (
    `(?<subPath>${reservedNameMatcher}(?:${entryMatcher})${entrySuffix}` +
    `|${escapedIndexFileName}${indexSuffix})`
  );
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
 * @param {FileExtension} [args.indexFileExtension] File extension of the index file, if it can
 * differ from the entries’. Default: `extension`.
 * @param {number} [args.nestedDepth] Maximum number of path segments below the collection folder,
 * for a nested collection.
 * @param {InternalI18nOptions} args._i18n I18n configuration.
 * @returns {RegExp} Regular expression.
 */
export const getEntryPathRegEx = ({
  extension,
  format,
  basePath,
  subPath,
  indexFileName,
  indexFileExtension,
  nestedDepth,
  _i18n,
}) => {
  const {
    allLocales,
    defaultLocale,
    omitDefaultLocaleFromFilePath,
    structureMap: { i18nMultiFile, i18nMultiFolder, i18nMultiRootFolder },
  } = _i18n;

  const localeMatcher = `(?<locale>${allLocales.join('|')})`;
  const joinedNonDefaultLocales = allLocales.filter((locale) => locale !== defaultLocale).join('|');

  const localeFolderMatcher = omitDefaultLocaleFromFilePath
    ? `(?:(?<locale>${joinedNonDefaultLocales})\\/)?`
    : `${localeMatcher}\\/`;

  const localeFileMatcher = omitDefaultLocaleFromFilePath
    ? `(?:\\.(?<locale>${joinedNonDefaultLocales}))?`
    : `\\.${localeMatcher}`;

  // The `{{locale}}` placeholder in the `folder` option says where the locale folder goes, so the
  // locale folder matcher replaces it rather than coming before or after the whole base path
  const localeInBasePath = !!basePath && hasLocalePlaceholder(basePath);

  const basePathMatcher = localeInBasePath
    ? getLocaleFolderPattern(basePath, localeFolderMatcher)
    : basePath
      ? `${escapeRegExp(basePath)}\\/`
      : '';

  const entryExtension = detectFileExtension({ format, extension });

  // An index file with an extension of its own, like Eleventy’s `posts/posts.json` beside `.md`
  // entries, is matched by its extension: each alternative of the sub path matcher looks ahead for
  // its own extension, so an unrelated file with either extension is left out. The lookahead can’t
  // declare the `locale` group a second time, so it uses a capture-free copy of the locale matcher
  const indexExtension =
    indexFileName && indexFileExtension !== undefined && indexFileExtension !== entryExtension
      ? indexFileExtension
      : undefined;

  /**
   * Build a lookahead for the end of a file path with the given extension.
   * @param {string} ext File extension.
   * @returns {string} Pattern.
   */
  const getSuffixMatcher = (ext) => {
    const localeMatcherCopy = omitDefaultLocaleFromFilePath
      ? `(?:\\.(?:${joinedNonDefaultLocales}))?`
      : `\\.(?:${allLocales.join('|')})`;

    return `(?=${i18nMultiFile ? localeMatcherCopy : ''}\\.${escapeRegExp(ext)}$)`;
  };

  const pattern = [
    '^',
    i18nMultiRootFolder && !localeInBasePath ? localeFolderMatcher : '',
    basePathMatcher,
    i18nMultiFolder && !localeInBasePath ? localeFolderMatcher : '',
    getFilePathMatcher({
      subPath,
      indexFileName,
      nestedDepth,
      entrySuffix: indexExtension ? getSuffixMatcher(entryExtension) : '',
      indexSuffix: indexExtension ? getSuffixMatcher(indexExtension) : '',
    }),
    i18nMultiFile ? localeFileMatcher : '',
    '\\.',
    indexExtension
      ? `(?:${escapeRegExp(entryExtension)}|${escapeRegExp(indexExtension)})`
      : escapeRegExp(entryExtension),
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
 * @see https://sveltiacms.app/en/docs/collections/entries/formats#front-matter-delimiter
 */
export const getFrontMatterDelimiters = ({ format, delimiter }) => {
  if (typeof delimiter === 'string' && delimiter.trim()) {
    return [delimiter, delimiter];
  }

  if (Array.isArray(delimiter) && delimiter.length === 2) {
    return /** @type {[string, string]} */ (delimiter);
  }

  return FRONTMATTER_DELIMITER_MAP[format] ?? undefined;
};

/**
 * Get the extension and format of the collection’s special index file, when it has its own. An
 * Eleventy directory data file, for example, is a `posts/posts.json` file in a folder of Markdown
 * entries.
 * @param {object} args Arguments.
 * @param {CollectionIndexFile} [args.indexFile] Normalized index file configuration.
 * @param {FileExtension} [args.extension] Developer-defined collection file extension.
 * @param {FileFormat} [args.format] Developer-defined collection file format.
 * @returns {{ extension: FileExtension, format: FileFormat } | undefined} Extension and format,
 * or `undefined` if the index file has the same extension and format as the entries.
 */
export const getIndexFileFormat = ({ indexFile, extension, format }) => {
  if (!indexFile) {
    return undefined;
  }

  const { extension: _indexExtension, format: _indexFormat } = indexFile;

  if (_indexExtension === undefined && _indexFormat === undefined) {
    return undefined;
  }

  const indexExtension = detectFileExtension({ extension: _indexExtension, format: _indexFormat });
  const indexFormat = detectFileFormat({ extension: indexExtension, format: _indexFormat });
  const entryExtension = detectFileExtension({ extension, format });
  const entryFormat = detectFileFormat({ extension: entryExtension, format });

  if (indexExtension === entryExtension && indexFormat === entryFormat) {
    return undefined;
  }

  return { extension: indexExtension, format: indexFormat };
};

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
    // @ts-ignore
    folder,
    // @ts-ignore
    path: subPath,
    // @ts-ignore
    extension: _extension,
    format: _format,
    frontmatter_delimiter: _delimiter,
    body_field: bodyField,
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
  const indexFile = _isEntryCollection ? getIndexFile(rawCollection) : undefined;
  const indexFileName = indexFile?.name;
  const nestedDepth = _isEntryCollection ? getNestedConfig(rawCollection)?.depth : undefined;

  const indexFileFormat = getIndexFileFormat({
    indexFile,
    extension: _extension,
    format: _format,
  });

  // @todo Remove the option prior to the 1.0 release.
  if (yamlQuote !== undefined) {
    warnDeprecation('yaml_quote');
  }

  /** @type {FileConfig} */
  const config = {
    extension,
    format,
    basePath,
    subPath: _isEntryCollection ? subPath : undefined,
    fullPathRegEx:
      basePath !== undefined
        ? getEntryPathRegEx({
            extension,
            format,
            basePath,
            subPath,
            indexFileName,
            indexFileExtension: indexFileFormat?.extension,
            nestedDepth,
            _i18n,
          })
        : undefined,
    fullPath: filePath
      ? getLocalePath({ _i18n, locale: _i18n.defaultLocale, path: filePath })
      : undefined,
    fmDelimiters: getFrontMatterDelimiters({ format, delimiter }),
    bodyField: file?.body_field ?? bodyField,
    yamlQuote: !!yamlQuote,
  };

  if (indexFileFormat) {
    // The index file shares the rest of the configuration with the entries, including the path
    // matcher, which matches both
    config.indexFile = {
      ...config,
      ...indexFileFormat,
      fmDelimiters: getFrontMatterDelimiters({ format: indexFileFormat.format, delimiter }),
    };
  }

  return config;
};

/**
 * Get the file configuration that applies to an entry: a collection file’s for a file/singleton
 * collection, the index file’s for an entry collection’s special index file with an extension or
 * format of its own, or the collection’s.
 * @param {object} args Arguments.
 * @param {InternalCollection} args.collection Collection.
 * @param {InternalCollectionFile} [args.collectionFile] Collection file. File/singleton collection
 * only.
 * @param {boolean} [args.isIndexFile] Whether the entry is the collection’s special index file.
 * @returns {FileConfig} File configuration.
 */
export const resolveFileConfig = ({ collection, collectionFile, isIndexFile = false }) => {
  const { _file } = collectionFile ?? /** @type {InternalEntryCollection} */ (collection);

  return (isIndexFile ? _file.indexFile : undefined) ?? _file;
};
