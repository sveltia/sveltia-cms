import { generateUUID } from '@sveltia/utils/crypto';
import { getPathInfo } from '@sveltia/utils/file';
import { isObject } from '@sveltia/utils/object';
import { escapeRegExp } from '@sveltia/utils/string';
import { flatten } from 'flat';
import { hasRootListField } from '$lib/services/contents/widgets/list/helper';
import { parseEntryFile } from '$lib/services/contents/file/parse';
import { getCollection } from '$lib/services/contents/collection';

/**
 * Determine the slug for the given entry content.
 * @param {object} args - Arguments.
 * @param {string} args.subPath - File path without the collection folder, locale and extension.
 * It’s a slug in most cases, but it may be a path containing slash(es) when the Folder Collections
 * Path is configured.
 * @param {string | undefined} args.subPathTemplate - Collection’s `subPath` configuration.
 * @returns {string} Slug.
 * @see https://decapcms.org/docs/configuration-options/#slug
 * @see https://decapcms.org/docs/collection-folder/#folder-collections-path
 */
const getSlug = ({ subPath, subPathTemplate }) => {
  if (subPathTemplate?.includes('{{slug}}')) {
    const [, slug] =
      subPath.match(
        new RegExp(`^${escapeRegExp(subPathTemplate).replace('\\{\\{slug\\}\\}', '(.+)')}$`),
      ) ?? [];

    if (slug) {
      return slug;
    }
  }

  return subPath;
};

/**
 * Prepare a new entry by processing the given file info and raw content.
 * @param {object} args - Arguments.
 * @param {BaseEntryListItem} args.file - Entry file list item.
 * @param {Entry[]} args.entries - List of prepared entries.
 * @param {Error[]} args.errors - List of parse errors.
 */
const prepareEntry = async ({ file, entries, errors }) => {
  /** @type {any} */
  let rawContent;

  try {
    rawContent = await parseEntryFile(file);
  } catch (/** @type {any} */ ex) {
    // eslint-disable-next-line no-console
    console.error(ex);
    errors.push(ex);
  }

  if (!rawContent) {
    return;
  }

  const {
    path,
    sha,
    meta = {},
    folder: { collectionName, fileName, filePathMap },
  } = file;

  const collection = getCollection(collectionName);

  const collectionFile = fileName
    ? /** @type {FileCollection} */ (collection)?._fileMap[fileName]
    : undefined;

  if (!collection || (fileName && !collectionFile)) {
    return;
  }

  const {
    fields = [],
    _file: { fullPathRegEx, subPath: subPathTemplate, extension },
    _i18n: {
      i18nEnabled,
      locales,
      defaultLocale,
      structure,
      canonicalSlug: { key: canonicalSlugKey },
    },
  } = collectionFile ?? /** @type {EntryCollection} */ (collection);

  const i18nSingleFile = i18nEnabled && structure === 'single_file';
  const i18nMultiFile = i18nEnabled && structure === 'multiple_files';
  const i18nMultiFolder = i18nEnabled && structure === 'multiple_folders';

  // Handle a special case: top-level list field
  if (hasRootListField(fields)) {
    const fieldName = fields[0].name;

    if (i18nSingleFile) {
      if (!isObject(rawContent) || !Object.values(rawContent).every(Array.isArray)) {
        return;
      }

      rawContent = Object.fromEntries(
        Object.entries(rawContent).map(([locale, content]) => [locale, { [fieldName]: content }]),
      );
    } else {
      if (!Array.isArray(rawContent)) {
        return;
      }

      rawContent = { [fieldName]: rawContent };
    }
  }

  if (!isObject(rawContent)) {
    return;
  }

  // Skip Hugo’s special `_index.md` file that shouldn’t appear in an entry collection, unless the
  // collection’s `path` ends with `_index` and the extension is `md`. Localized index files like
  // `_index.en.md` are also excluded.
  if (
    /^_index(?:\..+)?\.md$/.test(getPathInfo(path).basename) &&
    !(subPathTemplate?.split('/').pop() === '_index' && extension === 'md') &&
    !fileName
  ) {
    return;
  }

  /** @type {string | undefined} */
  let subPath = undefined;
  /** @type {LocaleCode | undefined} */
  let locale = undefined;

  if (fileName) {
    if (i18nMultiFile || i18nMultiFolder) {
      [locale, subPath] =
        Object.entries(filePathMap ?? {}).find(([, locPath]) => locPath === path) ?? [];
    } else {
      subPath = path;
    }
  } else {
    ({ subPath, locale } = path.match(/** @type {RegExp} */ (fullPathRegEx))?.groups ?? {});
  }

  if (!subPath) {
    return;
  }

  /** @type {Entry} */
  const entry = {
    id: '',
    sha,
    slug: '',
    subPath,
    locales: {},
    ...meta,
  };

  if (!i18nEnabled) {
    const slug = fileName || getSlug({ subPath, subPathTemplate });

    entry.slug = slug;
    entry.locales._default = { slug, path, sha, content: flatten(rawContent) };
  }

  if (i18nSingleFile) {
    const slug = fileName || getSlug({ subPath, subPathTemplate });

    entry.slug = slug;
    entry.locales = Object.fromEntries(
      locales
        .filter((_locale) => _locale in rawContent)
        .map((_locale) => [_locale, { slug, path, sha, content: flatten(rawContent[_locale]) }]),
    );
  }

  if (i18nMultiFile || i18nMultiFolder) {
    if (!locale) {
      return;
    }

    const slug = fileName || getSlug({ subPath, subPathTemplate });
    const localizedEntry = { slug, path, sha, content: flatten(rawContent) };
    // Support a canonical slug to link localized files
    const canonicalSlug = rawContent[canonicalSlugKey];
    // Use a temporary ID to locate all the localized files for the entry
    const tempId = `${collectionName}/${canonicalSlug ?? slug}`;
    // Check if the entry has already been added for another locale
    const existingEntry = entries.find((e) => e.id === tempId);

    // If found, add a new locale to the existing entry; don’t add another entry
    if (existingEntry) {
      existingEntry.locales[locale] = localizedEntry;

      if (locale === defaultLocale) {
        existingEntry.sha = sha;
        existingEntry.slug = slug;
        existingEntry.subPath = subPath;
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
};

/**
 * Parse the given entry files to create a complete, serialized entry list.
 * @param {BaseEntryListItem[]} entryFiles - Entry file list.
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
