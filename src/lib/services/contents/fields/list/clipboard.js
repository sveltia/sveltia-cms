import { isObject } from '@sveltia/utils/object';

import { getAssetByInternalPath, getAssetByPath, isRelativePath } from '$lib/services/assets';
import { createDisplayBlobURL, getAssetBlob, getAssetPublicURL } from '$lib/services/assets/info';
import {
  getRichTextMediaSources,
  replaceRichTextMediaSources,
} from '$lib/services/assets/references';
import { getDefaultValues } from '$lib/services/contents/draft/defaults';
import { getItemList } from '$lib/services/contents/draft/update/list';
import { isFieldMultiple } from '$lib/services/contents/entry/fields';
import {
  MEDIA_FIELD_TYPES,
  MULTI_VALUE_FIELD_TYPES,
  RICH_TEXT_FIELD_TYPES,
} from '$lib/services/contents/fields';
import {
  getAssetLibraryFolderMap,
  getDefaultAssetFolder,
} from '$lib/services/contents/fields/file/helpers';
import { getExistingBlobURL } from '$lib/services/contents/fields/file/process';
import { getListFieldInfo } from '$lib/services/contents/fields/list/helpers';
import { getValueSubFields } from '$lib/services/contents/fields/list/items';
import { getValueFormat } from '$lib/services/contents/fields/rich-text';
import { unflattenKeys } from '$lib/services/utils/object';

/**
 * @import {
 * AssetFolderInfo,
 * DraftValueStoreKey,
 * EntryDraft,
 * InternalLocaleCode,
 * TypedFieldKeyPath,
 * } from '$lib/types/private';
 * @import {
 * ComplexListField,
 * Field,
 * FieldKeyPath,
 * ListFieldWithSubField,
 * ListFieldWithSubFields,
 * ListFieldWithTypes,
 * MarkdownField,
 * ObjectField,
 * RichTextField,
 * RichTextValueFormat,
 * } from '$lib/types/public';
 */

/**
 * Value of the `format` property that marks a list item copied to the clipboard.
 */
export const LIST_ITEM_CLIPBOARD_FORMAT = 'sveltia-cms/list-item';

/**
 * Version of the clipboard data format. Data in another version, e.g. copied with a newer release
 * of the CMS, can’t be read.
 */
export const LIST_ITEM_CLIPBOARD_VERSION = 1;

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
 * Item copied in this tab, along with the unsaved files it references, keyed by blob URL. Those are
 * pending uploads of the source draft, which can’t be put to the clipboard.
 * @type {{ data: ListItemClipboardData, files: Map<string, File> } | undefined}
 */
let lastCopied;

/**
 * Callback for each value that can reference an asset. `format` is the format of a Markdown or
 * RichText field value, and `undefined` for a File or Image field value.
 * @typedef {(args: {
 * value: string,
 * format?: RichTextValueFormat,
 * typedKeyPath: TypedFieldKeyPath,
 * set: (newValue: string) => void,
 * }) => void} AssetValueCallback
 */

/**
 * Get the subfields of a List or Object field value, and the typed key path the subfields are
 * under, resolving the variable type against the type name stored in the value.
 * @param {ComplexListField | ObjectField} fieldConfig Field configuration.
 * @param {Record<string, any>} value Object value or list item.
 * @param {TypedFieldKeyPath} typedKeyPath Typed key path of the value, e.g. `blocks.*`.
 * @returns {{ fields: Field[], typedKeyPath: TypedFieldKeyPath }} Subfields and typed key path.
 */
const resolveValueFields = (fieldConfig, value, typedKeyPath) => {
  const { fields } = /** @type {ListFieldWithSubFields} */ (fieldConfig);
  const { types, typeKey = 'type' } = /** @type {ListFieldWithTypes} */ (fieldConfig);
  const type = types ? value[typeKey] : undefined;

  return {
    fields: getValueSubFields({ value, fields, types, typeKey }),
    typedKeyPath: type ? `${typedKeyPath}<${type}>` : typedKeyPath,
  };
};

