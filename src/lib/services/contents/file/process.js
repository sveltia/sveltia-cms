import { generateUUID } from '@sveltia/utils/crypto';
import { isObject } from '@sveltia/utils/object';
import { escapeRegExp } from '@sveltia/utils/string';

import { version } from '$lib/services/app';
import { cmsConfigVersion } from '$lib/services/config';
import { getIndexFile } from '$lib/services/contents/collection/entries/index-file';
import { resolveCollectionAndFile } from '$lib/services/contents/collection/files';
import { getNestedIndexFileName } from '$lib/services/contents/collection/nested';
import { hasRootField } from '$lib/services/contents/entry/fields';
import { detectedFrontMatterFormats } from '$lib/services/contents/file/detected-formats';
import { mayHaveUnsafeInteger } from '$lib/services/contents/file/integers';
import { hasCustomParser, parseEntryFile } from '$lib/services/contents/file/parse';
import {
  usesMultiFileStructure,
  usesSingleFileStructure,
} from '$lib/services/contents/i18n/config';
import { getOrCreate } from '$lib/services/utils/cache';
import { flattenKeys } from '$lib/services/utils/object';
import { runInChunks } from '$lib/services/utils/scheduling';

/**
 * @import {
 * BaseEntryListItem,
 * Entry,
 * InternalCollection,
 * InternalEntryCollection,
 * InternalLocaleCode,
 * ParsedFileContent,
 * RepositoryFileMetadata,
 * } from '$lib/types/private';
 * @import { Field, RawEntryContent } from '$lib/types/public';
 */

/**
 * Check if the given file path is Hugo’s special index file: `_index.md` or `_index.{{locale}}.md`.
 * @param {string} path File path to be tested.
 * @returns {boolean} Result.
 */
export const isIndexFile = (path) => /\/_index(?:\.[\w-]+)?\.md$/.test(path);

/**
 * Regex to split a `subPath` template into literal text and template tags. Unlike
 * `TEMPLATE_TAG_REGEX`, it also matches an empty `{{}}` tag and a tag spanning a line break.
 */
const SLUG_TEMPLATE_TAG_REGEX = /{{([^]*?)}}/;
/** @type {Map<string, RegExp>} */
const slugRegexCache = new Map();

/**
 * Determine the slug for the given entry content.
 * @param {object} args Arguments.
 * @param {string} args.subPath File path without the collection folder, locale and extension. It’s
 * a slug in most cases, but it may be a path containing slash(es) when the entry collection’s
 * subpath is configured.
 * @param {string | undefined} args.subPathTemplate Collection’s `subPath` configuration.
 * @returns {string} Slug.
 * @see https://decapcms.org/docs/configuration-options/#slug
 * @see https://decapcms.org/docs/collection-folder/#folder-collections-path
 * @see https://sveltiacms.app/en/docs/collections/entries
 */
export const getSlug = ({ subPath, subPathTemplate }) => {
  if (subPathTemplate?.includes('{{slug}}')) {
    const regex = getOrCreate(slugRegexCache, subPathTemplate, () => {
      const regexPattern = subPathTemplate
        .split(SLUG_TEMPLATE_TAG_REGEX)
        .map((part, index) => {
          // The odd parts are the tags captured by the split; an unclosed `{{` stays literal
          if (index % 2 === 0) {
            return escapeRegExp(part);
          }

          return part === 'slug' ? '([^/]+)' : '[^/]+?';
        })
        .join('');

      return new RegExp(`^${regexPattern}$`);
    });

    const [, slug] = subPath.match(regex) ?? [];

    if (slug) {
      return slug;
    }
  }

  return subPath;
};

/**
 * Check if the given value refers back to itself, e.g. through a YAML alias pointing at one of its
 * own ancestors like `meta: &m { self: *m }`. Such content can’t be flattened or saved. A value
 * referred to from several places, which isn’t circular, is fine.
 * @param {unknown} value Parsed value.
 * @param {Set<object>} [ancestors] Objects on the path from the root to the value.
 * @returns {boolean} Result.
 */
