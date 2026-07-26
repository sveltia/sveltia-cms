import { unflatten } from 'flat';
import { fromJS } from 'immutable';

import { getAssetByPath } from '$lib/services/assets';
import { AssetProxy } from '$lib/services/contents/api/asset-proxy';
import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
import { getCollectionFileEntry } from '$lib/services/contents/collection/files';
import { getField } from '$lib/services/contents/entry/fields';

/**
 * @import { MapOf } from 'immutable';
 * @import {
 * Asset,
 * Entry,
 * FlattenedEntryContent,
 * GetFieldArgs,
 * InternalLocaleCode,
 * } from '$lib/types/private';
 * @import { ApiAsset, ApiEntry, FieldKeyPath } from '$lib/types/public';
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
    data: unflatten(content),
    // Entry data for other locales
    // @see https://github.com/decaporg/decap-cms/issues/4729
    i18n: Object.fromEntries(
      otherLocales.map((locale) => [locale, { data: unflatten(locales[locale].content) }]),
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
 * Create an asset getter function for React components (preview templates and custom widgets).
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
 * Netlify/Decap CMS preview templates and custom widgets.
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
