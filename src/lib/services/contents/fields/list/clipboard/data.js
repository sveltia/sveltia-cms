import { isObject } from '@sveltia/utils/object';

import { getAssetByPath } from '$lib/services/assets';
import { getFieldMediaSources } from '$lib/services/assets/copy';
import { getItemList } from '$lib/services/contents/draft/update/list';
import { isInternalPropKey } from '$lib/services/contents/fields/internal-props';
import {
  getItemSubFields,
  isEntryRelativeReference,
  walkObject,
} from '$lib/services/contents/fields/list/clipboard/walk';
import { getListFieldInfo } from '$lib/services/contents/fields/list/helpers';
import { getTypedKeyPath } from '$lib/services/contents/fields/object/helpers';

/**
 * @import {
 * DraftValueStoreKey,
 * EntryDraft,
 * InternalLocaleCode,
 * TypedFieldKeyPath,
 * } from '$lib/types/private';
 * @import {
 * ComplexListField,
 * FieldKeyPath,
 * ListFieldWithSubField,
 * ListFieldWithTypes,
 * } from '$lib/types/public';
 * @import { AssetValueCallback } from '$lib/services/contents/fields/list/clipboard/walk';
 */

/**
 * Value of the `format` property that marks a list item copied to the clipboard.
 */
export const LIST_ITEM_CLIPBOARD_FORMAT = 'sveltia-cms/list-item';

/**
 * Version of the clipboard data format. Data in another version, e.g. copied with a newer release
 * of the CMS, can’t be read.
 */
const LIST_ITEM_CLIPBOARD_VERSION = 1;

/**
 * List item copied to the clipboard as JSON, so it can be pasted into any compatible list, in
 * another entry, collection, browser tab or even another site using Sveltia CMS.
 * @typedef {object} ListItemClipboardData
 * @property {typeof LIST_ITEM_CLIPBOARD_FORMAT} format Format marker.
 * @property {number} version Format version.
 * @property {string} id Random ID, which tells whether the clipboard still holds the item copied
 * in this tab, along with the files that can’t go to the clipboard.
 * @property {number} [copiedAt] Time the item was copied, which tells whether the clipboard holds
 * an item copied elsewhere after the one copied in this tab.
 * @property {InternalLocaleCode} locale Locale the item was copied in. Its values are pasted in a
 * locale the item doesn’t have.
 * @property {string} [type] Variable type name of the item, if the list has variable types.
 * @property {Record<InternalLocaleCode, Record<string, any>>} values The item in each locale it was
 * copied from: the item itself, without the variable type property, or, in a list with a single
 * subfield, an object holding the value under the subfield name.
 * @property {Record<InternalLocaleCode, Record<string, string>>} assets Repository paths of the
 * assets referenced with a path relative to the source entry, keyed by the reference, in each
 * locale, so the references can be rewritten for the entry the item is pasted into.
 */

/**
 * Remove the internal properties the CMS adds to list items, e.g. `__sc_item_id`, from a value and
 * the objects nested in it, in place.
 * @param {any} value Value.
 * @returns {any} Value.
 */
const removeInternalProps = (value) => {
  if (Array.isArray(value)) {
    value.forEach(removeInternalProps);
  } else if (isObject(value)) {
    Object.keys(value).forEach((key) => {
      if (isInternalPropKey(key)) {
        delete value[key];
      } else {
        removeInternalProps(value[key]);
      }
    });
  }

  return value;
};

/**
 * Create the clipboard data for a list item.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {DraftValueStoreKey} [args.valueStoreKey] Key of the values in the draft.
 * @param {ComplexListField} args.fieldConfig List field configuration.
 * @param {FieldKeyPath} args.keyPath Key path of the list.
 * @param {TypedFieldKeyPath} args.typedKeyPath Typed key path of the list.
 * @param {number} args.index List index of the item.
 * @param {InternalLocaleCode} args.locale Locale the item is copied in.
 * @param {boolean} [args.pairedItems] Whether the items are paired across the locales, in which
 * case the item is copied in every locale.
 * @param {string} [args.componentName] Name of the rich text editor component the list is in, if
 * any, for a field-level asset folder.
 * @returns {{ data: ListItemClipboardData, files: Map<string, File> }} Clipboard data, and the
 * unsaved files the item references, keyed by blob URL.
 */
