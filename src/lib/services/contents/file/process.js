import { generateUUID } from '@sveltia/utils/crypto';
import { isObject } from '@sveltia/utils/object';
import { escapeRegExp } from '@sveltia/utils/string';
import { flatten } from 'flat';

import { getCollection } from '$lib/services/contents/collection';
import { getCollectionFile } from '$lib/services/contents/collection/files';
import { getIndexFile } from '$lib/services/contents/collection/index-file';
import { parseEntryFile } from '$lib/services/contents/file/parse';
import { hasRootListField } from '$lib/services/contents/widgets/list/helper';

/**
 * @import {
 * BaseEntryListItem,
 * Entry,
 * EntryCollection,
 * InternalCollection,
 * InternalLocaleCode,
 * RawEntryContent,
 * } from '$lib/types/private';
 * @import { Field } from '$lib/types/public';
 */

/**
 * Check if the given file path is Hugo’s special index file: `_index.md` or `_index.{{locale}}.md`.
 * @param {string} path File path to be tested.
 * @returns {boolean} Result.
 */
export const isIndexFile = (path) => /\/_index(?:\.[\w-]+)?\.md$/.test(path);

/**
 * Determine the slug for the given entry content.
 * @param {object} args Arguments.
 * @param {string} args.subPath File path without the collection folder, locale and extension. It’s
 * a slug in most cases, but it may be a path containing slash(es) when the Folder Collections Path
 * is configured.
 * @param {string | undefined} args.subPathTemplate Collection’s `subPath` configuration.
 * @returns {string} Slug.
 * @see https://decapcms.org/docs/configuration-options/#slug
 * @see https://decapcms.org/docs/collection-folder/#folder-collections-path
 */
export const getSlug = ({ subPath, subPathTemplate }) => {
  if (subPathTemplate?.includes('{{slug}}')) {
    // Build regex by replacing placeholders with patterns
    let regexPattern = '';
    let remaining = subPathTemplate;

    // Process template character by character, handling placeholders specially
    while (remaining.length > 0) {
      const nextPlaceholder = remaining.indexOf('{{');

      if (nextPlaceholder === -1) {
        // No more placeholders, escape remaining literal text
        regexPattern += escapeRegExp(remaining);
        break;
      }

      // Add escaped literal text before placeholder
      if (nextPlaceholder > 0) {
        regexPattern += escapeRegExp(remaining.substring(0, nextPlaceholder));
      }

      // Find end of placeholder
      const placeholderEnd = remaining.indexOf('}}', nextPlaceholder);

      if (placeholderEnd === -1) {
        // Malformed template, treat as literal
        regexPattern += escapeRegExp(remaining);
        break;
      }

      const placeholder = remaining.substring(nextPlaceholder, placeholderEnd + 2);

      if (placeholder === '{{slug}}') {
        regexPattern += '(.+)';
      } else {
        regexPattern += '[^/]+';
      }

      remaining = remaining.substring(placeholderEnd + 2);
    }

    const [, slug] = subPath.match(new RegExp(`^${regexPattern}$`)) ?? [];

    if (slug) {
      return slug;
    }
  }

  return subPath;
};

/**
 * Parse the raw content from the file and handle any errors.
 * @param {BaseEntryListItem} file Entry file list item.
 * @param {Error[]} errors List of parse errors.
 * @returns {Promise<RawEntryContent | undefined>} Parsed content or undefined if parsing failed.
 */
export const parseFileContent = async (file, errors) => {
  try {
    return await parseEntryFile(file);
  } catch (/** @type {any} */ ex) {
    // eslint-disable-next-line no-console
    console.error(ex);
    errors.push(ex);
    return undefined;
  }
};

/**
 * Transform raw content to handle special cases like root list fields.
 * @param {RawEntryContent} rawContent Raw content from the file.
 * @param {Field[]} fields Collection fields.
 * @param {boolean} i18nSingleFile Whether i18n single file structure is used.
 * @returns {RawEntryContent | undefined} Transformed content or undefined if invalid.
 */
export const transformRawContent = (rawContent, fields, i18nSingleFile) => {
  // Handle a special case: top-level list field
  if (hasRootListField(fields)) {
    const fieldName = fields[0].name;

    if (i18nSingleFile) {
      if (!isObject(rawContent) || !Object.values(rawContent).every(Array.isArray)) {
        return undefined;
      }

      return Object.fromEntries(
        Object.entries(rawContent).map(([locale, content]) => [locale, { [fieldName]: content }]),
      );
    }

    if (!Array.isArray(rawContent)) {
      return undefined;
    }

    return { [fieldName]: rawContent };
  }

  return isObject(rawContent) ? rawContent : undefined;
};

/**
 * Check if the file should be skipped based on Hugo index file rules.
 * @param {string} path File path.
 * @param {string | undefined} fileName Collection file name.
 * @param {InternalCollection} collection Collection configuration.
 * @param {string | undefined} subPathTemplate Sub path template.
 * @param {string} extension File extension.
 * @returns {boolean} True if the file should be skipped.
 */
