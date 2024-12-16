import { get, writable } from 'svelte/store';
import { getMediaFieldURL } from '$lib/services/assets';
import { siteConfig } from '$lib/services/config';
import { allEntries } from '$lib/services/contents';
import { getCollection } from '$lib/services/contents/collection';
import { getFilesByEntry } from '$lib/services/contents/collection/files';
import { getAssociatedCollections } from '$lib/services/contents/entry';
import { getFieldConfig, getPropertyValue } from '$lib/services/contents/entry/fields';

/**
 * Regular expression to match `![alt](src "title")`.
 */
const markdownImageRegEx = /!\[.*?\]\((.+?)(?:\s+".*?")?\)/g;

/**
 * @type {import('svelte/store').Writable<Entry[]>}
 */
export const selectedEntries = writable([]);

/**
 * Get entries by the given collection name, while applying a filer if needed.
 * @param {string} collectionName - Collection name.
 * @returns {Entry[]} Entries.
 * @see https://decapcms.org/docs/collection-types#filtered-folder-collections
 */
export const getEntriesByCollection = (collectionName) => {
  const collection = getCollection(collectionName);

  if (!collection) {
    return [];
  }

  const {
    filter,
    _i18n: { defaultLocale: locale },
  } = collection;

  const filterField = filter?.field;

  const filterPattern =
    typeof filter?.pattern === 'string' ? new RegExp(filter.pattern) : undefined;

  const filterValues =
    filter?.value === undefined ? [] : Array.isArray(filter.value) ? filter.value : [filter.value];

  return get(allEntries).filter((entry) => {
    if (!getAssociatedCollections(entry).some(({ name }) => name === collectionName)) {
      return false;
    }

    if (!filterField) {
      return true;
    }

    const value = getPropertyValue({ entry, locale, collectionName, key: filterField }) ?? null;

    if (filterPattern) {
      return filterPattern.test(value);
    }

    return filterValues.includes(value);
  });
};

/**
 * Find entries by an asset URL, and replace the URL if needed.
 * @param {string} url - Asset’s public or blob URL.
 * @param {object} [options] - Options.
 * @param {Entry[]} [options.entries] - Entries to be searched.
 * @param {string} [options.newURL] - New URL to replace the found URL.
 * @returns {Promise<Entry[]>} Found (and replaced) entries.
 */
export const getEntriesByAssetURL = async (
  url,
  { entries = get(allEntries), newURL = '' } = {},
) => {
  const siteURL = get(siteConfig)?.site_url;
  const assetURL = siteURL && !url.startsWith('blob:') ? url.replace(siteURL, '') : url;

  const results = await Promise.all(
    entries.map(async (entry) => {
      const { locales } = entry;
      const collections = getAssociatedCollections(entry);

      const _results = await Promise.all(
        Object.values(locales).map(async ({ content }) => {
          const __results = await Promise.all(
            Object.entries(content).map(async ([keyPath, value]) => {
              if (typeof value !== 'string' || !value) {
                return false;
              }

              const ___results = await Promise.all(
                collections.map(async (collection) => {
                  /**
                   * Check if the field contains the asset.
                   * @param {CollectionFile} [collectionFile] - File. File collection only.
                   * @returns {Promise<boolean>} Result.
                   */
                  const hasAsset = async (collectionFile) => {
                    const field = getFieldConfig({
                      collectionName: collection.name,
                      fileName: collectionFile?.name,
                      valueMap: content,
                      keyPath,
                    });

                    if (!field) {
                      return false;
                    }

                    const { widget: widgetName = 'string' } = field;

                    if (['image', 'file'].includes(widgetName)) {
                      const match = (await getMediaFieldURL(value, entry)) === assetURL;

                      if (match && newURL) {
                        content[keyPath] = newURL;
                      }

                      return match;
                    }

                    // Search images in markdown body
                    if (widgetName === 'markdown') {
                      const matches = [...value.matchAll(markdownImageRegEx)];

                      if (matches.length) {
                        return (
                          await Promise.all(
                            matches.map(async ([, src]) => {
                              const match = (await getMediaFieldURL(src, entry)) === assetURL;

                              if (match && newURL) {
                                content[keyPath] = content[keyPath].replace(src, newURL);
                              }

                              return match;
                            }),
                          )
                        ).some(Boolean);
                      }
                    }

                    return false;
                  };

                  const collectionFiles = getFilesByEntry(collection, entry);

                  if (collectionFiles.length) {
                    return (await Promise.all(collectionFiles.map(hasAsset))).includes(true);
                  }

                  return hasAsset();
                }),
              );

              return ___results.includes(true);
            }),
          );

          return __results.includes(true);
        }),
      );

      return _results.includes(true);
    }),
  );

  return entries.filter((_entry, index) => results[index]);
};
