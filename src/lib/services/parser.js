/* eslint-disable jsdoc/require-jsdoc */

import TOML from '@ltd/j-toml';
import { get } from 'svelte/store';
import YAML from 'yaml';
import { allAssetPaths, getAssetKind } from '$lib/services/assets';
import { allContentPaths, getCollection } from '$lib/services/contents';
import { normalizeSlug } from '$lib/services/contents/entry';
import { isObject } from '$lib/services/utils/misc';
import { escapeRegExp, stripSlashes } from '$lib/services/utils/strings';

/**
 * Parse a list of all files on the repository/filesystem to create entry and asset lists, with the
 * relevant collection/file configuration added.
 * @param {object[]} files Unfiltered file list.
 * @returns {{ entryFiles: object[], assetFiles: object[] }} File list, including both entries and
 * assets.
 */
export const createFileList = (files) => {
  const entryFiles = [];
  const assetFiles = [];

  files.forEach((fileInfo) => {
    const { path } = fileInfo;

    const contentPathConfig = get(allContentPaths).find(
      ({ folder, file }) => path.startsWith(folder) || path === file,
    );

    const mediaPathConfig = get(allAssetPaths).findLast(({ internalPath }) =>
      path.startsWith(internalPath),
    );

    if (contentPathConfig && path.match(/\.(?:json|markdown|md|toml|ya?ml)$/i)) {
      entryFiles.push({
        ...fileInfo,
        type: 'entry',
        config: contentPathConfig,
      });
    }

    if (mediaPathConfig) {
      assetFiles.push({
        ...fileInfo,
        type: 'asset',
        config: mediaPathConfig,
      });
    }
  });

  return { entryFiles, assetFiles };
};

/**
 * Get the file extension for the given collection.
 * @param {Collection} collection File’s collection configuration.
 * @returns {string} Determined extension.
 */
export const getFileExtension = ({ format, extension }) => {
  if (extension) {
    return extension;
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
 * @param {string} format File format.
 * @param {string} [delimiter] Configured delimiter.
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
 * Parse raw content with given file details.
 * @param {object} entry File entry.
 * @param {string} entry.text Raw content.
 * @param {string} entry.path File path.
 * @param {object} entry.config File’s collection configuration.
 * @param {string} [entry.config.file] File path for a file collection item.
 * @param {string} [entry.config.extension] Configured file extension.
 * @param {string} [entry.config.format] Configured file format.
 * @param {string} [entry.config.frontmatterDelimiter] Configured Frontmatter delimiter.
 * @returns {object} Parsed content.
 */
const parseEntryFile = ({
  text,
  path,
  config: { file, extension, format, frontmatterDelimiter },
}) => {
  format ||=
    extension === 'md' || path.endsWith('.md')
      ? 'yaml-frontmatter'
      : extension || file?.match(/\.([^.]+)$/)[1];

  // Ignore files with unknown format
  if (!format) {
    return null;
  }

  try {
    if (format.match(/^ya?ml$/) && path.match(/\.ya?ml$/)) {
      return YAML.parse(text);
    }

    if (format === 'toml' && path.match(/\.toml$/)) {
      return TOML.parse(text);
    }

    if (format === 'json' && path.match(/\.json$/)) {
      return JSON.parse(text);
    }
  } catch {
    return null;
  }

  if (format.match(/^(?:(?:yaml|toml|json)-)?frontmatter$/) && path.match(/\.(?:md|markdown)$/)) {
    const [startDelimiter, endDelimiter] = getFrontmatterDelimiters(format, frontmatterDelimiter);

    const [, head, body = ''] =
      text.match(
        new RegExp(
          `^${escapeRegExp(startDelimiter)}\\n(.+?)\\n${escapeRegExp(endDelimiter)}(?:\\n(.+))?`,
          'ms',
        ),
      ) || [];

    // If the format is `frontmatter`, try to parse in different formats, starting with YAML
    if (head && (format === 'frontmatter' || format === 'yaml-frontmatter')) {
      try {
        return { ...YAML.parse(head), body };
      } catch {
        //
      }
    }

    if (head && (format === 'frontmatter' || format === 'toml-frontmatter')) {
      try {
        return { ...TOML.parse(head), body };
      } catch {
        //
      }
    }

    if (head && (format === 'frontmatter' || format === 'json-frontmatter')) {
      try {
        return { ...JSON.parse(head), body };
      } catch {
        //
      }
    }
  }

  return null;
};

/**
 * Parse raw content with given file details.
 * @param {object} entry File entry.
 * @param {object} entry.content Content object.
 * @param {string} entry.path File path.
 * @param {object} entry.config File’s collection configuration.
 * @param {string} [entry.config.extension] Configured file extension.
 * @param {string} [entry.config.format] Configured file format.
 * @param {string} [entry.config.frontmatterDelimiter] Configured Frontmatter delimiter.
 * @returns {string} Formatted string.
 */
export const formatEntryFile = ({
  content,
  path,
  config: { extension, format, frontmatterDelimiter },
}) => {
  content = JSON.parse(JSON.stringify(content));

  format ||=
    extension === 'md' || path.endsWith('.md')
      ? 'yaml-frontmatter'
      : extension || path.match(/\.([^.]+)$/)[1];

  const formatYAML = () => YAML.stringify(content, null, { lineWidth: 0 }).trim();
  const formatTOML = () => TOML.stringify(content, { newline: '\n' }).trim();
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
  } catch {
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
    } catch {
      //
    }
  }

  return '';
};