export const shouldSkipIndexFile = (path, fileName, collection, subPathTemplate, extension) => {
  // Special constraint: if template ends with _index and file follows _index pattern,
  // only .md files are allowed (Hugo constraint)
  if (
    subPathTemplate?.split('/').pop() === '_index' &&
    /\/_index(?:\.[\w-]+)?\.[\w]+$/.test(path) &&
    extension !== 'md'
  ) {
    return true;
  }

  if (!isIndexFile(path)) {
    return false;
  }

  // Skip Hugo’s special `_index.md` file that shouldn’t appear in a collection. Localized index
  // files like `_index.en.md` are also excluded by default. Exceptions:
  // 1. The collection is a file/singleton collection
  // 2. The collection is an entry collection and index file inclusion is enabled
  // 3. The collection is an entry collection and the `path` option value ends with `_index` and
  // the extension is `md`
  return !(
    !!fileName ||
    getIndexFile(collection)?.name === '_index' ||
    (subPathTemplate?.split('/').pop() === '_index' && extension === 'md')
  );
};

/**
 * Extract subPath and locale information from the file path.
 * @param {BaseEntryListItem} file Entry file list item.
 * @param {string | undefined} fileName Collection file name.
 * @param {RegExp | undefined} fullPathRegEx Full path regex for parsing.
 * @param {InternalLocaleCode} defaultLocale Default locale.
 * @param {boolean} isMultiFileStructure Whether using multi-file i18n structure.
 * @returns {{ subPath: string | undefined, locale: InternalLocaleCode | undefined }} Path info.
 */
export const extractPathInfo = (
  file,
  fileName,
  fullPathRegEx,
  defaultLocale,
  isMultiFileStructure,
) => {
  const {
    path,
    folder: { filePathMap },
  } = file;

  if (fileName) {
    if (isMultiFileStructure) {
      const [locale, subPath] =
        Object.entries(filePathMap ?? {}).find(([, locPath]) => locPath === path) ?? [];

      return { subPath, locale };
    }

    return { subPath: path, locale: undefined };
  }

  if (!fullPathRegEx) {
    return { subPath: undefined, locale: undefined };
  }

  // If the `omit_default_locale_from_filename` i18n option is enabled, the matching comes with
  // the `locale` group being `undefined` for the default locale, so we need a fallback for it
  const match = path.match(fullPathRegEx);

  if (!match?.groups) {
    return { subPath: undefined, locale: undefined };
  }

  const { subPath, locale = defaultLocale } = match.groups;

  return { subPath, locale };
};

/**
 * Process entry for non-i18n collections.
 * @param {Entry} entry Entry object to populate.
 * @param {RawEntryContent} rawContent Raw content.
 * @param {string} path File path.
 * @param {string | undefined} fileName Collection file name.
 * @param {string} subPath Sub path.
 * @param {string | undefined} subPathTemplate Sub path template.
 */
export const processNonI18nEntry = (
  entry,
  rawContent,
  path,
  fileName,
  subPath,
  subPathTemplate,
) => {
  const slug = fileName || getSlug({ subPath, subPathTemplate });

  entry.slug = slug;
  entry.locales._default = { slug, path, content: flatten(rawContent) };
};

/**
 * Process entry for single-file i18n structure.
 * @param {Entry} entry Entry object to populate.
 * @param {RawEntryContent} rawContent Raw content.
 * @param {string} path File path.
 * @param {string | undefined} fileName Collection file name.
 * @param {string} subPath Sub path.
 * @param {string | undefined} subPathTemplate Sub path template.
 * @param {InternalLocaleCode[]} allLocales All available locales.
 */
export const processI18nSingleFileEntry = (
  entry,
  rawContent,
  path,
  fileName,
  subPath,
  subPathTemplate,
  allLocales,
) => {
  const slug = fileName || getSlug({ subPath, subPathTemplate });

  entry.slug = slug;
  entry.locales = Object.fromEntries(
    allLocales
      .filter((_locale) => _locale in rawContent)
      .map((_locale) => [_locale, { slug, path, content: flatten(rawContent[_locale]) }]),
  );
};

/**
 * Process entry for multi-file i18n structure.
 * @param {Entry} entry Entry object to populate.
 * @param {RawEntryContent} rawContent Raw content.
 * @param {string} path File path.
 * @param {string | undefined} fileName Collection file name.
 * @param {string} subPath Sub path.
 * @param {string | undefined} subPathTemplate Sub path template.
 * @param {InternalLocaleCode} locale Current locale.
 * @param {InternalLocaleCode} defaultLocale Default locale.
 * @param {string} collectionName Collection name.
 * @param {string | undefined} canonicalSlugKey Canonical slug key.
 * @param {Entry[]} entries Existing entries array.
 * @returns {boolean} True if entry was added to existing entry, false if new entry should be added.
 */
