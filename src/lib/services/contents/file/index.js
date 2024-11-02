import { escapeRegExp, stripSlashes } from '@sveltia/utils/string';
import { get, writable } from 'svelte/store';

/**
 * @type {import('svelte/store').Writable<Record<string, CustomFileFormat>>}
 */
export const customFileFormats = writable({});

/**
 * Get the file extension for the given collection.
 * @param {object} pathConfig - File’s path configuration. (part of `CollectionEntryFolder`).
 * @param {FileExtension} [pathConfig.extension] - File extension.
 * @param {FileFormat} [pathConfig.format] - File format.
 * @param {string} [pathConfig.file] - File name, e.g. `about.json`.
 * @returns {string} Determined extension.
 */
export const getFileExtension = ({ file, extension, format }) => {
  const customExtension = format ? get(customFileFormats)[format]?.extension : undefined;

  if (customExtension) {
    return customExtension;
  }

  if (extension) {
    return extension;
  }

  if (file) {
    return file.match(/[^.]+$/)?.[0] ?? 'md';
  }

  if (format === 'yml' || format === 'yaml') {
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
 * Get a regular expression that matches the entry paths of the given folder collection, taking i18n
 * into account.
 * @param {Collection} collection - Collection.
 * @returns {RegExp} Regular expression.
 */
export const getEntryPathRegEx = (collection) => {
  const {
    extension,
    format,
    folder,
    path,
    _i18n: { i18nEnabled, locales, structure },
  } = collection;

  const i18nMultiFiles = i18nEnabled && structure === 'multiple_files';
  const i18nMultiFolders = i18nEnabled && structure === 'multiple_folders';

  /**
   * The path pattern in the middle, which should match the filename (without extension),
   * possibly with the parent directory. If the collection’s `path` is configured, use it to
   * generate a pattern, so that unrelated files are excluded.
   * @see https://decapcms.org/docs/collection-folder/#folder-collections-path
   */
  const filePathMatcher = path
    ? `(?<filePath>${path.replace(/\//g, '\\/').replace(/{{.+?}}/g, '[^\\/]+')})`
    : '(?<filePath>.+)';

  const localeMatcher = `(?<locale>${locales.join('|')})`;

  return new RegExp(
    `^${escapeRegExp(stripSlashes(/** @type {string} */ (folder)))}\\/` +
      `${i18nMultiFolders ? `${localeMatcher}\\/` : ''}` +
      `${filePathMatcher}` +
      `${i18nMultiFiles ? `\\.${localeMatcher}` : ''}` +
      `\\.${getFileExtension({ format, extension })}$`,
  );
};

/**
 * Get the front matter format’s delimiters.
 * @param {FileFormat} format - File format.
 * @param {string | string[]} [delimiter] - Configured delimiter.
 * @returns {string[]} Start and end delimiters.
 */
export const getFrontMatterDelimiters = (format, delimiter) => {
  if (typeof delimiter === 'string' && delimiter.trim()) {
    return [delimiter, delimiter];
  }

  if (Array.isArray(delimiter) && delimiter.length === 2) {
    return delimiter;
  }

  if (format === 'json-frontmatter') {
    return ['{', '}'];
  }

  if (format === 'toml-frontmatter') {
    return ['+++', '+++'];
  }

  return ['---', '---'];
};
