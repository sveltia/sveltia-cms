import { generateUUID } from '@sveltia/utils/crypto';
import { getPathInfo } from '@sveltia/utils/file';
import { isObject } from '@sveltia/utils/object';
import { escapeRegExp } from '@sveltia/utils/string';
import { flatten } from 'flat';
import { hasRootListField } from '$lib/components/contents/details/widgets/list/helper';
import { getCollection } from '$lib/services/contents';
import { getEntryPathRegEx, getFileExtension } from '$lib/services/contents/file';
import { parseEntryFile } from '$lib/services/contents/file/parse';
import { normalizeSlug } from '$lib/services/contents/slug';

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

  if (!collection) {
    return;
  }

  const collectionFile = fileName ? collection._fileMap?.[fileName] : undefined;

  const {
    fields = [],
    _i18n: {
      i18nEnabled,
      locales,
      defaultLocale,
      structure,
      canonicalSlug: { key: canonicalSlugKey },
    },
  } = collectionFile ?? collection;

  const i18nSingleFile = i18nEnabled && structure === 'single_file';
  const i18nMultiFiles = i18nEnabled && structure === 'multiple_files';
  const i18nMultiFolders = i18nEnabled && structure === 'multiple_folders';

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

  /** @type {string | undefined} */
  let filePath = undefined;
  /** @type {LocaleCode | undefined} */
  let locale = undefined;

  if (fileName) {
    if (i18nMultiFiles || i18nMultiFolders) {
      [locale, filePath] =
        Object.entries(filePathMap ?? {}).find(([, locPath]) => locPath === path) ?? [];
    } else {
      filePath = path;
    }
  } else {
    ({ filePath, locale } = path.match(getEntryPathRegEx(collection))?.groups ?? {});
  }

  if (!filePath) {
    return;
  }

  /** @type {Entry} */
  const entry = { id: '', slug: '', sha, locales: {}, ...meta };

  if (!i18nEnabled) {
    const slug = fileName || getSlug(collectionName, filePath, rawContent);

    entry.slug = slug;
    entry.locales._default = { slug, path, sha, content: flatten(rawContent) };
  }

  if (i18nSingleFile) {
    const content = rawContent[defaultLocale] ?? Object.values(rawContent)[0];
    const slug = fileName || getSlug(collectionName, filePath, content);

    entry.slug = slug;
    entry.locales = Object.fromEntries(
      locales
        .filter((_locale) => _locale in rawContent)
        .map((_locale) => [_locale, { slug, path, sha, content: flatten(rawContent[_locale]) }]),
    );
  }

  if (i18nMultiFiles || i18nMultiFolders) {
    if (!locale) {
      return;
    }

    const slug = fileName || getSlug(collectionName, filePath, rawContent);
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
