/* eslint-disable jsdoc/require-jsdoc */

import { generateUUID } from '@sveltia/utils/crypto';
import { getPathInfo } from '@sveltia/utils/file';
import { isObject, toRaw } from '@sveltia/utils/object';
import { escapeRegExp, stripSlashes } from '@sveltia/utils/string';
import { flatten } from 'flat';
import * as TOML from 'smol-toml';
import { get, writable } from 'svelte/store';
import YAML from 'yaml';
import { normalizeSlug } from '$lib/services/contents/slug';
import { getCollection } from '$lib/services/contents';

/**
 * @type {import('svelte/store').Writable<Record<string, CustomFileProcessor>>}
 */
export const customFileProcessors = writable({});

/**
 * Get the file extension for the given collection.
 * @param {object} pathConfig - File’s path configuration. (part of `CollectionEntryFolder`).
 * @param {FileExtension} [pathConfig.extension] - File extension.
 * @param {FileFormat} [pathConfig.format] - File format.
 * @param {string} [pathConfig.file] - File name, e.g. `about.json`.
 * @returns {string} Determined extension.
 */
export const getFileExtension = ({ file, extension, format }) => {
  const customExtension = format ? get(customFileProcessors)[format]?.extension : undefined;

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
 * Get the Frontmatter format’s delimiters.
 * @param {FileFormat} format - File format.
 * @param {string | string[]} [delimiter] - Configured delimiter.
 * @returns {string[]} Start and end delimiters.
 */
const getFrontmatterDelimiters = (format, delimiter) => {
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

/**
 * Determine the Markdown front matter serialization format by checking a delimiter in the content.
 * @param {string} text - File content.
 * @returns {FrontMatterFormat | undefined} One of the formats or `undefined` if undetermined.
 */
const detectFrontMatterFormat = (text) => {
  if (text.startsWith('---')) {
    return 'yaml-frontmatter';
  }

  if (text.startsWith('+++')) {
    return 'toml-frontmatter';
  }

  if (text.startsWith('{')) {
    return 'json-frontmatter';
  }

  return undefined;
};

/**
 * Parse TOML. The TOML parser returns date fields as `Date` objects, but we need strings to match
 * the JSON and YAML parsers, so we have to parse twice.
 * @param {string} str - TOML data.
 * @returns {object} Parsed object.
 */
const parseTOML = (str) => toRaw(TOML.parse(str));

/**
 * Parse raw content with given file details.
 * @param {BaseEntryListItem} entry - File entry.
 * @returns {RawEntryContent} Parsed content.
 * @throws {Error} When the content could not be parsed.
 */
const parseEntryFile = ({
  text = '',
  path,
  folder: {
    filePathMap,
    parserConfig: { extension, format, frontmatterDelimiter },
  },
}) => {
  text = text.trim();

  format ||= /** @type {FileFormat | undefined} */ (
    ['md', 'markdown'].includes(extension ?? '') || path.match(/\.(?:md|markdown)$/)
      ? detectFrontMatterFormat(text)
      : extension || Object.values(filePathMap ?? {})[0]?.match(/\.([^.]+)$/)?.[1]
  );

  if (format === 'frontmatter') {
    format = detectFrontMatterFormat(text);
  }

  // Ignore files with unknown format
  if (!format) {
    throw new Error(`${path} could not be parsed due to an unknown format`);
  }

  const customParser = get(customFileProcessors)[format]?.parser;

  if (customParser) {
    return customParser(text);
  }

  try {
    if (format.match(/^ya?ml$/)) {
      return YAML.parse(text);
    }

    if (format === 'toml') {
      return parseTOML(text);
    }

    if (format === 'json') {
      return JSON.parse(text);
    }

    if (format.match(/^(?:yaml|toml|json)-frontmatter$/)) {
      const [startDelimiter, endDelimiter] = getFrontmatterDelimiters(format, frontmatterDelimiter);

      const [, head, body = ''] =
        text.match(
          new RegExp(
            `^${escapeRegExp(startDelimiter)}\\n(.+?)\\n${escapeRegExp(endDelimiter)}(?:\\n(.+))?`,
            'ms',
          ),
        ) ?? [];

      if (!head) {
        throw new Error('No front matter block found');
      }

      if (format === 'yaml-frontmatter') {
        return { ...YAML.parse(head), body };
      }

      if (format === 'toml-frontmatter') {
        return { ...parseTOML(head), body };
      }

      if (format === 'json-frontmatter') {
        return { ...JSON.parse(head), body };
      }
    }
  } catch (/** @type {any} */ ex) {
    throw new Error(`${path} could not be parsed due to ${ex.name}: ${ex.message}`);
  }

  throw new Error(`${path} could not be parsed due to an unknown format: ${format}`);
};

/**
 * Parse raw content with given file details.
 * @param {object} entry - File entry.
 * @param {any} entry.content - Content object. Note that this method may modify the `content` (the
 * `body` property will be removed if exists) so it shouldn’t be a reference to an existing object.
 * @param {string} entry.path - File path.
 * @param {ParserConfig} entry.config - File parser/formatter configuration.
 * @returns {string} Formatted string.
 */
export const formatEntryFile = ({
  content,
  path,
  config: { extension, format, frontmatterDelimiter, yamlQuote = false },
}) => {
  format ||= /** @type {FileFormat | undefined} */ (
    extension === 'md' || path.endsWith('.md')
      ? 'yaml-frontmatter'
      : extension || getPathInfo(path).extension
  );

  if (!format) {
    return '';
  }

  const customFormatter = get(customFileProcessors)[format]?.formatter;

  if (customFormatter) {
    return `${customFormatter(content).trim()}\n`;
  }

  const formatYAML = () =>
    YAML.stringify(content, null, {
      lineWidth: 0,
      defaultKeyType: 'PLAIN',
      defaultStringType: yamlQuote ? 'QUOTE_DOUBLE' : 'PLAIN',
    }).trim();

  const formatTOML = () => TOML.stringify(content).trim();
  const formatJSON = () => JSON.stringify(content, null, 2).trim();

  try {
    if (format.match(/^ya?ml$/)) {
      return `${formatYAML()}\n`;
    }

    if (format === 'toml') {
      return `${formatTOML()}\n`;
    }

    if (format === 'json') {
      return `${formatJSON()}\n`;
    }
  } catch (/** @type {any} */ ex) {
    // eslint-disable-next-line no-console
    console.error(ex);

    return '';
  }

  if (format.match(/^(?:(?:yaml|toml|json)-)?frontmatter$/)) {
    const [startDelimiter, endDelimiter] = getFrontmatterDelimiters(format, frontmatterDelimiter);
    const body = content.body ? `${content.body}\n` : '';

    delete content.body;

    try {
      if (format === 'frontmatter' || format === 'yaml-frontmatter') {
        return `${startDelimiter}\n${formatYAML()}\n${endDelimiter}\n${body}`;
      }

      if (format === 'toml-frontmatter') {
        return `${startDelimiter}\n${formatTOML()}\n${endDelimiter}\n${body}`;
      }

      if (format === 'json-frontmatter') {
        return `${startDelimiter}\n${formatJSON()}\n${endDelimiter}\n${body}`;
      }
    } catch (/** @type {any} */ ex) {
      // eslint-disable-next-line no-console
      console.error(ex);
    }
  }

  return '';
};

/**
 * Determine the slug for the given entry content.
 * @param {string} collectionName - Collection name.
 * @param {string} filePath - File path without the collection folder and extension. It’s a slug in
 * most cases, but it may be a path containing slash(es) when the Folder Collections Path is
 * configured.
 * @param {RawEntryContent} content - Entry content.
 * @returns {string} Slug.
 * @see https://decapcms.org/docs/configuration-options/#slug
 * @see https://decapcms.org/docs/collection-folder/#folder-collections-path
 */
const getSlug = (collectionName, filePath, content) => {
  const collection = getCollection(collectionName);

  if (!collection) {
    return '';
  }

  const { path: pathTemplate, identifier_field: identifierField = 'title' } = collection;

  if (!pathTemplate) {
    // It’s a slug
    return filePath;
  }

  if (pathTemplate.includes('{{slug}}')) {
    const [, slug] =
      filePath.match(
        new RegExp(`^${escapeRegExp(pathTemplate).replace('\\{\\{slug\\}\\}', '(.+)')}$`),
      ) ?? [];

    if (slug) {
      return slug;
    }
  }

  // We can’t determine the slug from the file path. Let’s fallback using the content
  return normalizeSlug(
    content[identifierField] || content.title || content.name || content.label || '',
  );
};

/**
 * Parse the given entry files to create a complete, serialized entry list.
 * @param {BaseEntryListItem[]} entryFiles - Entry file list.
 * @returns {{ entries: Entry[], errors: Error[] }} Entry list and error list.
 */
export const parseEntryFiles = (entryFiles) => {
  /** @type {any[]} */
  const entries = [];
  /** @type {Error[]} */
  const errors = [];

  entryFiles.forEach((file) => {
    /** @type {RawEntryContent | null | undefined} */
    let parsedFile;

    try {
      parsedFile = parseEntryFile(file);
    } catch (/** @type {any} */ ex) {
      // eslint-disable-next-line no-console
      console.error(ex);
      errors.push(ex);
    }

    if (!parsedFile || !isObject(parsedFile)) {
      return;
    }

    const {
      path,
      sha,
      meta = {},
      folder: { folderPath: configFolderPath = '', collectionName, fileName, filePathMap },
    } = file;

    const collection = getCollection(collectionName);

    if (!collection) {
      return;
    }

    const collectionFile = fileName ? collection._fileMap?.[fileName] : undefined;

    const {
      i18nEnabled,
      locales,
      defaultLocale,
      structure,
      canonicalSlug: { key: canonicalSlugKey },
    } = (collectionFile ?? collection)._i18n;

    const extension = getFileExtension({
      format: collection.format,
      extension: collection.extension,
      file: fileName,
    });

    // Skip Hugo’s special index page that shouldn’t appear in a folder collection, unless the
    // collection’s `path` ends with `_index` and the extension is `md`.
    if (
      getPathInfo(path).basename === '_index.md' &&
      !(collection.path?.split('/').pop() === '_index' && extension === 'md') &&
      !fileName
    ) {
      return;
    }

    const filePath = (() => {
      if (fileName) {
        return path;
      }

      /**
       * The path pattern in the middle, which should match the filename (without extension),
       * possibly with the parent directory. If the collection’s `path` is configured, use it to
       * generate a pattern, so that unrelated files are excluded.
       * @see https://decapcms.org/docs/collection-folder/#folder-collections-path
       */
      const filePathMatcher = collection.path
        ? collection.path.replace(/\//g, '\\/').replace(/{{.+?}}/g, '[^\\/]+')
        : '.+';

      const regex = new RegExp(
        `^${escapeRegExp(stripSlashes(configFolderPath))}\\/(${filePathMatcher})\\.${extension}$`,
      );

      return path.match(regex)?.[1];
    })();

    if (!filePath) {
      return;
    }

    /** @type {Entry} */
    const entry = { id: '', slug: '', sha, locales: {}, ...meta };

    if (!i18nEnabled) {
      const slug = fileName || getSlug(collectionName, filePath, parsedFile);

      entry.slug = slug;
      entry.locales._default = { slug, path, sha, content: flatten(parsedFile) };
    }

    if (i18nEnabled && structure === 'single_file') {
      const content = parsedFile[defaultLocale] ?? Object.values(parsedFile)[0];
      const slug = fileName || getSlug(collectionName, filePath, content);

      entry.slug = slug;
      entry.locales = Object.fromEntries(
        locales
          .filter((locale) => locale in parsedFile)
          .map((locale) => [locale, { slug, path, sha, content: flatten(parsedFile[locale]) }]),
      );
    }

    if (i18nEnabled && (structure === 'multiple_folders' || structure === 'multiple_files')) {
      /**
       * @type {string | undefined}
       */
      let _filePath;
      /**
       * @type {LocaleCode | undefined}
       */
      let locale;

      if (fileName) {
        [locale, _filePath] =
          Object.entries(filePathMap ?? {}).find(([, locPath]) => locPath === filePath) ?? [];
      } else if (structure === 'multiple_folders') {
        [, locale, _filePath] = filePath.match(`^(${locales.join('|')})\\/(.+)$`) ?? [];
      } else {
        [, _filePath, locale] = filePath.match(`^(.+)\\.(${locales.join('|')})$`) ?? [];
      }

      if (!_filePath || !locale) {
        return;
      }

      const slug = fileName || getSlug(collectionName, _filePath, parsedFile);
      const localizedEntry = { slug, path, sha, content: flatten(parsedFile) };
      // Support a canonical slug to link localized files
      const canonicalSlug = parsedFile[canonicalSlugKey];
      // Use a temporary ID to locate all the localized files for the entry
      const tempId = `${collectionName}/${canonicalSlug ?? slug}`;
      // Check if the entry has already been added for another locale
      const existingEntry = entries.find((e) => e.id === tempId);

      // If found, add a new locale to the existing entry; don’t add another entry
      if (existingEntry) {
        existingEntry.locales[locale] = localizedEntry;

        if (locale === defaultLocale) {
          existingEntry.slug = slug;
          existingEntry.sha = sha;
        }

        return;
      }

      entry.id = tempId;
      entry.locales[locale] = localizedEntry;

      if (locale === defaultLocale) {
        entry.slug = slug;
        entry.sha = sha;
      }
    }

    entries.push(entry);
  });

  return {
    entries: entries.filter((entry) => {
      // Override a temporary ID
      entry.id = generateUUID();

      return !!entry.slug && !!Object.keys(entry.locales).length;
    }),
    errors,
  };
};
