import { fromJS } from 'immutable';

import { getAssetByPath } from '$lib/services/assets';
import { AssetProxy } from '$lib/services/contents/api/asset-proxy';
import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
import { getCollectionFileEntry } from '$lib/services/contents/collection/files';
import { getField } from '$lib/services/contents/entry/fields';

/**
 * @import { Entry, GetFieldArgs, InternalLocaleCode } from '$lib/types/private';
 * @import { ApiAsset, FieldKeyPath } from '$lib/types/public';
 */

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