export const hasCircularReference = (value, ancestors = new Set()) => {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  if (ancestors.has(value)) {
    return true;
  }

  ancestors.add(value);

  const found = Object.values(value).some((child) => hasCircularReference(child, ancestors));

  ancestors.delete(value);

  return found;
};

/**
 * Map of entry file paths to the content parsed from them, collected while the files are parsed so
 * it can be cached along with the files.
 * @typedef {Map<string, ParsedFileContent>} ParsedFileMap
 */

/**
 * Get the key identifying what a file’s content is parsed for: the CMS version, as a new version
 * may parse a file differently, and the CMS configuration, which sets the format of each file.
 * @returns {string} Key.
 */
export const getParsedContentKey = () => `${version}\n${cmsConfigVersion.current}`;

/**
 * Add the content parsed from a file to the given map, so it can be cached.
 * @param {object} args Arguments.
 * @param {ParsedFileMap} args.parsedFileMap Map to add the content to.
 * @param {string} args.path File path.
 * @param {string} args.key What the content was parsed for. See {@link getParsedContentKey}.
 * @param {RawEntryContent} args.content Parsed content.
 */
const cacheParsedContent = ({ parsedFileMap, path, key, content }) => {
  try {
    parsedFileMap.set(path, {
      key,
      // Copied, as the content is processed further, and the copy has to be cached as parsed
      content: structuredClone(content),
      format: detectedFrontMatterFormats.get(path),
    });
  } catch {
    // Content the database can’t store either; the file is just parsed again next time
  }
};

/**
 * Parse the raw content from the file and handle any errors. Content cached from a previous load
 * is used instead if it was parsed for the same CMS version and configuration, as parsing every
 * file is the bulk of the work of loading the site data.
 * @param {BaseEntryListItem} file Entry file list item.
 * @param {Error[]} errors List of parse errors.
 * @param {ParsedFileMap} [parsedFileMap] Map to add the content parsed from the file to, so it can
 * be cached. A file whose content comes from the cache isn’t added.
 * @returns {Promise<RawEntryContent | undefined>} Parsed content or undefined if parsing failed.
 */
export const parseFileContent = async (file, errors, parsedFileMap) => {
  const { path, parsed } = file;
  const key = getParsedContentKey();

  if (parsed?.key === key && !hasCustomParser(file)) {
    if (parsed.format) {
      // Remembered, so the file is saved back in the same format, as when it was parsed
      detectedFrontMatterFormats.set(path, parsed.format);
    }

    return parsed.content;
  }

  try {
    // A file whose content couldn’t be read, e.g. because it’s too large, has no text. Parsing it
    // as an empty file would load an empty entry, and saving that would wipe the file
    if (file.text === undefined) {
      throw new Error(`${path} could not be read.`);
    }

    const content = await parseEntryFile(file);

    if (hasCircularReference(content)) {
      throw new Error(`${path} could not be parsed, as it contains a circular reference.`);
    }

    // Parsing a file remembers the source text of any integer a `number` can’t represent exactly,
    // which is what the integer is saved as, so such a file has to be parsed every time
    if (parsedFileMap && !hasCustomParser(file) && !mayHaveUnsafeInteger(file.text)) {
      cacheParsedContent({ parsedFileMap, path, key, content });
    }

    return content;
  } catch (/** @type {any} */ ex) {
    // eslint-disable-next-line no-console
    console.error(ex);
    errors.push(ex);
    return undefined;
  }
};

/**
 * Transform root field content.
 * @param {object} args Arguments.
 * @param {RawEntryContent} args.rawContent Raw content from the file.
 * @param {Field[]} args.fields Collection fields.
 * @param {boolean} args.i18nSingleFile Whether i18n single file structure is used.
 * @param {(value: any) => boolean} args.validate Function to validate content items.
 * @returns {RawEntryContent | undefined} Transformed content.
 */
