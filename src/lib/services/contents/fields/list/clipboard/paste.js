import { getAssetByInternalPath } from '$lib/services/assets';
import {
  createPendingFileAdder,
  getAssetFile,
  rewriteAssetReferences,
} from '$lib/services/assets/copy';
import { getAssetPublicURL } from '$lib/services/assets/info';
import { getFieldAssetFolder } from '$lib/services/contents/fields/file/helpers';
import { getExistingBlobURL } from '$lib/services/contents/fields/file/process';
import { conformObject } from '$lib/services/contents/fields/list/clipboard/conform';
import { getItemSubFields, walkObject } from '$lib/services/contents/fields/list/clipboard/walk';
import { getListFieldInfo } from '$lib/services/contents/fields/list/helpers';
import { getTypedKeyPath } from '$lib/services/contents/fields/object/helpers';

/**
 * @import {
 * AssetFolderInfo,
 * DraftValueStoreKey,
 * EntryDraft,
 * InternalLocaleCode,
 * TypedFieldKeyPath,
 * } from '$lib/types/private';
 * @import { ComplexListField, ListFieldWithSubField } from '$lib/types/public';
 * @import { AssetValueCallback } from '$lib/services/contents/fields/list/clipboard/walk';
 * @import { ListItemClipboardData } from '$lib/services/contents/fields/list/clipboard/data';
 */

/**
 * Result of preparing a copied list item to be pasted.
 * @typedef {object} ListItemPasteResult
 * @property {string} [type] Variable type name of the item, if the list has variable types.
 * @property {Record<InternalLocaleCode, any>} items Item to be added in each locale of the draft.
 * @property {number} droppedCount Number of the values left out, as the list doesn’t have the
 * fields or they don’t take the values.
 * @property {number} missingFileCount Number of the files the item references that couldn’t be
 * found, so the references couldn’t be rewritten for the entry.
 */

/**
 * Prepare a copied list item to be pasted into a list: conform the item to the subfields, and
 * rewrite the references to the source entry’s assets, so they keep pointing at the same files. An
 * asset that can’t be referenced from the entry, e.g. one stored beside another entry, is copied
 * and cached in the draft as a pending upload, the same as if the user had picked the file for the
 * field, so saving the entry writes the copy alongside it.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {DraftValueStoreKey} [args.valueStoreKey] Key of the values in the draft.
 * @param {{ data: ListItemClipboardData, files: Map<string, File> }} args.copied Copied item.
 * @param {ComplexListField} args.fieldConfig List field configuration.
 * @param {TypedFieldKeyPath} args.typedKeyPath Typed key path of the list.
 * @param {string} [args.componentName] Name of the rich text editor component the list is in, if
 * any, for a field-level asset folder.
 * @param {boolean} [args.inEditorComponent] Whether the list is in a rich text editor component,
 * whose values live in the document of the locale they’re edited in, so the subfields get their
 * defaults as in the default locale, like a new item.
 * @returns {Promise<ListItemPasteResult | undefined>} Result, or `undefined` if the item doesn’t
 * fit the list.
 */
