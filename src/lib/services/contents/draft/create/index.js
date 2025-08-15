import { get } from 'svelte/store';

import { siteConfig } from '$lib/services/config';
import { getIndexFile, isCollectionIndexFile } from '$lib/services/contents/collection/index-file';
import { entryDraft } from '$lib/services/contents/draft';
import { restoreBackupIfNeeded } from '$lib/services/contents/draft/backup';
import { createProxy } from '$lib/services/contents/draft/create/proxy';
import { getDefaultValues } from '$lib/services/contents/draft/defaults';

/**
 * @import {
 * InternalCollection,
 * InternalCollectionFile,
 * LocaleContentMap,
 * LocaleExpanderMap,
 * } from '$lib/types/private';
 */

/**
 * Create an entry draft.
 * @param {object} args Arguments.
 * @param {InternalCollection} args.collection Collection that the entry belongs to.
 * @param {InternalCollectionFile} [args.collectionFile] Collection file. File/singleton collection
 * only.
 * @param {any} [args.originalEntry] Entry to be edited, or a partial {@link Entry} object.
 * @param {Record<string, string>} [args.dynamicValues] Dynamic default values for a new entry
 * passed through URL parameters.
 * @param {LocaleExpanderMap} [args.expanderStates] Expander UI state. Can be set when resetting an
 * entry draft.
 * @param {boolean} [args.isIndexFile] Whether to edit the collection’s index file.
 */
export const createDraft = ({
  collection,
  collectionFile,
  originalEntry = {},
  dynamicValues,
  expanderStates,
  isIndexFile = isCollectionIndexFile(collection, originalEntry),
}) => {
  const { name: collectionName, editor } = collection;
  const fileName = collectionFile?.name;
  const { id, slug, locales } = originalEntry;
  const isNew = id === undefined;
  const { fields: regularFields = [], _i18n } = collectionFile ?? collection;
  const indexFile = isIndexFile ? getIndexFile(collection) : undefined;
  const fields = indexFile?.fields ?? regularFields;

  const canPreview =
    indexFile?.editor?.preview ?? editor?.preview ?? get(siteConfig)?.editor?.preview ?? true;

  const {
    allLocales,
    initialLocales,
    defaultLocale,
    canonicalSlug: { key: canonicalSlugKey = 'translationKey' },
  } = _i18n;

  const enabledLocales = isNew
    ? initialLocales
    : allLocales.filter((locale) => !!locales?.[locale]?.content);

  const originalLocales = Object.fromEntries(
    allLocales.map((locale) => [locale, enabledLocales.includes(locale)]),
  );

  const originalSlugs = isNew
    ? {}
    : canonicalSlugKey in (locales?.[defaultLocale]?.content ?? {})
      ? Object.fromEntries(allLocales.map((locale) => [locale, locales?.[locale]?.slug]))
      : { _: locales?.[defaultLocale].slug };

  /** @type {LocaleContentMap} */
  const originalValues = Object.fromEntries(
    enabledLocales.map((locale) =>
      isNew
        ? [locale, getDefaultValues(fields, locale, dynamicValues)]
        : [locale, structuredClone(locales?.[locale]?.content)],
    ),
  );

  entryDraft.set({
    createdAt: Date.now(),
    isNew,
    isIndexFile,
    canPreview,
    collectionName,
    collection,
    fileName,
    collectionFile,
    fields,
    originalEntry: isNew ? undefined : originalEntry,
    originalLocales,
    currentLocales: structuredClone(originalLocales),
    originalSlugs,
    currentSlugs: structuredClone(originalSlugs),
    originalValues,
    currentValues: Object.fromEntries(
      enabledLocales.map((locale) => [
        locale,
        createProxy({
          draft: { collectionName, fileName, isIndexFile },
          locale,
          target: structuredClone(originalValues[locale]),
        }),
      ]),
    ),
    files: {},
    extraValues: Object.fromEntries(allLocales.map((locale) => [locale, {}])),
    validities: Object.fromEntries(allLocales.map((locale) => [locale, {}])),
    // Any locale-agnostic view states will be put under the `_` key
    expanderStates: expanderStates ?? { _: {} },
  });

  restoreBackupIfNeeded({ collectionName, fileName, slug });
};