export const transformRoot = ({ rawContent, fields, i18nSingleFile, validate }) => {
  const fieldName = fields[0].name;

  if (i18nSingleFile) {
    if (!isObject(rawContent) || !Object.values(rawContent).every(validate)) {
      return undefined;
    }

    return Object.fromEntries(
      Object.entries(rawContent).map(([locale, content]) => [locale, { [fieldName]: content }]),
    );
  }

  if (!validate(rawContent)) {
    return undefined;
  }

  return { [fieldName]: rawContent };
};

/**
 * Normalize `single_file_default_root` content into the standard locale-keyed format used by the
 * `single_file` structure. Root-level entries (excluding non-default locale keys) become the
 * default locale’s content, and each non-default locale key becomes that locale’s content.
 * @param {RawEntryContent} rawContent Raw content from the file.
 * @param {InternalLocaleCode[]} allLocales All available locales.
 * @param {InternalLocaleCode} defaultLocale The default locale.
 * @returns {RawEntryContent | undefined} Normalized locale-keyed content or undefined if invalid.
 */
export const normalizeDefaultRootContent = (rawContent, allLocales, defaultLocale) => {
  if (!isObject(rawContent)) {
    return undefined;
  }

  const nonDefaultLocales = allLocales.filter((locale) => locale !== defaultLocale);

  // Root-level entries excluding non-default locale keys = default locale content
  const defaultContent = Object.fromEntries(
    Object.entries(rawContent).filter(([key]) => !nonDefaultLocales.includes(key)),
  );

  /** @type {RawEntryContent} */
  const result = { [defaultLocale]: defaultContent };

  nonDefaultLocales.forEach((locale) => {
    if (isObject(rawContent[locale])) {
      result[locale] = rawContent[locale];
    }
  });

  return result;
};

/**
 * Transform raw content to handle special cases like root List and root KeyValue fields.
 * @param {RawEntryContent} rawContent Raw content from the file.
 * @param {Field[]} fields Collection fields.
 * @param {boolean} i18nSingleFile Whether i18n single file structure is used.
 * @returns {RawEntryContent | undefined} Transformed content or undefined if invalid.
 */
