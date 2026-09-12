import { _ } from '@sveltia/i18n';

import { getAssetKind } from '$lib/services/assets/kinds';
import { cmsConfig } from '$lib/services/config';
import { allEntries } from '$lib/services/contents';
import { isCollectionIndexFile } from '$lib/services/contents/collection/entries/index-file';
import { getCollectionFilesByEntry } from '$lib/services/contents/collection/files';
import { getAssociatedCollections } from '$lib/services/contents/entry';
import { getField } from '$lib/services/contents/entry/fields';
import { MEDIA_FIELD_TYPES } from '$lib/services/contents/fields';
import { allCloudStorageServices } from '$lib/services/integrations/media-libraries/cloud';
import { createDerivedState } from '$lib/services/utils/state.svelte';

/**
 * @import {
 * Entry,
 * ExternalAsset,
 * FlattenedEntryContent,
 * MediaLibraryService,
 * } from '$lib/types/private';
 */

/**
 * ID of the virtual location listing the files linked from entries. It’s routed like a cloud
 * storage service, at `#/assets/-/linked`.
 */
export const LINKED_FILES_SERVICE_ID = 'linked';

/**
 * Whether the given field value is an absolute URL rather than a path to a repository asset.
 */
const URL_REGEX = /^https?:\/\/\S+$/;

/**
 * Whether the given File/Image field value links to a file that is neither in the repository nor
 * on a configured cloud storage service, which have their own locations in the Asset Library. A
 * value that starts with the site’s base URL points to a repository asset, as the `public_folder`
 * option can be an absolute URL.
 * @param {string} value Field value.
 * @returns {boolean} Result.
 */
const isLinkedURL = (value) => {
  const baseURL = cmsConfig.current?._baseURL;

  return (
    URL_REGEX.test(value) &&
    !(baseURL && value.startsWith(baseURL)) &&
    !Object.values(allCloudStorageServices).some(
      ({ isEnabled, isAssetURL }) => (isEnabled?.() ?? true) && isAssetURL?.(value),
    )
  );
};

/**
 * Convert a linked URL to an asset. Since nothing but the URL is known, the file name is the last
 * path segment, and the kind is derived from that name, or is `image` for an Image field.
 * @param {string} url URL.
 * @param {boolean} isImage Whether the URL comes from an Image field.
 * @returns {ExternalAsset} Asset.
 */
export const createLinkedAsset = (url, isImage) => {
  let fileName = url;

  try {
    fileName = decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).at(-1) ?? '');
  } catch {
    // Keep the URL as the name if it can’t be parsed
  }

  fileName ||= url;

  const kind = getAssetKind(fileName);

  return {
    id: url,
    description: url,
    previewURL: url,
    downloadURL: url,
    fileName,
    kind: kind === 'other' && isImage ? 'image' : kind,
  };
};

/**
 * Get the widget names of the fields the given key path resolves to in the collections the entry
 * belongs to. There can be more than one, as an entry can be shared by several collections and
 * collection files.
 * @param {Entry} entry Entry.
 * @param {FlattenedEntryContent} content Localized entry content.
 * @param {string} keyPath Field key path.
 * @returns {string[]} Widget names.
 */
const getFieldWidgets = (entry, content, keyPath) =>
  getAssociatedCollections(entry).flatMap((collection) => {
    const collectionName = collection.name;
    const isIndexFile = isCollectionIndexFile(collection, entry);
    const collectionFiles = getCollectionFilesByEntry(collection, entry);

    const fields = collectionFiles.length
      ? collectionFiles.map(({ name: fileName }) =>
          getField({ collectionName, fileName, valueMap: content, keyPath, isIndexFile }),
        )
      : [getField({ collectionName, valueMap: content, keyPath, isIndexFile })];

    return fields.map((field) => field?.widget ?? 'string');
  });

/**
 * Collect the files linked from the File/Image fields of the given entries. A URL used by more than
 * one entry or field is listed once.
 * @param {Entry[]} entries Entries to scan.
 * @returns {ExternalAsset[]} Linked files.
 */
export const collectLinkedAssets = (entries) => {
  /** @type {Map<string, ExternalAsset>} */
  const assets = new Map();

  entries.forEach((entry) => {
    Object.values(entry.locales).forEach(({ content }) => {
      Object.entries(content).forEach(([keyPath, value]) => {
        // Pre-filter: most values are not URLs, so skip them before the field lookup
        if (typeof value !== 'string' || !isLinkedURL(value)) {
          return;
        }

        const widgets = getFieldWidgets(entry, content, keyPath);

        if (widgets.some((widget) => MEDIA_FIELD_TYPES.includes(widget)) && !assets.has(value)) {
          assets.set(value, createLinkedAsset(value, widgets.includes('image')));
        }
      });
    });
  });

  return [...assets.values()];
};

/**
 * Files linked from the File/Image fields of all the entries, recomputed whenever the entries
 * change.
 * @type {{ readonly current: ExternalAsset[] }}
 */
export const linkedAssets = createDerivedState(() => collectLinkedAssets(allEntries.current));

/**
 * Virtual media library service for the files linked from entries, so that they can be browsed in
 * the Asset Library like the files on a cloud storage service. The files live elsewhere, so they
 * can only be listed, not uploaded, renamed, replaced or deleted.
 * @type {MediaLibraryService}
 */
export const linkedFilesService = {
  serviceType: 'cloud_storage',
  serviceId: LINKED_FILES_SERVICE_ID,
  /**
   * Localized label.
   * @returns {string} Label.
   */
  get serviceLabel() {
    return _('linked_files');
  },
  serviceURL: '',
  showServiceLink: false,
  hotlinking: true,
  authType: 'none',
  /**
   * List the linked files.
   * @returns {Promise<ExternalAsset[]>} Assets.
   */
  list: async () => linkedAssets.current,
};