export const createListItemClipboardData = ({
  draft,
  valueStoreKey = 'currentValues',
  fieldConfig,
  keyPath,
  typedKeyPath,
  index,
  locale,
  pairedItems = false,
  componentName,
}) => {
  const { originalEntry: entry, collectionName, fileName } = draft;
  const { hasSingleSubField } = getListFieldInfo(fieldConfig);
  const { field } = /** @type {ListFieldWithSubField} */ (fieldConfig);
  const { typeKey = 'type' } = /** @type {ListFieldWithTypes} */ (fieldConfig);
  const locales = pairedItems ? Object.keys(draft[valueStoreKey]) : [locale];

  /** @type {ListItemClipboardData} */
  const data = {
    format: LIST_ITEM_CLIPBOARD_FORMAT,
    version: LIST_ITEM_CLIPBOARD_VERSION,
    id: crypto.randomUUID(),
    copiedAt: Date.now(),
    locale,
    values: {},
    assets: {},
  };

  /** @type {Map<string, File>} */
  const files = new Map();

  locales.forEach((_locale) => {
    const [valueList] = getItemList(draft[valueStoreKey][_locale], keyPath);

    if (!(index in valueList)) {
      return;
    }

    const item = removeInternalProps(structuredClone(valueList[index]));
    /** @type {Record<string, any>} */
    const value = hasSingleSubField ? { [field.name]: item } : item;
    /** @type {Record<string, string>} */
    const assets = {};

    if (!hasSingleSubField && 'types' in fieldConfig) {
      data.type ??= value[typeKey];
      delete value[typeKey];
    }

    walkObject({
      obj: value,
      fields: getItemSubFields(fieldConfig, data.type) ?? [],
      typedKeyPath: getTypedKeyPath(`${typedKeyPath}.*`, data.type),
      /**
       * Record the assets an entry-relative reference in the field value points at, and the unsaved
       * files the value references.
       * @param {Parameters<AssetValueCallback>[0]} args Arguments.
       */
      callback: ({ value: fieldValue, format, typedKeyPath: fieldTypedKeyPath }) => {
        getFieldMediaSources(fieldValue, format).forEach((src) => {
          if (src.startsWith('blob:')) {
            const file = draft.files[src]?.file;

            if (file) {
              files.set(src, file);
            }

            return;
          }

          if (!isEntryRelativeReference(src) || src in assets) {
            return;
          }

          const asset = getAssetByPath({
            value: src,
            entry,
            collectionName,
            fileName,
            componentName,
            typedKeyPath: fieldTypedKeyPath,
            locale: _locale,
          });

          if (asset) {
            assets[src] = asset.path;
          }
        });
      },
    });

    data.values[_locale] = value;
    data.assets[_locale] = assets;
  });

  return { data, files };
};

/**
 * Parse the clipboard text as a copied list item.
 * @param {string} text Clipboard text.
 * @returns {ListItemClipboardData | undefined} Clipboard data, or `undefined` if the text isn’t a
 * copied list item.
 */
export const parseListItemClipboardData = (text) => {
  /** @type {any} */
  let data;

  try {
    // The text comes from anywhere, so leave out the internal properties of the CMS, as well as a
    // prototype that would be set once the values are written to an object
    data = JSON.parse(text, (key, value) =>
      key === '__proto__' || isInternalPropKey(key) ? undefined : value,
    );
  } catch {
    return undefined;
  }

  if (
    !isObject(data) ||
    data.format !== LIST_ITEM_CLIPBOARD_FORMAT ||
    data.version !== LIST_ITEM_CLIPBOARD_VERSION ||
    typeof data.locale !== 'string' ||
    (data.copiedAt !== undefined && typeof data.copiedAt !== 'number') ||
    (data.type !== undefined && typeof data.type !== 'string') ||
    !isObject(data.values) ||
    !isObject(data.values[data.locale]) ||
    !Object.values(data.values).every(isObject) ||
    (data.assets !== undefined &&
      !(isObject(data.assets) && Object.values(data.assets).every(isObject)))
  ) {
    return undefined;
  }

  return /** @type {ListItemClipboardData} */ ({ assets: {}, ...data });
};