export const transformRawContent = (rawContent, fields, i18nSingleFile) => {
  const args = { rawContent, fields, i18nSingleFile };

  // Handle a special case: top-level List field
  if (hasRootField(fields, 'list')) {
    return transformRoot({ ...args, validate: Array.isArray });
  }

  // Handle a special case: top-level KeyValue field
  if (hasRootField(fields, 'keyvalue')) {
    return transformRoot({
      ...args,
      // Check if the key-value pairs are in an object format and each value is a string
      // eslint-disable-next-line jsdoc/require-jsdoc
      validate: (value) =>
        isObject(value) && Object.values(value).every((val) => typeof val === 'string'),
    });
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
  // 4. The collection is a nested collection where every entry is stored as `_index.md`
  return !(
    !!fileName ||
    getIndexFile(collection)?.name === '_index' ||
    (subPathTemplate?.split('/').pop() === '_index' && extension === 'md') ||
    getNestedIndexFileName(collection) === '_index'
  );
};

/**
 * Extract subPath and locale information from the file path.
 * @param {object} args Arguments.
 * @param {BaseEntryListItem} args.file Entry file list item.
 * @param {string} [args.fileName] Collection file name.
 * @param {RegExp} [args.fullPathRegEx] Full path regex for parsing.
 * @param {InternalLocaleCode} args.defaultLocale Default locale.
 * @param {boolean} args.isMultiFileStructure Whether using multi-file i18n structure.
 * @returns {{ subPath: string | undefined, locale: InternalLocaleCode | undefined }} Path info.
 */
export const extractPathInfo = ({
  file,
  fileName,
  fullPathRegEx,
  defaultLocale,
  isMultiFileStructure,
}) => {
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

  // If the `omit_default_locale_from_file_path` i18n option is enabled, the matching comes with
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
 * @param {object} args Arguments.
 * @param {Entry} args.entry Entry object to populate.
 * @param {RawEntryContent} args.rawContent Raw content.
 * @param {string} args.path File path.
 * @param {string} [args.fileName] Collection file name.
 * @param {string} args.subPath Sub path.
 * @param {string} [args.subPathTemplate] Sub path template.
 */
export const processNonI18nEntry = ({
  entry,
  rawContent,
  path,
  fileName,
  subPath,
  subPathTemplate,
}) => {
  const slug = fileName || getSlug({ subPath, subPathTemplate });

  entry.slug = slug;
  entry.locales._default = { slug, path, content: flattenKeys(rawContent) };
};

/**
 * Process entry for single-file i18n structure.
 * @param {object} args Arguments.
 * @param {Entry} args.entry Entry object to populate.
 * @param {RawEntryContent} args.rawContent Raw content.
 * @param {string} args.path File path.
 * @param {string} [args.fileName] Collection file name.
 * @param {string} args.subPath Sub path.
 * @param {string} [args.subPathTemplate] Sub path template.
 * @param {InternalLocaleCode[]} args.allLocales All available locales.
 */
export const processI18nSingleFileEntry = ({
  entry,
  rawContent,
  path,
  fileName,
  subPath,
  subPathTemplate,
  allLocales,
}) => {
  const slug = fileName || getSlug({ subPath, subPathTemplate });

  entry.slug = slug;
  entry.locales = Object.fromEntries(
    allLocales
      // A locale key without an object, e.g. an empty `fr:` stub, has no content to read
      .filter((_locale) => isObject(rawContent[_locale]))
      .map((_locale) => [_locale, { slug, path, content: flattenKeys(rawContent[_locale]) }]),
  );
};

/**
 * Process entry for multi-file i18n structure.
 * @param {object} args Arguments.
 * @param {Entry} args.entry Entry object to populate.
 * @param {RawEntryContent} args.rawContent Raw content.
 * @param {string} args.path File path.
 * @param {string} [args.fileName] Collection file name.
 * @param {string} args.subPath Sub path.
 * @param {string} [args.subPathTemplate] Sub path template.
 * @param {InternalLocaleCode} args.locale Current locale.
 * @param {InternalLocaleCode} args.defaultLocale Default locale.
 * @param {string} args.collectionName Collection name.
 * @param {string} [args.canonicalSlugKey] Canonical slug key.
 * @param {Map<string, Entry>} args.entryMap Entries prepared so far, keyed by their temporary ID. A
 * new entry is registered here so that its other locales can find it.
 * @returns {boolean} True if entry was added to existing entry, false if new entry should be added.
 */
export const processI18nMultiFileEntry = ({
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
  entryMap,
}) => {
  // Support a canonical slug to link localized files
  const canonicalSlug =
    canonicalSlugKey && typeof rawContent[canonicalSlugKey] === 'string'
      ? rawContent[canonicalSlugKey]
      : undefined;

  const slug = fileName || getSlug({ subPath, subPathTemplate });
  const localizedEntry = { slug, path, content: flattenKeys(rawContent) };
  // Use a temporary ID to locate all the localized files for the entry. The sub path is the same
  // across locales, while the slug may not be unique, e.g. with the `{{year}}/{{slug}}` path. A
  // collection file is identified by its name, so a canonical slug in one of its locales can’t
  // split it into two entries
  const tempId = `${collectionName}/${fileName || (canonicalSlug ?? subPath)}`;
  // Check if the entry has already been added for another locale. A lookup in the map rather than
  // a scan of the entry list keeps this linear over a repository with thousands of localized files
  const existingEntry = entryMap.get(tempId);

  // If found, add a new locale to the existing entry; don’t add another entry
  if (existingEntry) {
    existingEntry.locales[locale] = localizedEntry;

    // The default locale defines the entry’s identity, but any other locale stands in when its file
    // is absent. Otherwise the entry would have no slug and `prepareEntries()` would drop it, which
    // happens with Editorial Workflow whenever a pull request touches only a non-default locale
    if (locale === defaultLocale || !existingEntry.slug) {
      existingEntry.slug = slug;
      existingEntry.subPath = subPath;
    }

    return true; // Entry was merged with existing
  }

  entry.id = tempId;
  entry.locales[locale] = localizedEntry;
  // The default locale file overrides this when it’s processed, in the branch above
  entry.slug = slug;
  entryMap.set(tempId, entry);

  return false; // New entry should be added
};

/**
 * Raw items of the files storing all the entries of an entry collection, keyed by file path, as
 * they were last parsed. A save rewrites the file from these rather than from the entries, so the
 * items that don’t make an entry, and the properties that aren’t defined as fields, are kept as
 * they are. `null` for a file that doesn’t contain a valid array, which can’t be updated.
 * @type {Map<string, any[] | null>}
 */
export const arrayFileItems = new Map();

/**
 * Create an entry from an item in a file storing all the entries of an entry collection. With i18n
 * enabled, the item holds all the translations, like a file with the `single_file` or
 * `single_file_default_root` structure does.
 * @param {object} args Arguments.
 * @param {InternalEntryCollection} args.collection Collection.
 * @param {any} args.item Raw item.
 * @param {number} args.index Position of the item in the array.
 * @param {string} args.path File path.
 * @param {RepositoryFileMetadata} [args.meta] File metadata.
 * @returns {Entry | undefined} Entry, or `undefined` if the item doesn’t make one.
 */
export const createArrayItemEntry = ({ collection, item, index, path, meta = {} }) => {
  const {
    fields,
    _i18n: {
      i18nEnabled,
      allLocales,
      defaultLocale,
      structureMap: { i18nSingleFileDefaultRoot },
    },
  } = collection;

  const rawContent = i18nSingleFileDefaultRoot
    ? normalizeDefaultRootContent(item, allLocales, defaultLocale)
    : item;

  const content = rawContent ? transformRawContent(rawContent, fields, i18nEnabled) : undefined;

  if (!content) {
    return undefined;
  }

  // The position is the slug, as an item has no file name to take one from
  const subPath = String(index);
  /** @type {Entry} */
  const entry = { id: '', slug: '', subPath, locales: {}, arrayIndex: index, ...meta };

  if (i18nEnabled) {
    processI18nSingleFileEntry({ entry, rawContent: content, path, subPath, allLocales });
  } else {
    processNonI18nEntry({ entry, rawContent: content, path, subPath });
  }

  return Object.keys(entry.locales).length ? entry : undefined;
};

/**
 * Prepare the entries stored in a file of an entry collection that stores all the entries in one
 * file, one for each object in the array.
 * @param {object} args Arguments.
 * @param {InternalEntryCollection} args.collection Collection.
 * @param {BaseEntryListItem} args.file Entry file list item.
 * @param {any} args.rawContent Parsed file content.
 * @param {Entry[]} args.entries List of prepared entries.
 * @param {Error[]} args.errors List of parse errors.
 */
export const prepareArrayFileEntries = ({ collection, file, rawContent, entries, errors }) => {
  const { path, meta = {} } = file;

  if (!Array.isArray(rawContent)) {
    arrayFileItems.set(path, null);
    errors.push(new Error(`${path} could not be parsed, as it doesn’t contain an array.`));

    return;
  }

  arrayFileItems.set(path, rawContent);

  rawContent.forEach((item, index) => {
    const entry = createArrayItemEntry({ collection, item, index, path, meta });

    if (entry) {
      entries.push(entry);
    }
  });
};

/**
 * Prepare a new entry by processing the given file info and raw content.
 * @param {object} args Arguments.
 * @param {BaseEntryListItem} args.file Entry file list item.
 * @param {Entry[]} args.entries List of prepared entries.
 * @param {Map<string, Entry>} args.entryMap Prepared entries keyed by their temporary ID, used to
 * merge the localized files of a multi-file i18n entry.
 * @param {Error[]} args.errors List of parse errors.
 * @param {ParsedFileMap} [args.parsedFileMap] Map to add the content parsed from the file to. See
 * {@link parseFileContent}.
 */
export const prepareEntry = async ({ file, entries, entryMap, errors, parsedFileMap }) => {
  const rawContent = await parseFileContent(file, errors, parsedFileMap);

  const {
    path,
    meta = {},
    folder: { collectionName, fileName },
  } = file;

  const { collection, collectionFile } = resolveCollectionAndFile(collectionName, fileName) ?? {};

  // A file storing all the entries of an entry collection
  const isArrayFile =
    !collectionFile && collection?._type === 'entry' && collection._file.arrayFile;

  if (!rawContent) {
    // Make sure the array file is not overwritten
    if (isArrayFile) {
      arrayFileItems.set(path, null);
    }

    return;
  }

  if (!collection) {
    return;
  }

  if (isArrayFile) {
    prepareArrayFileEntries({ collection, file, rawContent, entries, errors });

    return;
  }

  const {
    fields = [],
    _file: { fullPathRegEx, subPath: subPathTemplate, extension },
    _i18n: {
      i18nEnabled,
      allLocales,
      defaultLocale,
      structureMap,
      canonicalSlug: { key: canonicalSlugKey },
    },
  } = collectionFile ?? /** @type {InternalEntryCollection} */ (collection);

  // Normalize `single_file_default_root` content into the standard locale-keyed format so that the
  // rest of the processing pipeline can treat it identically to `single_file`.
  const effectiveRawContent = structureMap.i18nSingleFileDefaultRoot
    ? normalizeDefaultRootContent(rawContent, allLocales, defaultLocale)
    : rawContent;

  if (!effectiveRawContent) {
    return;
  }

  const isI18nSingleFile = usesSingleFileStructure(structureMap);
  const transformedContent = transformRawContent(effectiveRawContent, fields, isI18nSingleFile);

  if (!transformedContent) {
    return;
  }

  if (shouldSkipIndexFile(path, fileName, collection, subPathTemplate, extension)) {
    return;
  }

  const isMultiFileStructure = usesMultiFileStructure(structureMap);

  const { subPath, locale } = extractPathInfo({
    file,
    fileName,
    fullPathRegEx,
    defaultLocale,
    isMultiFileStructure,
  });

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

  const entryArgs = {
    entry,
    rawContent: transformedContent,
    path,
    fileName,
    subPath,
    subPathTemplate,
  };

  if (!i18nEnabled) {
    processNonI18nEntry(entryArgs);
  } else if (isI18nSingleFile) {
    processI18nSingleFileEntry({ ...entryArgs, allLocales });
  } else {
    // `isMultiFileStructure` is always true here (the only non-`i18nSingleFile` path), and `locale`
    // is always set (the guard above returned early if it wasn’t).
    const wasMerged = processI18nMultiFileEntry({
      ...entryArgs,
      locale: /** @type {InternalLocaleCode} */ (locale),
      defaultLocale,
      collectionName,
      canonicalSlugKey,
      entryMap,
    });

    if (wasMerged) {
      return; // Entry was merged with existing, don’t add to entries array
    }
  }

  entries.push(entry);
};

/**
 * Parse the given entry files to create a complete, serialized entry list.
 * @param {BaseEntryListItem[]} entryFiles Entry file list.
 * @param {object} [options] Options.
 * @param {ParsedFileMap} [options.parsedFileMap] Map to add the content parsed from each file to,
 * so it can be cached. See {@link parseFileContent}.
 * @returns {Promise<{ entries: Entry[], errors: Error[] }>} Entry list and error list.
 */
export const prepareEntries = async (entryFiles, { parsedFileMap } = {}) => {
  /** @type {Entry[]} */
  const entries = [];
  /** @type {Map<string, Entry>} */
  const entryMap = new Map();
  /** @type {Error[]} */
  const errors = [];

  // Parsing is synchronous, so a large repository would freeze the tab for the whole batch while
  // the progress indicator stalls. Yield between chunks instead
  await runInChunks(entryFiles, async (file) => {
    // A file that can’t be processed is reported like a parse error, rather than stopping the whole
    // list from loading
    try {
      await prepareEntry({ file, entries, entryMap, errors, parsedFileMap });
    } catch (/** @type {any} */ ex) {
      // eslint-disable-next-line no-console
      console.error(ex);
      errors.push(ex);
    }
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
