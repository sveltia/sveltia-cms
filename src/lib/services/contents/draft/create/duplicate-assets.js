import { getAssetByPath } from '$lib/services/assets';
import { getAssetFoldersByPath } from '$lib/services/assets/folders';
import { getAssetBlob } from '$lib/services/assets/info';
import { MARKDOWN_IMAGE_REGEX } from '$lib/services/contents/collection/entries';
import { getOwnedEntryFolderPath } from '$lib/services/contents/draft/save/assets';
import { getField, getTypedKeyPath } from '$lib/services/contents/entry/fields';
import { MEDIA_FIELD_TYPES } from '$lib/services/contents/fields';
import {
  getAssetLibraryFolderMap,
  getDefaultAssetFolder,
} from '$lib/services/contents/fields/file/helpers';

/**
 * @import {
 * AssetFolderInfo,
 * EntryDraft,
 * EntryFileMap,
 * FlattenedEntryContent,
 * LocaleContentMap,
 * TypedFieldKeyPath,
 * } from '$lib/types/private';
 * @import { FieldKeyPath } from '$lib/types/public';
 */

/**
 * Field types whose value can reference an asset.
 * @type {string[]}
 */
const ASSET_FIELD_TYPES = [...MEDIA_FIELD_TYPES, 'markdown', 'richtext'];

/**
 * Copy the original entry’s own assets into a duplicate of the entry. Assets stored at an
 * entry-relative path are referenced with a path relative to the entry, so a duplicate saved in a
 * folder of its own, like a Hugo page bundle, would point at files that don’t exist there. Each
 * such asset is turned into a pending upload cached in the draft, and the references to it in the
 * given values are replaced with the blob URL of the copy, the same as if the user had picked the
 * file for the field, so saving the duplicate writes the copy alongside it. Assets in a folder the
 * entry shares with the rest of the collection are left alone, because the duplicate is saved there
 * as well and the references keep resolving.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Draft of the original entry.
 * @param {LocaleContentMap} args.currentValues Detached copies of the draft values, to be used for
 * the duplicate. Updated in place.
 * @returns {Promise<EntryFileMap>} Copied files, keyed by blob URL, to be added to the duplicate.
 */
export const copyEntryRelativeAssets = async ({ draft, currentValues }) => {
  const { originalEntry: entry, collection, collectionName, fileName, isIndexFile } = draft;
  /** @type {EntryFileMap} */
  const files = {};

  if (!entry) {
    return files;
  }

  const { defaultLocale } = draft;
  const entryFilePath = (entry.locales[defaultLocale] ?? Object.values(entry.locales)[0])?.path;
  const ownsFolder = !!entryFilePath && !!getOwnedEntryFolderPath(collection, entryFilePath);
  /**
   * Copies in progress, keyed by asset path, so an asset referenced more than once, from another
   * locale or field, is copied once and shares the blob URL.
   * @type {Map<string, Promise<string | undefined>>}
   */
  const copies = new Map();

  /**
   * Copy the asset referenced by the given value, if it’s the entry’s own.
   * @param {object} args Arguments.
   * @param {string} args.value Field value or image source: an asset path relative to the entry.
   * @param {AssetFolderInfo} args.folder Folder the field saves a new file to.
   * @param {TypedFieldKeyPath} args.typedKeyPath Typed key path of the field.
   * @returns {Promise<string | undefined>} Blob URL of the copy, or `undefined` if there’s nothing
   * to copy.
   */
  const copyAsset = async ({ value, folder, typedKeyPath }) => {
    const asset = getAssetByPath({ value, entry, collectionName, fileName, typedKeyPath });

    if (!asset) {
      return undefined;
    }

    if (
      !getAssetFoldersByPath(asset.path).some(
        (f) => f.collectionName === collectionName && f.fileName === fileName && f.entryRelative,
      )
    ) {
      return undefined;
    }

    let copy = copies.get(asset.path);

    if (!copy) {
      copy = (async () => {
        /** @type {Blob} */
        let blob;

        try {
          blob = await getAssetBlob(asset);
        } catch {
          // The reference is left as is, pointing at the original’s file, rather than failing the
          // whole duplication
          return undefined;
        }

        const file = new File([blob], asset.name, { type: blob.type });
        const blobURL = URL.createObjectURL(file);

        files[blobURL] = { file, folder, replace: false };

        return blobURL;
      })();

      copies.set(asset.path, copy);
    }

    return copy;
  };

  /**
   * Copy the assets referenced by a field, and update its value.
   * @param {object} args Arguments.
   * @param {FlattenedEntryContent} args.valueMap Values of one locale.
   * @param {FieldKeyPath} args.keyPath Key path of the field.
   */
  const copyFieldAssets = async ({ valueMap, keyPath }) => {
    const value = valueMap[keyPath];

    if (typeof value !== 'string' || !value) {
      return;
    }

    const getFieldArgs = { collectionName, fileName, valueMap, keyPath, isIndexFile };
    const { widget: fieldType = 'string' } = getField(getFieldArgs) ?? {};

    if (!ASSET_FIELD_TYPES.includes(fieldType)) {
      return;
    }

    const typedKeyPath = getTypedKeyPath(getFieldArgs);

    // Where the field editor puts a newly picked file, so the copy ends up in the same place
    const folder = getDefaultAssetFolder(
      getAssetLibraryFolderMap({ collectionName, fileName, typedKeyPath, isIndexFile }),
    );

    // The asset location is the entry’s own only if the entry has a folder of its own, or the
    // folder is named after the entry with a template tag like `{{slug}}`. Otherwise the folder is
    // shared with the rest of the collection, and the duplicate can keep referencing the asset
    if (!folder.entryRelative || !(ownsFolder || folder.hasTemplateTags)) {
      return;
    }

    if (MEDIA_FIELD_TYPES.includes(fieldType)) {
      const blobURL = await copyAsset({ value, folder, typedKeyPath });

      if (blobURL) {
        valueMap[keyPath] = blobURL;
      }

      return;
    }

    // Images embedded in a Markdown body
    const sources = [...new Set([...value.matchAll(MARKDOWN_IMAGE_REGEX)].map(([, src]) => src))];

    await Promise.all(
      sources.map(async (src) => {
        const blobURL = await copyAsset({ value: src, folder, typedKeyPath });

        if (blobURL) {
          valueMap[keyPath] = /** @type {string} */ (valueMap[keyPath]).replaceAll(src, blobURL);
        }
      }),
    );
  };

  await Promise.all(
    Object.values(currentValues).flatMap((valueMap) =>
      Object.keys(valueMap).map((keyPath) => copyFieldAssets({ valueMap, keyPath })),
    ),
  );

  return files;
};