/**
 * Find the values that can reference an asset in a field value: the value of a File or Image
 * field, and the body of a Markdown or RichText field. Object and List fields are walked down.
 * @param {object} args Arguments.
 * @param {Record<string, any> | any[]} args.container Object or array holding the value.
 * @param {string | number} args.key Property name or index of the value.
 * @param {Field} args.fieldConfig Field configuration.
 * @param {TypedFieldKeyPath} args.typedKeyPath Typed key path of the field.
 * @param {AssetValueCallback} args.callback Function called for each value.
 */
const walkFieldValue = ({ container, key, fieldConfig, typedKeyPath, callback }) => {
  const value = /** @type {any} */ (container)[key];
  const { widget: fieldType = 'string' } = fieldConfig;
  const isRichText = RICH_TEXT_FIELD_TYPES.includes(fieldType);

  if (isRichText || MEDIA_FIELD_TYPES.includes(fieldType)) {
    /** @type {[Record<string, any> | any[], string | number][]} */
    const targets =
      Array.isArray(value) && !isRichText
        ? value.map((_value, index) => [value, index])
        : [[container, key]];

    targets.forEach(([_container, _key]) => {
      const _value = /** @type {any} */ (_container)[_key];

      if (typeof _value === 'string' && _value) {
        callback({
          value: _value,
          format: isRichText
            ? getValueFormat(/** @type {MarkdownField | RichTextField} */ (fieldConfig))
            : undefined,
          typedKeyPath,
          /**
           * Replace the value.
           * @param {string} newValue New value.
           */
          set: (newValue) => {
            /** @type {any} */ (_container)[_key] = newValue;
          },
        });
      }
    });

    return;
  }

  if (fieldType === 'object' && isObject(value)) {
    // eslint-disable-next-line no-use-before-define
    walkObject({
      obj: value,
      ...resolveValueFields(/** @type {ObjectField} */ (fieldConfig), value, typedKeyPath),
      callback,
    });

    return;
  }

  if (fieldType === 'list' && Array.isArray(value)) {
    const { field } = /** @type {ListFieldWithSubField} */ (fieldConfig);

    value.forEach((item, index) => {
      if (field) {
        walkFieldValue({
          container: value,
          key: index,
          fieldConfig: field,
          typedKeyPath: `${typedKeyPath}.*.${field.name}`,
          callback,
        });
      } else if (isObject(item)) {
        // eslint-disable-next-line no-use-before-define
        walkObject({
          obj: item,
          ...resolveValueFields(
            /** @type {ComplexListField} */ (fieldConfig),
            item,
            `${typedKeyPath}.*`,
          ),
          callback,
        });
      }
    });
  }
};

/**
 * Find the values that can reference an asset in an object. See {@link walkFieldValue}.
 * @param {object} args Arguments.
 * @param {Record<string, any>} args.obj Object.
 * @param {Field[]} args.fields Subfields of the object.
 * @param {TypedFieldKeyPath} args.typedKeyPath Typed key path of the object.
 * @param {AssetValueCallback} args.callback Function called for each value.
 */
const walkObject = ({ obj, fields, typedKeyPath, callback }) => {
  fields.forEach((fieldConfig) => {
    const { name } = fieldConfig;

    if (name in obj) {
      walkFieldValue({
        container: obj,
        key: name,
        fieldConfig,
        typedKeyPath: `${typedKeyPath}.${name}`,
        callback,
      });
    }
  });
};

/**
 * Get the asset references in a field value: the value itself for a File or Image field, or the
 * media URLs in a Markdown or HTML body.
 * @param {string} value Field value.
 * @param {RichTextValueFormat} [format] Format of a Markdown or RichText field value.
 * @returns {string[]} References.
 */
const getAssetReferences = (value, format) =>
  format ? getRichTextMediaSources(value, format) : [value];

/**
 * Check if the given asset reference is a path relative to the entry, which has to be rewritten
 * when the item is pasted into another entry. An absolute path, a URL or a blob URL isn’t.
 * @param {string} src Reference.
 * @returns {boolean} Result.
 */
const isEntryRelativeReference = (src) => isRelativePath(src) && !/^[a-z][a-z\d+.-]*:/i.test(src);

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
      if (key.startsWith('__sc_')) {
        delete value[key];
      } else {
        removeInternalProps(value[key]);
      }
    });
  }

  return value;
};