export const prepareListItemPaste = async ({
  draft,
  valueStoreKey = 'currentValues',
  copied: { data, files },
  fieldConfig,
  typedKeyPath,
  componentName,
  inEditorComponent = false,
}) => {
  const { originalEntry: entry, collectionName, fileName, isIndexFile } = draft;
  const { hasSingleSubField, hasVariableTypes } = getListFieldInfo(fieldConfig);
  const { field } = /** @type {ListFieldWithSubField} */ (fieldConfig);
  const type = hasVariableTypes ? data.type : undefined;
  const fields = getItemSubFields(fieldConfig, type);

  if (!fields) {
    return undefined;
  }

  const stats = { dropped: 0 };
  /**
   * References that couldn’t be rewritten, as the files can’t be found or copied. A file referenced
   * in every locale is only counted once.
   * @type {Set<string>}
   */
  const missingFiles = new Set();
  /** @type {Record<InternalLocaleCode, any>} */
  const items = {};
  /** @type {Promise<void>[]} */
  const tasks = [];

  // Copies are keyed by asset path or blob URL, so an asset referenced more than once, from another
  // locale or field, is copied once and shares the blob URL. The file may already be pending for
  // the folder, e.g. if the item was pasted before
  const addPendingFileOrThrow = createPendingFileAdder({
    files: draft.files,
    /**
     * Find the file among the pending files of the draft.
     * @param {File} file File.
     * @param {AssetFolderInfo} folder Folder the file is saved to.
     * @returns {Promise<string | undefined>} Blob URL.
     */
    findExisting: (file, folder) => getExistingBlobURL({ draft, file, folder }),
  });

  /**
   * Cache a file in the draft as a pending upload.
   * @param {string} key Asset path or blob URL the file comes from.
   * @param {() => Promise<File>} getFile Function to get the file.
   * @param {AssetFolderInfo} folder Folder the file is saved to.
   * @returns {Promise<string | undefined>} Blob URL of the pending file, or `undefined` if the file
   * can’t be retrieved.
   */
  const addPendingFile = (key, getFile, folder) =>
    addPendingFileOrThrow(key, getFile, folder).catch(() => undefined);

  /**
   * Get the reference to use in place of a copied one.
   * @param {object} args Arguments.
   * @param {string} args.src Copied reference.
   * @param {Record<string, string>} args.assetPaths Repository paths of the copied entry-relative
   * assets, keyed by reference.
   * @param {TypedFieldKeyPath} args.fieldTypedKeyPath Typed key path of the field.
   * @param {InternalLocaleCode} args.locale Locale the reference is pasted in.
   * @returns {Promise<string | undefined>} New reference, or `undefined` if the reference doesn’t
   * have to be rewritten or it couldn’t be.
   */
  const rewriteReference = async ({ src, assetPaths, fieldTypedKeyPath, locale }) => {
    const isBlobURL = src.startsWith('blob:');
    const assetPath = assetPaths[src];

    // A pending file of the draft, or a reference that’s the same anywhere, e.g. an absolute path
    if ((isBlobURL && src in draft.files) || (!isBlobURL && !assetPath)) {
      return undefined;
    }

    /**
     * Get the folder the field editor puts a newly picked file in, so a copy ends up in the same
     * place. It’s only looked up when a file has to be copied.
     * @returns {AssetFolderInfo | undefined} Folder.
     */
    const getFolder = () =>
      getFieldAssetFolder({
        collectionName,
        fileName,
        componentName,
        typedKeyPath: fieldTypedKeyPath,
        isIndexFile,
      });

    if (isBlobURL) {
      const file = files.get(src);
      const folder = file ? getFolder() : undefined;

      const blobURL =
        file && folder ? await addPendingFile(src, async () => file, folder) : undefined;

      if (!blobURL) {
        missingFiles.add(src);
      }

      return blobURL;
    }

    const asset = getAssetByInternalPath(assetPath);

    if (!asset) {
      missingFiles.add(assetPath);

      return undefined;
    }

    const publicPath = getAssetPublicURL(asset, {
      pathOnly: true,
      allowSpecial: true,
      entry,
      locale,
    });

    if (publicPath !== undefined) {
      return publicPath === src ? undefined : publicPath;
    }

    const folder = getFolder();

    const blobURL = folder
      ? await addPendingFile(assetPath, () => getAssetFile(asset), folder)
      : undefined;

    if (!blobURL) {
      missingFiles.add(assetPath);
    }

    return blobURL;
  };

  /**
   * The item conformed to the subfields in each locale of the draft. The item’s own values are
   * pasted in a locale it doesn’t have.
   * @type {{ locale: InternalLocaleCode, value: Record<string, any>, assetPaths: Record<string,
   * string> }[]}
   */
  const conformed = [];

  const fits = Object.keys(draft[valueStoreKey]).every((locale, index) => {
    const sourceLocale = locale in data.values ? locale : data.locale;
    /** @type {Record<string, any>} */
    let obj = structuredClone(data.values[sourceLocale]);

    // The values left out are counted once, as the locales have the same fields
    const options = {
      locale,
      defaultLocale: inEditorComponent ? locale : draft.defaultLocale,
      stats: index ? { dropped: 0 } : stats,
    };

    // A single value is taken from an item with another subfield name
    if (hasSingleSubField && !(field.name in obj) && Object.keys(obj).length === 1) {
      obj = { [field.name]: Object.values(obj)[0] };
    }

    const { value, matched } = conformObject(obj, fields, options);

    // Nothing in the item fits the list. An item without values, e.g. of a variable type without
    // subfields, fits any list having the type
    if (Object.keys(obj).length && !matched) {
      return false;
    }

    conformed.push({ locale, value, assetPaths: data.assets[sourceLocale] ?? {} });

    return true;
  });

  if (!fits) {
    return undefined;
  }

  conformed.forEach(({ locale, value, assetPaths }) => {
    walkObject({
      obj: value,
      fields,
      typedKeyPath: getTypedKeyPath(`${typedKeyPath}.*`, type),
      /**
       * Rewrite the asset references in the field value for the entry.
       * @param {Parameters<AssetValueCallback>[0]} args Arguments.
       */
      callback: ({ value: fieldValue, format, typedKeyPath: fieldTypedKeyPath, set }) => {
        tasks.push(
          (async () => {
            const newValue = await rewriteAssetReferences({
              value: fieldValue,
              format,
              /**
               * Get the new reference for the entry.
               * @param {string} src Copied reference.
               * @returns {Promise<string | undefined>} New reference.
               */
              rewrite: (src) => rewriteReference({ src, assetPaths, fieldTypedKeyPath, locale }),
            });

            if (newValue !== undefined) {
              set(newValue);
            } else if (!format && fieldValue.startsWith('blob:') && !(fieldValue in draft.files)) {
              // A pending file that can’t be found any more, e.g. copied in another tab, would be
              // a broken reference once the entry is saved
              set('');
            }
          })(),
        );
      },
    });

    items[locale] = hasSingleSubField ? value[field.name] : value;
  });

  await Promise.all(tasks);

  return { type, items, droppedCount: stats.dropped, missingFileCount: missingFiles.size };
};
