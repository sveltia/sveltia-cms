import { fromJS } from 'immutable';
import { get } from 'svelte/store';

import { AssetProxy } from '$lib/services/api/asset-proxy';
import { allAssets, getAssetByPath, isAssetInFolder } from '$lib/services/assets';
import { getAssetFolder } from '$lib/services/assets/folders';
import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
import { getCollectionFileEntry } from '$lib/services/contents/collection/files';
import { getField } from '$lib/services/contents/entry/fields';
import { unflattenMap } from '$lib/services/utils/object';

/**
 * @import { MapOf } from 'immutable';
 * @import {
 * Asset,
 * Entry,
 * EntryDraft,
 * FlattenedEntryContent,
 * GetFieldArgs,
 * InternalLocaleCode,
 * } from '$lib/types/private';
 * @import { ApiAsset, ApiEntry, FieldKeyPath } from '$lib/types/public';
 */

/**
 * @typedef {object} PreviewData
 * @property {MapOf<ApiEntry>} entryMap Immutable Map of entry data for the current locale.
 * @property {FlattenedEntryContent} valueMap Flattened content values for the current locale.
 * @property {Omit<GetFieldArgs, 'keyPath'>} getFieldArgs Arguments for getField function.
 * @property {MapOf<any>} fieldsMetaData Metadata for fields in the current locale.
 * @property {(path: string) => ApiAsset | undefined} getAsset Function to get asset URLs.
 */

/**
 * Create an Immutable.js Map representing the entry data, compatible with Netlify/Decap CMS event
 * hook handlers.
 * @param {object} args Arguments.
 * @param {FlattenedEntryContent} args.content Entry content for the default locale.
 * @param {string[]} args.otherLocales Other locale keys.
 * @param {Entry['locales']} args.locales All locale data keyed by locale.
 * @param {string} args.slug Entry slug.
 * @param {string} args.path Entry file path.
 * @param {boolean} args.isNew Whether the entry is new.
 * @param {string} args.collectionName Collection name.
 * @param {Asset[]} args.associatedAssets Assets associated with the entry.
 * @returns {MapOf<ApiEntry>} Immutable Map of the entry data.
 * @see https://immutable-js.com/docs/v5/Map/
 */
export const createEntryMap = ({
  content,
  otherLocales,
  locales,
  slug,
  path,
  isNew,
  collectionName,
  associatedAssets,
}) =>
  // @ts-ignore
  fromJS({
    // Entry data for the default locale
    data: unflattenMap(content),
    // Entry data for other locales
    // @see https://github.com/decaporg/decap-cms/issues/4729
    i18n: Object.fromEntries(
      otherLocales.map((locale) => [locale, { data: unflattenMap(locales[locale].content) }]),
    ),
    // Other entry properties
    slug,
    path,
    newRecord: isNew,
    collection: collectionName,
    mediaFiles: associatedAssets.map(({ sha, file, size, blobURL, ...asset }) => ({
      id: sha,
      name: asset.name,
      path: asset.path,
      file,
      size,
      url: blobURL,
      displayURL: blobURL,
    })),
    // Additional properties included for compatibility with Netlify/Decap CMS
    meta: { path },
    isModification: null,
    label: null,
    partial: false,
    author: '',
    raw: '',
    status: '',
    updatedOn: '',
  });

/**
 * Convert an entry to an Immutable Map for preview templates.
 * @param {object} args Arguments.
 * @param {Entry | undefined} args.entry Entry object to convert.
 * @param {InternalLocaleCode} args.locale Locale to use for content and path extraction.
 * @param {string} args.collectionName Collection name.
 * @param {Asset[]} args.associatedAssets Associated assets to include.
 * @param {FlattenedEntryContent} [args.content] Optional content override (if not provided,
 * extracted from entry).
 * @returns {MapOf<ApiEntry>} Immutable Map of entry data.
 */
export const convertEntryToMap = ({ entry, locale, collectionName, associatedAssets, content }) => {
  const entryContent = content ?? entry?.locales?.[locale]?.content ?? {};

  return /** @type {MapOf<ApiEntry>} */ (
    createEntryMap({
      content: entryContent,
      otherLocales: Object.keys(entry?.locales ?? {}).filter((l) => l !== locale),
      locales: entry?.locales ?? {},
      slug: entry?.slug ?? '',
      path: entry?.locales?.[locale]?.path ?? '',
      isNew: false,
      collectionName,
      associatedAssets,
    })
  );
};

/**
 * Create an asset getter function for React components (preview templates and custom field types).
 * @param {object} args Arguments.
 * @param {Entry} args.entry Entry object.
 * @param {string} args.collectionName Collection name.
 * @param {string} [args.fileName] File name.
 * @returns {(path: string) => ApiAsset | undefined} Function that gets asset URLs.
 */
export const createGetAsset =
  ({ entry, collectionName, fileName }) =>
  /**
   * Get the asset URL for a given asset path.
   * @param {string} path Path to the asset.
   * @returns {ApiAsset | undefined} Asset item.
   */
  (path) => {
    const asset = getAssetByPath({ value: path, entry, collectionName, fileName });

    if (asset) {
      return new AssetProxy(asset);
    }

    return undefined;
  };