export const processI18nMultiFileEntry = (
  entry,
  rawContent,
  path,
  fileName,
  subPath,
  subPathTemplate,
  locale,
  defaultLocale,
  collectionName,
  canonicalSlugKey,
  entries,
) => {
  // Support a canonical slug to link localized files
  const canonicalSlug =
    canonicalSlugKey && typeof rawContent[canonicalSlugKey] === 'string'
      ? rawContent[canonicalSlugKey]
      : undefined;

  const slug = fileName || getSlug({ subPath, subPathTemplate });
  const localizedEntry = { slug, path, content: flatten(rawContent) };
  // Use a temporary ID to locate all the localized files for the entry
  const tempId = `${collectionName}/${canonicalSlug ?? slug}`;
  // Check if the entry has already been added for another locale
  const existingEntry = entries.find((e) => e.id === tempId);

  // If found, add a new locale to the existing entry; don’t add another entry
  if (existingEntry) {
    existingEntry.locales[locale] = localizedEntry;

    if (locale === defaultLocale) {
      existingEntry.slug = slug;
      existingEntry.subPath = subPath;
    }

    return true; // Entry was merged with existing
  }

  entry.id = tempId;
  entry.locales[locale] = localizedEntry;

  if (locale === defaultLocale) {
    entry.slug = slug;
  }

  return false; // New entry should be added
};

/**
 * Prepare a new entry by processing the given file info and raw content.
 * @param {object} args Arguments.
 * @param {BaseEntryListItem} args.file Entry file list item.
 * @param {Entry[]} args.entries List of prepared entries.
 * @param {Error[]} args.errors List of parse errors.
 */
export const prepareEntry = async ({ file, entries, errors }) => {
  const rawContent = await parseFileContent(file, errors);

  if (!rawContent) {
    return;
  }

  const {
    path,
    meta = {},
    folder: { collectionName, fileName },
  } = file;

  const collection = getCollection(collectionName);

  const collectionFile =
    collection && fileName ? getCollectionFile(collection, fileName) : undefined;

  if (!collection || (fileName && !collectionFile)) {
    return;
  }

  const {
    fields = [],
    _file: { fullPathRegEx, subPath: subPathTemplate, extension },
    _i18n: {
      i18nEnabled,
      allLocales,
      defaultLocale,
      structureMap: { i18nSingleFile, i18nMultiFile, i18nMultiFolder, i18nRootMultiFolder },
      canonicalSlug: { key: canonicalSlugKey },
    },
  } = collectionFile ?? /** @type {EntryCollection} */ (collection);

  const transformedContent = transformRawContent(rawContent, fields, i18nSingleFile);

  if (!transformedContent) {
    return;
  }

  if (shouldSkipIndexFile(path, fileName, collection, subPathTemplate, extension)) {
    return;
  }

  const isMultiFileStructure = i18nMultiFile || i18nMultiFolder || i18nRootMultiFolder;

  const { subPath, locale } = extractPathInfo(
    file,
    fileName,
    fullPathRegEx,
    defaultLocale,
    isMultiFileStructure,
  );

  if (!subPath) {
    return;
  }

  if (isMultiFileStructure && !locale) {
    return;
  }

  /** @type {Entry} */
  const entry = {
    id: '',
    slug: '',
    subPath,
    locales: {},
    ...meta,
  };

  if (!i18nEnabled) {
    processNonI18nEntry(entry, transformedContent, path, fileName, subPath, subPathTemplate);
  } else if (i18nSingleFile) {
    processI18nSingleFileEntry(
      entry,
      transformedContent,
      path,
      fileName,
      subPath,
      subPathTemplate,
      allLocales,
    );
  } else if (isMultiFileStructure && locale) {
    const wasMerged = processI18nMultiFileEntry(
      entry,
      transformedContent,
      path,
      fileName,
      subPath,
      subPathTemplate,
      locale,
      defaultLocale,
      collectionName,
      canonicalSlugKey,
      entries,
    );

    if (wasMerged) {
      return; // Entry was merged with existing, don’t add to entries array
    }
  }

  entries.push(entry);
};

/**
 * Parse the given entry files to create a complete, serialized entry list.
 * @param {BaseEntryListItem[]} entryFiles Entry file list.
 * @returns {Promise<{ entries: Entry[], errors: Error[] }>} Entry list and error list.
 */
export const prepareEntries = async (entryFiles) => {
  /** @type {Entry[]} */
  const entries = [];
  /** @type {Error[]} */
  const errors = [];

  await Promise.all(entryFiles.map((file) => prepareEntry({ file, entries, errors })));

  return {
    entries: entries.filter((entry) => {
      // Override a temporary ID
      entry.id = generateUUID();

      return !!entry.slug && !!Object.keys(entry.locales).length;
    }),
    errors,
  };
};