/**
 * Get the subfields of a list item as an object: those of its variable type, or the single subfield
 * of a list whose items are the subfield values themselves.
 * @param {ComplexListField} fieldConfig Field configuration.
 * @param {string} [type] Variable type name of the item, if the list has variable types.
 * @returns {Field[] | undefined} Subfields, or `undefined` if the list has variable types but no
 * such type.
 */
const getItemSubFields = (fieldConfig, type) => {
  const { field } = /** @type {ListFieldWithSubField} */ (fieldConfig);
  const { fields } = /** @type {ListFieldWithSubFields} */ (fieldConfig);
  const { types } = /** @type {ListFieldWithTypes} */ (fieldConfig);

  if (types) {
    const typeConfig = types.find(({ name }) => name === type);

    return typeConfig ? (typeConfig.fields ?? []) : undefined;
  }

  return fields ?? [field];
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
      typedKeyPath: data.type ? `${typedKeyPath}.*<${data.type}>` : `${typedKeyPath}.*`,
      /**
       * Record the assets an entry-relative reference in the field value points at, and the unsaved
       * files the value references.
       * @param {Parameters<AssetValueCallback>[0]} args Arguments.
       */
      callback: ({ value: fieldValue, format, typedKeyPath: fieldTypedKeyPath }) => {
        getAssetReferences(fieldValue, format).forEach((src) => {
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
      key === '__proto__' || key.startsWith('__sc_') ? undefined : value,
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

/**
 * Copy a list item to the clipboard. The item is also kept in this tab, so it can be pasted even if
 * the clipboard can’t be read, along with the unsaved files it references.
 * @param {Parameters<typeof createListItemClipboardData>[0]} args Arguments.
 * @returns {Promise<boolean>} Whether the item was written to the clipboard as well.
 */
export const copyListItem = async (args) => {
  lastCopied = createListItemClipboardData(args);

  try {
    await navigator.clipboard.writeText(JSON.stringify(lastCopied.data));

    return true;
  } catch {
    return false;
  }
};

/**
 * Get the list item to be pasted: the one in the clipboard, or the one last copied in this tab if
 * the clipboard can’t be read or holds something else.
 * @returns {Promise<{ data: ListItemClipboardData, files: Map<string, File> } | undefined>} Item
 * and the unsaved files it references, or `undefined` if there’s nothing to paste.
 */
export const readListItem = async () => {
  /** @type {ListItemClipboardData | undefined} */
  let data;

  try {
    data = parseListItemClipboardData(await navigator.clipboard.readText());
  } catch {
    // Clipboard access denied
  }

  // An item copied elsewhere is pasted unless it’s older than the one copied here, which the
  // clipboard doesn’t hold if it couldn’t be written
  if (
    data &&
    data.id !== lastCopied?.data.id &&
    !(lastCopied && (data.copiedAt ?? 0) < /** @type {number} */ (lastCopied.data.copiedAt))
  ) {
    return { data, files: new Map() };
  }

  return lastCopied;
};

/**
 * Reset the item last copied in this tab. For testing purposes.
 */
export const resetCopiedListItem = () => {
  lastCopied = undefined;
};

/**
 * Check if a pasted value fits a field that doesn’t have subfields.
 * @param {any} value Value.
 * @param {string} fieldType Field type.
 * @returns {boolean} Result.
 */
const isPrimitiveValueCompatible = (value, fieldType) => {
  if (value === null) {
    return true;
  }

  switch (fieldType) {
    case 'boolean':
      return typeof value === 'boolean';
    case 'number':
    case 'string':
    case 'text':
    case 'markdown':
    case 'richtext':
    case 'color':
    case 'datetime':
    case 'uuid':
    case 'map':
    case 'compute':
    case 'file':
    case 'image':
    case 'relation':
    case 'select':
      return typeof value === 'string' || typeof value === 'number';
    case 'code':
      return typeof value === 'string' || isObject(value);
    case 'keyvalue':
      return isObject(value);
    default:
      // Hidden field and custom field types, which can take anything
      return true;
  }
};

/**
 * Options for conforming a pasted value to the fields it’s pasted into.
 * @typedef {object} ConformOptions
 * @property {InternalLocaleCode} locale Locale the value is pasted in, for default values.
 * @property {InternalLocaleCode} defaultLocale Default locale of the draft.
 * @property {{ dropped: number }} stats Number of the values left out because the fields they’re
 * pasted into don’t have them, or don’t take them.
 */

/**
 * Conform a pasted value to the field it’s pasted into. See {@link conformObject}.
 * @param {any} value Pasted value.
 * @param {Field} fieldConfig Field configuration.
 * @param {ConformOptions} options Options.
 * @returns {any} Conformed value, or `undefined` if the field doesn’t take the value.
 */
const conformValue = (value, fieldConfig, options) => {
  const { widget: fieldType = 'string' } = fieldConfig;

  if (fieldType === 'object') {
    return isObject(value)
      ? // eslint-disable-next-line no-use-before-define
        conformObjectField(value, /** @type {ObjectField} */ (fieldConfig), options)
      : undefined;
  }

  if (fieldType === 'list') {
    // eslint-disable-next-line no-use-before-define
    return Array.isArray(value) ? conformList(value, fieldConfig, options) : undefined;
  }

  if (isFieldMultiple(fieldConfig) && value !== null) {
    const values = Array.isArray(value) ? value : [value];

    return values.every((v) => isPrimitiveValueCompatible(v, fieldType)) ? values : undefined;
  }

  // A single value can be taken from a multiple-value field holding one value
  const _value =
    MULTI_VALUE_FIELD_TYPES.includes(fieldType) && Array.isArray(value) && value.length === 1
      ? value[0]
      : value;

  return isPrimitiveValueCompatible(_value, fieldType) ? _value : undefined;
};

/**
 * Conform a pasted object to the subfields it’s pasted into: a property the subfields don’t have,
 * or don’t take the value of, is left out, while a subfield the object doesn’t have gets its
 * default value.
 * @param {Record<string, any>} obj Pasted object.
 * @param {Field[]} fields Subfields.
 * @param {ConformOptions} options Options.
 * @returns {{ value: Record<string, any>, matched: number }} Conformed object and the number of
 * the properties taken.
 */
const conformObject = (obj, fields, options) => {
  const { locale, defaultLocale, stats } = options;
  /** @type {Record<string, any>} */
  const value = {};
  let matched = 0;

  fields.forEach((fieldConfig) => {
    const { name } = fieldConfig;

    if (name in obj) {
      const conformed = conformValue(obj[name], fieldConfig, options);

      if (conformed !== undefined) {
        value[name] = conformed;
        matched += 1;

        return;
      }
    }

    const defaults = unflattenKeys(
      getDefaultValues({ fields: [fieldConfig], locale, defaultLocale }),
    );

    if (name in defaults) {
      value[name] = defaults[name];
    }
  });

  stats.dropped += Object.keys(obj).length - matched;

  return { value, matched };
};

/**
 * Conform a pasted Object field value. See {@link conformObject}.
 * @param {Record<string, any>} obj Pasted object.
 * @param {ObjectField} fieldConfig Field configuration.
 * @param {ConformOptions} options Options.
 * @returns {Record<string, any> | undefined} Conformed object, or `undefined` if the field has
 * variable types but not the one of the object.
 */
const conformObjectField = (obj, fieldConfig, options) => {
  const { fields, types, typeKey = 'type' } = /** @type {any} */ (fieldConfig);

  if (!types) {
    return conformObject(obj, fields ?? [], options).value;
  }

  const { [typeKey]: type, ...rest } = obj;

  const typeConfig = /** @type {{ name: string, fields?: Field[] }[]} */ (types).find(
    ({ name }) => name === type,
  );

  if (!typeConfig) {
    return undefined;
  }

  return { ...conformObject(rest, typeConfig.fields ?? [], options).value, [typeKey]: type };
};

/**
 * Conform a pasted List field value: an item that doesn’t fit is left out.
 * @param {any[]} list Pasted list.
 * @param {Field} fieldConfig Field configuration.
 * @param {ConformOptions} options Options.
 * @returns {any[]} Conformed list.
 */
const conformList = (list, fieldConfig, options) => {
  const { field, fields, types } = /** @type {any} */ (fieldConfig);

  if (field) {
    return list.flatMap((item) => {
      const conformed = conformValue(item, field, options);

      if (conformed === undefined) {
        options.stats.dropped += 1;

        return [];
      }

      return [conformed];
    });
  }

  if (fields || types) {
    return list.flatMap((item) => {
      const conformed = isObject(item)
        ? conformObjectField(item, /** @type {ObjectField} */ (fieldConfig), options)
        : undefined;

      if (conformed === undefined) {
        options.stats.dropped += 1;

        return [];
      }

      return [conformed];
    });
  }

  // A simple list of strings
  return list.filter((item) => {
    const compatible = typeof item === 'string' || typeof item === 'number';

    if (!compatible) {
      options.stats.dropped += 1;
    }

    return compatible;
  });
};

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
  /**
   * Asset copies in progress, keyed by asset path or blob URL, so an asset referenced more than
   * once, from another locale or field, is copied once and shares the blob URL.
   * @type {Map<string, Promise<string | undefined>>}
   */
  const copies = new Map();

  /**
   * Cache a file in the draft as a pending upload.
   * @param {string} key Asset path or blob URL the file comes from.
   * @param {() => Promise<File>} getFile Function to get the file.
   * @param {AssetFolderInfo} folder Folder the file is saved to.
   * @returns {Promise<string | undefined>} Blob URL of the pending file, or `undefined` if the file
   * can’t be retrieved.
   */
  const addPendingFile = (key, getFile, folder) => {
    let copy = copies.get(key);

    if (!copy) {
      copy = (async () => {
        try {
          const file = await getFile();
          // The file may already be pending for the folder, e.g. if the item was pasted before
          const existingBlobURL = await getExistingBlobURL({ draft, file, folder });

          if (existingBlobURL) {
            return existingBlobURL;
          }

          // The URL must not let an SVG image run script
          const blobURL = await createDisplayBlobURL(file);

          draft.files[blobURL] = { file, folder, replace: false };

          return blobURL;
        } catch {
          return undefined;
        }
      })();

      copies.set(key, copy);
    }

    return copy;
  };

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
      getDefaultAssetFolder(
        getAssetLibraryFolderMap({
          collectionName,
          fileName,
          componentName,
          typedKeyPath: fieldTypedKeyPath,
          isIndexFile,
        }),
      );

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
      ? await addPendingFile(
          assetPath,
          async () => {
            const blob = await getAssetBlob(asset);

            return new File([blob], asset.name, { type: blob.type });
          },
          folder,
        )
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
      typedKeyPath: type ? `${typedKeyPath}.*<${type}>` : `${typedKeyPath}.*`,
      /**
       * Rewrite the asset references in the field value for the entry.
       * @param {Parameters<AssetValueCallback>[0]} args Arguments.
       */
      callback: ({ value: fieldValue, format, typedKeyPath: fieldTypedKeyPath, set }) => {
        const sources = getAssetReferences(fieldValue, format);

        tasks.push(
          (async () => {
            const newSources = new Map(
              await Promise.all(
                sources.map(
                  async (src) =>
                    /** @type {[string, string | undefined]} */ ([
                      src,
                      await rewriteReference({ src, assetPaths, fieldTypedKeyPath, locale }),
                    ]),
                ),
              ),
            );

            if (!format) {
              const newSource = newSources.get(fieldValue);

              if (newSource !== undefined) {
                set(newSource);
              } else if (fieldValue.startsWith('blob:') && !(fieldValue in draft.files)) {
                // A pending file that can’t be found any more, e.g. copied in another tab, would be
                // a broken reference once the entry is saved
                set('');
              }

              return;
            }

            set(replaceRichTextMediaSources(fieldValue, newSources, format));
          })(),
        );
      },
    });

    items[locale] = hasSingleSubField ? value[field.name] : value;
  });

  await Promise.all(tasks);

  return { type, items, droppedCount: stats.dropped, missingFileCount: missingFiles.size };
};
