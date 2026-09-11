import { escapeRegExp } from '@sveltia/utils/string';
import { flatten } from 'flat';

import { suspendAutoDuplication } from '$lib/services/contents/draft';
import { getSubtree } from '$lib/services/contents/entry/subtree';
import { getOrCreate } from '$lib/services/utils/cache';

/**
 * @import { DraftValueStoreKey, EntryDraft, InternalLocaleCode } from '$lib/types/private';
 * @import { FieldKeyPath } from '$lib/types/public';
 */

/**
 * Update a flatten object with new properties by adding, updating and deleting properties.
 * @param {Record<string, any>} obj Original object.
 * @param {Record<string, any>} newProps New properties.
 */
export const updateObject = (obj, newProps) => {
  Object.entries(newProps).forEach(([key, value]) => {
    if (obj[key] !== value) {
      obj[key] = value;
    }
  });

  Object.keys(obj).forEach((key) => {
    if (!(key in newProps)) {
      delete obj[key];
    }
  });
};

/**
 * Cache of pre-compiled regexes keyed by field key path.
 * @type {Map<FieldKeyPath, RegExp>}
 */
const itemListRegexCache = new Map();

/**
 * Traverse the given object by decoding dot-notated key path.
 *
 * The object is a draft’s live content, not a snapshot of it, and the caller writes the manipulated
 * list straight back into it, so the key paths have to be read as they are right now.
 * @param {Record<string, any>} obj Original object.
 * @param {FieldKeyPath} keyPath Dot-notated field name.
 * @returns {[values: any, remainder: any]} Unflatten values and flatten remainder.
 */
export const getItemList = (obj, keyPath) => {
  const regex = getOrCreate(
    itemListRegexCache,
    keyPath,
    () => new RegExp(`^${escapeRegExp(keyPath)}\\b(?!#)`),
  );

  return [
    getSubtree(obj, keyPath, { live: true }) ?? [],
    Object.fromEntries(Object.entries(obj).filter(([k]) => !regex.test(k))),
  ];
};

/**
 * Update the value in a list field.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {InternalLocaleCode} args.locale Target locale.
 * @param {DraftValueStoreKey} [args.valueStoreKey] Key to store the values in {@link EntryDraft}.
 * @param {FieldKeyPath} args.keyPath Dot-notated field name.
 * @param {(arg: { valueList: any[], expanderStateList: boolean[] }) => void } args.manipulate A
 * function to manipulate the list, which takes one object argument containing the value list, file
 * list and view state list. The typical usage is `list.splice()`.
 */
export const updateListField = ({
  draft,
  locale,
  valueStoreKey = 'currentValues',
  keyPath,
  manipulate,
}) => {
  const { collection, collectionFile } = draft;
  const { defaultLocale } = (collectionFile ?? collection)._i18n;
  const [valueList, valueListRemainder] = getItemList(draft[valueStoreKey][locale], keyPath);

  const [expanderStateList, expanderStateListRemainder] =
    // Manipulation should only happen once with the default locale
    locale === defaultLocale ? getItemList(draft.expanderStates._, keyPath) : [[], []];

  manipulate({ valueList, expanderStateList });

  suspendAutoDuplication(() => {
    updateObject(draft[valueStoreKey][locale], {
      ...flatten({ [keyPath]: valueList }),
      ...valueListRemainder,
    });

    if (locale === defaultLocale) {
      updateObject(draft.expanderStates._, {
        ...flatten({ [keyPath]: expanderStateList }),
        ...expanderStateListRemainder,
      });
    }
  });
};

/**
 * Read a multi-value field out of the draft as a plain list. Our internal representation of such a
 * field is a flattened object with one numbered key per item, e.g. `images.0`, `images.1`. Just
 * like {@link getItemList}, this reads a draft’s live content, which the caller then mutates.
 * @param {Record<string, any>} values Flattened entry content.
 * @param {FieldKeyPath} keyPath Dot-notated field name.
 * @returns {any[]} Item values in list order.
 */
const getMultiValueList = (values, keyPath) => getSubtree(values, keyPath, { live: true }) ?? [];

/**
 * Move an item of a multi-value field, such as a File or Image field with the `multiple` option
 * enabled, to another position. The reordered list is written back over the existing numbered keys,
 * which all still exist because reordering doesn’t change the item count.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {InternalLocaleCode} args.locale Target locale.
 * @param {DraftValueStoreKey} [args.valueStoreKey] Key to store the values in {@link EntryDraft}.
 * @param {FieldKeyPath} args.keyPath Dot-notated field name.
 * @param {number} args.from Index of the item to move.
 * @param {number} args.to Index to move the item to.
 */
export const moveMultiValueItem = ({
  draft,
  locale,
  valueStoreKey = 'currentValues',
  keyPath,
  from,
  to,
}) => {
  const values = draft[valueStoreKey][locale];
  const list = getMultiValueList(values, keyPath);

  if (from === to || !(from in list) || !(to in list)) {
    return;
  }

  list.splice(to, 0, ...list.splice(from, 1));

  list.forEach((value, index) => {
    values[`${keyPath}.${index}`] = value;
  });
};

/**
 * Remove an item from a multi-value field, such as a File or Image field with the `multiple` option
 * enabled. Our internal representation of such a field is a flattened object, so the item is
 * removed by shifting the subsequent values down by one and dropping the now-unused last key.
 *
 * The draft is the single source of truth for the field editor, so nothing is returned; the editor
 * re-renders from the updated draft.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {InternalLocaleCode} args.locale Target locale.
 * @param {DraftValueStoreKey} [args.valueStoreKey] Key to store the values in {@link EntryDraft}.
 * @param {FieldKeyPath} args.keyPath Dot-notated field name.
 * @param {number} args.index Index of the item to remove.
 */
export const removeMultiValueItem = ({
  draft,
  locale,
  valueStoreKey = 'currentValues',
  keyPath,
  index,
}) => {
  const values = draft[valueStoreKey][locale];

  for (let i = index; ; i += 1) {
    const currentKey = `${keyPath}.${i}`;
    const nextKey = `${keyPath}.${i + 1}`;

    if (nextKey in values) {
      values[currentKey] = values[nextKey];
    } else {
      // Assign `null` before deleting the property, so the draft proxy can revalidate the field
      values[currentKey] = null;
      delete values[currentKey];
      break;
    }
  }
};
