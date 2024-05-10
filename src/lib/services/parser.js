/* eslint-disable jsdoc/require-jsdoc */

import { isObject } from '@sveltia/utils/object';
import { escapeRegExp, stripSlashes } from '@sveltia/utils/string';
import { get } from 'svelte/store';
import YAML from 'yaml';
import { allAssetFolders, getAssetKind } from '$lib/services/assets';
import { allEntryFolders, getCollection } from '$lib/services/contents';
import { normalizeSlug } from '$lib/services/contents/slug';
import TOML from '$lib/services/utils/toml';

/**
 * Get the file extension for the given collection.
 * @param {object} pathConfig - File’s path configuration. (part of `CollectionEntryFolder`).
 * @param {string} [pathConfig.format] - File format, e.g. `json`.
 * @param {string} [pathConfig.extension] - File extension, e.g. `json`.
 * @param {string} [pathConfig.file] - File name, e.g. `about.json`.
 * @returns {string} Determined extension.
 */
export const getFileExtension = ({ file, format, extension }) => {
  if (extension) {
    return extension;
  }

  if (file) {
    return (file.match(/[^.]+$/) ?? [])[0] ?? 'md';
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
 * Parse a list of all files on the repository/filesystem to create entry and asset lists, with the
 * relevant collection/file configuration added.
 * @param {BaseFileListItem[]} files - Unfiltered file list.
 * @returns {{
 * entryFiles: BaseEntryListItem[],
 * assetFiles: BaseAssetListItem[],
 * allFiles: (BaseEntryListItem | BaseAssetListItem)[],
 * count: number,
 * }} File
 * list, including both entries and assets.
 */
export const createFileList = (files) => {
  /** @type {BaseEntryListItem[]} */
  const entryFiles = [];
  /** @type {BaseAssetListItem[]} */
  const assetFiles = [];

  files.forEach((fileInfo) => {
    const { path } = fileInfo;
    const name = /** @type {string} */ (path.split('/').pop());
    const extension = name.split('.').pop();

    const entryFolderConfig = get(allEntryFolders).findLast(({ filePath, folderPath }) =>
      folderPath ? path.startsWith(folderPath) : path === filePath,
    );

    const mediaFolderConfig = get(allAssetFolders).findLast(({ internalPath, entryRelative }) => {
      if (entryRelative) {
        return path.startsWith(`${internalPath}/`);
      }

      // Compare that the enclosing directory is exactly the same as the internal path, and ignore
      // any subdirectories, as there is no way to upload assets to them.
      return path.match(/^(.+)\//)?.[1] === internalPath;
    });

    if (
      entryFolderConfig &&
      (path === entryFolderConfig.filePath || extension === getFileExtension(entryFolderConfig))
    ) {
      entryFiles.push({
        ...fileInfo,
        type: 'entry',
        config: entryFolderConfig,
      });
    }

    // Exclude files with a leading `+` sign, which are Svelte page/layout files. Also exclude files
    // already listed as entries. These files can appear in the file list when a relative media path
    // is configured for a collection
    if (mediaFolderConfig && !name.startsWith('+') && !entryFiles.find((e) => e.path === path)) {
      assetFiles.push({
        ...fileInfo,
        type: 'asset',
        config: mediaFolderConfig,
      });
    }
  });

  const allFiles = [...entryFiles, ...assetFiles];

  return { entryFiles, assetFiles, allFiles, count: allFiles.length };
};

/**
 * Get the Frontmatter format’s delimiters.
 * @param {string} format - File format.
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
 * Parse raw content with given file details.
 * @param {BaseEntryListItem} entry - File entry.
 * @returns {EntryContent | null} Parsed content.
 */
const parseEntryFile = ({
  text = '',
  path,
  config: { filePath, extension, format, frontmatterDelimiter },
}) => {
  format ||=
    extension === 'md' || path.endsWith('.md')
      ? 'yaml-frontmatter'
      : extension || (filePath?.match(/\.([^.]+)$/) ?? [])[1];

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
  } catch (/** @type {any} */ ex) {
    // eslint-disable-next-line no-console
    console.error(ex);

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
      ) ?? [];

    // If the format is `frontmatter`, try to parse in different formats, starting with YAML
    if (head && (format === 'frontmatter' || format === 'yaml-frontmatter')) {
      try {
        return { ...YAML.parse(head), body };
      } catch (/** @type {any} */ ex) {
        // eslint-disable-next-line no-console
        console.error(ex);
      }
    }

    if (head && (format === 'frontmatter' || format === 'toml-frontmatter')) {
      try {
        return { ...TOML.parse(head), body };
      } catch (/** @type {any} */ ex) {
        // eslint-disable-next-line no-console
        console.error(ex);
      }
    }

    if (head && (format === 'frontmatter' || format === 'json-frontmatter')) {
      try {
        return { ...JSON.parse(head), body };
      } catch (/** @type {any} */ ex) {
        // eslint-disable-next-line no-console
        console.error(ex);
      }
    }
  }

  return null;
};

/**
 * Parse raw content with given file details.
 * @param {object} entry - File entry.
 * @param {any} entry.content - Content object.
 * @param {string} entry.path - File path.
 * @param {object} entry.config - File’s collection configuration.
 * @param {string} [entry.config.extension] - Configured file extension.
 * @param {string} [entry.config.format] - Configured file format.
 * @param {string | string[]} [entry.config.frontmatterDelimiter] - Configured Frontmatter
 * delimiter.
 * @param {boolean} [entry.config.yamlQuote] - Configured YAML string value quotation.
 * @returns {string} Formatted string.
 */
export const formatEntryFile = ({
  content,
  path,
  config: { extension, format, frontmatterDelimiter, yamlQuote = false },
}) => {
  content = JSON.parse(JSON.stringify(content));

  format ||=
    extension === 'md' || path.endsWith('.md')
      ? 'yaml-frontmatter'
      : extension || (path.match(/\.([^.]+)$/) ?? [])[1];

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
 * @param {EntryContent} content - Entry content.
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
 * @returns {Entry[]} Entry list.
 */
export const parseEntryFiles = (entryFiles) => {
  /** @type {any[]} */
  const entries = [];

  entryFiles.forEach((file) => {
    const parsedFile = parseEntryFile(file);

    if (!parsedFile || !isObject(parsedFile)) {
      return;
    }

    const {
      path,
      sha,
      meta = {},
      config: { folderPath: configFolderPath = '', collectionName, fileName },
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

    const [, filePath] = fileName
      ? []
      : path.match(
          new RegExp(`^${escapeRegExp(stripSlashes(configFolderPath))}\\/(.+)\\.${extension}$`),
        ) ?? [];

    if (!fileName && !filePath) {
      return;
    }

    /** @type {Entry} */
    const entry = { id: '', slug: '', sha, collectionName, fileName, locales: {}, ...meta };

    if (!i18nEnabled) {
      const slug = fileName || getSlug(collectionName, filePath, parsedFile);

      entry.slug = slug;
      entry.locales._default = { slug, path, sha, content: parsedFile };
    }

    if (i18nEnabled && (structure === 'single_file' || fileName)) {
      const content = parsedFile[defaultLocale] ?? Object.values(parsedFile)[0];
      const slug = fileName || getSlug(collectionName, filePath, content);

      entry.slug = slug;
      entry.locales = Object.fromEntries(
        locales
          .filter((locale) => locale in parsedFile)
          .map((locale) => [locale, { slug, path, sha, content: parsedFile[locale] }]),
      );
    }

    if (i18nEnabled && (structure === 'multiple_folders' || structure === 'multiple_files')) {
      /**
       * @type {string}
       */
      let _filePath;
      /**
       * @type {string}
       */
      let locale;

      if (structure === 'multiple_folders') {
        [, locale, _filePath] = filePath.match(`^(${locales.join('|')})\\/(.+)$`) ?? [];
      } else {
        [, _filePath, locale] = filePath.match(`^(.+)\\.(${locales.join('|')})$`) ?? [];
      }

      if (!_filePath || !locale) {
        return;
      }

      const slug = fileName || getSlug(collectionName, _filePath, parsedFile);
      const localizedEntry = { slug, path, sha, content: parsedFile };
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
        }

        return;
      }

      entry.id = tempId;
      entry.locales[locale] = localizedEntry;

      if (locale === defaultLocale) {
        entry.slug = slug;
      }
    }

    entries.push(entry);
  });

  return entries.filter((entry) => {
    const { collectionName, slug, locales } = entry;

    if (!slug || !Object.keys(locales).length) {
      return false;
    }

    entry.id = `${collectionName}/${slug}`;

    return true;
  });
};

/**
 * Parse the given asset files to create a complete, serialized asset list.
 * @param {BaseAssetListItem[]} assetFiles - Asset file list.
 * @returns {Asset[]} Asset list.
 */
export const parseAssetFiles = (assetFiles) =>
  assetFiles.map((assetInfo) => {
    const {
      file,
      path,
      name = /** @type {string} */ (path.split('/').pop()),
      sha,
      size,
      text = undefined,
      meta = {},
      config: { collectionName, internalPath },
    } = assetInfo;

    return /** @type {Asset} */ ({
      file,
      blobURL: undefined,
      path,
      name,
      sha,
      size,
      kind: getAssetKind(name),
      text,
      collectionName,
      folder: internalPath,
      ...meta,
    });
  });