/**
 * Get metadata for fields. For relation fields, looks up and stores the referenced entry content
 * keyed by collection name and value, matching the `fieldsMetaData` structure expected by
 * Netlify/Decap CMS preview templates and custom field types.
 * @param {object} args Arguments.
 * @param {InternalLocaleCode} args.locale Current locale.
 * @param {Omit<GetFieldArgs, 'keyPath'>} args.getFieldArgs Arguments for getField function.
 * @returns {import('immutable').MapOf<any>} Immutable Map of entry metadata.
 */
export const getMetaData = ({ locale, getFieldArgs }) => {
  const { valueMap = {} } = getFieldArgs;
  /** @type {Record<string, any>} */
  const metaData = {};
  /** @type {Map<string, Entry[]>} */
  const refEntriesCache = new Map();

  Object.entries(valueMap).forEach(([key, value]) => {
    const keyPath = /** @type {FieldKeyPath} */ (key.replace(/\.\d+$/, ''));
    const field = getField({ ...getFieldArgs, keyPath });

    // Populate metadata for relation fields by looking up referenced entries
    if (field?.widget === 'relation') {
      const {
        value_field: valueField = '{{slug}}',
        collection: refCollection,
        file: refFile,
      } = field;

      const refEntries = (() => {
        const cacheKey = `${refCollection}:${refFile ?? ''}`;
        const cache = refEntriesCache.get(cacheKey);

        if (cache) {
          return cache;
        }

        const entries = (
          refFile
            ? [getCollectionFileEntry(refCollection, refFile)]
            : getEntriesByCollection(refCollection)
        ).filter((entry) => !!entry);

        refEntriesCache.set(cacheKey, entries);

        return entries;
      })();

      metaData[keyPath] ??= {};
      metaData[keyPath][refCollection] ??= {};
      metaData[keyPath][refCollection][value] = refEntries.find((entry) =>
        valueField === '{{slug}}'
          ? entry.slug === value
          : entry.locales[locale]?.content?.[valueField] === value,
      )?.locales[locale]?.content;
    }
  });

  return /** @type {import('immutable').MapOf<any>} */ (fromJS(metaData));
};

/**
 * Build a synthetic entry object with current values for live preview updates.
 * @internal
 * @param {object} args Arguments.
 * @param {Entry | undefined} args.originalEntry The original entry object.
 * @param {Record<InternalLocaleCode, FlattenedEntryContent>} args.currentValues Object with locale
 * keys mapping to current content values.
 * @returns {Entry} A new entry object with updated locale content while preserving original slugs
 * and paths.
 */
export const buildEntry = ({ originalEntry, currentValues }) =>
  /** @type {Entry} */ ({
    ...originalEntry,
    locales: Object.fromEntries(
      Object.entries(currentValues).map(([locale, content]) => [
        locale,
        {
          slug: originalEntry?.locales[locale]?.slug ?? originalEntry?.slug,
          path: originalEntry?.locales[locale]?.path ?? originalEntry?.subPath,
          content,
        },
      ]),
    ),
  });

/**
 * Get assets associated with a collection or entry folder.
 * @param {object} args Arguments.
 * @param {string} [args.collectionName] Collection name.
 * @param {string} [args.fileName] File name.
 * @returns {Asset[]} Assets filtered to the relevant folder.
 */
export const getAssociatedPreviewAssets = ({ collectionName, fileName }) => {
  const assetFolder = getAssetFolder({ collectionName, fileName });

  if (assetFolder) {
    return get(allAssets).filter((asset) => isAssetInFolder(asset, assetFolder));
  }

  return [];
};

/**
 * Build shared preview data used by both preview templates and custom field types.
 *
 * {@link PreviewData.fieldsMetaData} is computed only when it’s read, and the result is kept for
 * subsequent reads. Building it walks every value in the entry and scans the referenced collection
 * for each Relation field value, while a custom field control only needs
 * {@link PreviewData.entryMap}. Given that the data is rebuilt whenever the draft is updated, doing
 * that work upfront would cost a collection scan on every keystroke.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft being previewed.
 * @param {InternalLocaleCode} args.locale Current locale.
 * @returns {PreviewData} Object containing computed preview data.
 */
export const buildPreviewData = ({ draft, locale }) => {
  const { collectionName, fileName, isIndexFile, originalEntry, currentValues } = draft;
  const entry = buildEntry({ originalEntry, currentValues });
  /* v8 ignore next */
  const valueMap = entry.locales[locale].content ?? {};
  /** @type {Omit<GetFieldArgs, 'keyPath'>} */
  const getFieldArgs = { collectionName, fileName, valueMap, isIndexFile };
  /** @type {MapOf<any> | undefined} */
  let fieldsMetaData;

  return {
    entryMap: convertEntryToMap({
      entry,
      locale,
      collectionName,
      associatedAssets: getAssociatedPreviewAssets({ collectionName, fileName }),
      content: valueMap,
    }),
    valueMap,
    getFieldArgs,
    // eslint-disable-next-line jsdoc/require-jsdoc
    get fieldsMetaData() {
      fieldsMetaData ??= getMetaData({ locale, getFieldArgs });

      return fieldsMetaData;
    },
    getAsset: createGetAsset({ entry, collectionName, fileName }),
  };
};