/**
 * Determine the slug for the given entry content.
 * @param {string} collectionName Collection name.
 * @param {string} filePath File path without the collection folder and extension. It’s a slug in
 * most cases, but it may be a path containing slash(es) when the Folder Collections Path is
 * configured.
 * @param {EntryContent} content Entry content.
 * @returns {string} Slug.
 * @see https://decapcms.org/docs/configuration-options/#slug
 * @see https://decapcms.org/docs/beta-features/#folder-collections-path
 */
const getSlug = (collectionName, filePath, content) => {
  const { path: pathTemplate, identifier_field: identifierField = 'title' } =
    getCollection(collectionName);

  if (!pathTemplate) {
    // It’s a slug
    return filePath;
  }

  if (pathTemplate.includes('{{slug}}')) {
    const [, slug] =
      filePath.match(
        new RegExp(`^${escapeRegExp(pathTemplate).replace('\\{\\{slug\\}\\}', '(.+)')}$`),
      ) || [];

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
 * @param {object[]} entryFiles Entry file list.
 * @returns {Entry[]} Entry list.
 */
export const parseEntryFiles = (entryFiles) => {
  const entries = [];

  entryFiles.forEach((file) => {
    const parsedFile = parseEntryFile(file);

    if (!isObject(parsedFile)) {
      return;
    }

    const {
      path,
      sha,
      meta = {},
      config: { folder: configFolder, collectionName, fileName },
    } = file;

    const collection = getCollection(collectionName);
    const extension = getFileExtension(collection);
    const { structure, hasLocales, locales, defaultLocale } = collection._i18n;

    const [, filePath] = fileName
      ? []
      : path.match(
          new RegExp(`^${escapeRegExp(stripSlashes(configFolder))}\\/(.+)\\.${extension}$`),
        ) || [];

    if (!fileName && !filePath) {
      return;
    }

    const entry = { sha, collectionName, fileName, ...meta };

    if (!hasLocales) {
      entry.slug = getSlug(collectionName, filePath, parsedFile);
      entry.locales = { default: { content: parsedFile, path, sha } };
    }

    if (hasLocales && (structure === 'single_file' || fileName)) {
      entry.slug = fileName || getSlug(collectionName, filePath, parsedFile[defaultLocale]);
      entry.locales = Object.fromEntries(
        locales
          .filter((locale) => locale in parsedFile)
          .map((locale) => [locale, { content: parsedFile[locale], path, sha }]),
      );
    }

    if (hasLocales && (structure === 'multiple_folders' || structure === 'multiple_files')) {
      /**
       * @type {string}
       */
      let _filePath = undefined;
      /**
       * @type {string}
       */
      let locale = undefined;

      if (structure === 'multiple_folders') {
        [, locale, _filePath] = filePath.match(new RegExp(`^(${locales.join('|')})\\/(.+)$`)) || [];
      } else {
        [, _filePath, locale] = filePath.match(new RegExp(`^(.+)\\.(${locales.join('|')})$`)) || [];
      }

      if (_filePath && locale) {
        const slug = getSlug(collectionName, _filePath, parsedFile);
        const index = entries.findIndex((_entry) => _entry.slug === slug);

        if (index > -1) {
          entries[index].locales[locale] = { content: parsedFile, path, sha };

          // Don’t add another `entry`
          return;
        }

        entry.slug = slug;
        entry.locales = { [locale]: { content: parsedFile, path, sha } };
      }
    }

    entries.push(entry);
  });

  return entries;
};

/**
 * Parse the given asset files to create a complete, serialized asset list.
 * @param {object[]} assetFiles Asset file list.
 * @returns {Asset[]} Asset list.
 */
export const parseAssetFiles = (assetFiles) =>
  assetFiles.map((assetInfo) => {
    const {
      path,
      name,
      sha,
      size,
      text = null,
      meta = {},
      config: { collectionName, internalPath },
    } = assetInfo;

    return {
      path,
      name,
      sha,
      size,
      kind: getAssetKind(name),
      text,
      collectionName,
      folder: internalPath,
      ...meta,
    };
  });
