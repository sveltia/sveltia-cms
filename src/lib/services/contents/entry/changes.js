import { IndexedDB } from '@sveltia/utils/storage';
import { get } from 'svelte/store';

import { backend } from '$lib/services/backends';
import { getPreviousSha } from '$lib/services/contents/draft/save/changes';
import { serializeContent } from '$lib/services/contents/draft/save/serialize';
import { formatEntryFile } from '$lib/services/contents/file/format';

/**
 * @import {
 * Entry,
 * FileChange,
 * InternalCollection,
 * InternalCollectionFile,
 * InternalEntryCollection,
 * } from '$lib/types/private';
 */

/**
 * Build a synthetic draft object suitable for {@link serializeContent}. Bulk operations that re-
 * save existing entries — reordering, cascading relation updates — don’t go through the entry
 * editor, so there’s no real draft to serialize with; only the few properties read by the
 * serializer are needed. The shape is identical for every entry in a given collection, so callers
 * working on a batch should build it once and pass it down to avoid per-entry allocations.
 * @param {object} args Arguments.
 * @param {InternalCollection} args.collection Collection the entries belong to.
 * @param {InternalCollectionFile} [args.collectionFile] Collection file, for file/singleton
 * collections.
 * @param {boolean} [args.isIndexFile] Whether the entry is the collection’s special index file.
 * @returns {any} Synthetic draft.
 */
export const createSyntheticDraft = ({ collection, collectionFile, isIndexFile = false }) => ({
  collection,
  collectionName: collection.name,
  collectionFile,
  fields: collectionFile?.fields ?? /** @type {InternalEntryCollection} */ (collection).fields,
  isIndexFile,
});

/**
 * Resolve a usable file-cache `IndexedDB` handle: prefer the caller-provided one (so the same
 * handle is shared across composite operations like delete + renumber), otherwise open one.
 * @param {IndexedDB} [provided] Caller-provided handle.
 * @returns {IndexedDB | undefined} Cache handle, or `undefined` if no backend is configured.
 */
export const resolveCacheDB = (provided) => {
  if (provided) {
    return provided;
  }

  const databaseName = get(backend)?.repository?.databaseName;

  return databaseName ? new IndexedDB(databaseName, 'file-cache') : undefined;
};

/**
 * Build the file content for a single-file entry, taking i18n single-file structures into account.
 * @internal
 * @param {object} args Arguments.
 * @param {InternalCollection | InternalCollectionFile} args.config Collection or collection file
 * holding the i18n configuration.
 * @param {Entry} args.entry Entry whose locales have already been updated.
 * @param {any} args.draft Synthetic draft.
 * @returns {Record<string, any>} Serializable content object passed to {@link formatEntryFile}.
 */
export const buildSingleFileContent = ({ config, entry, draft }) => {
  const {
    _i18n: { i18nEnabled, defaultLocale, structureMap: { i18nSingleFileDefaultRoot } = {} },
  } = config;

  if (!i18nEnabled) {
    return serializeContent({
      draft,
      locale: '_default',
      valueMap: entry.locales[defaultLocale].content,
    });
  }

  const localeContents = Object.fromEntries(
    Object.entries(entry.locales)
      .filter(([, le]) => !!le.content)
      .map(([locale, le]) => [locale, serializeContent({ draft, locale, valueMap: le.content })]),
  );

  if (i18nSingleFileDefaultRoot) {
    const { lang: _lang, ...defaultContent } = localeContents[defaultLocale] ?? {};

    const nonDefaultContent = Object.fromEntries(
      Object.entries(localeContents).filter(([locale]) => locale !== defaultLocale),
    );

    return {
      lang: [defaultLocale, ...Object.keys(nonDefaultContent)],
      ...defaultContent,
      ...nonDefaultContent,
    };
  }

  // `i18nSingleFile`: nested locale keys
  return localeContents;
};

/**
 * Build the `update` {@link FileChange}(s) needed to re-save an existing entry whose content has
 * already been modified in place. One change is produced per file the entry occupies: a single one
 * unless the collection uses a file-per-locale i18n structure.
 * @param {object} args Arguments.
 * @param {InternalCollection} args.collection Collection the entry belongs to.
 * @param {InternalCollectionFile} [args.collectionFile] Collection file, for file/singleton
 * collections.
 * @param {Entry} args.entry Entry with the updated content applied.
 * @param {any} args.draft Synthetic draft from {@link createSyntheticDraft}.
 * @param {IndexedDB} [args.cacheDB] File cache database, when available.
 * @returns {Promise<FileChange[]>} Update changes.
 */
export const buildEntryUpdateChanges = async ({
  collection,
  collectionFile,
  entry,
  draft,
  cacheDB,
}) => {
  const config = /** @type {InternalCollectionFile} */ (collectionFile ?? collection);

  const {
    _file,
    _i18n: {
      i18nEnabled,
      allLocales,
      defaultLocale,
      structureMap: { i18nSingleFile, i18nSingleFileDefaultRoot } = {},
    },
  } = config;

  if (!i18nEnabled || i18nSingleFile || i18nSingleFileDefaultRoot) {
    const { slug, path } = entry.locales[defaultLocale];

    const [previousSha, data] = await Promise.all([
      getPreviousSha({ cacheDB, previousPath: path }),
      formatEntryFile({ content: buildSingleFileContent({ config, entry, draft }), _file }),
    ]);

    return [/** @type {FileChange} */ ({ action: 'update', slug, path, previousSha, data })];
  }

  const localeChanges = await Promise.all(
    allLocales.map(async (locale) => {
      const le = entry.locales[locale];

      if (!le?.content) {
        return undefined;
      }

      const [previousSha, data] = await Promise.all([
        getPreviousSha({ cacheDB, previousPath: le.path }),
        formatEntryFile({
          content: serializeContent({ draft, locale, valueMap: le.content }),
          _file,
        }),
      ]);

      return /** @type {FileChange} */ ({
        action: 'update',
        slug: le.slug,
        path: le.path,
        previousSha,
        data,
      });
    }),
  );

  return /** @type {FileChange[]} */ (localeChanges.filter(Boolean));
};
