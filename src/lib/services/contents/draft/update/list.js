import { escapeRegExp } from '@sveltia/utils/string';
import { flatten, unflatten } from 'flat';
import { get } from 'svelte/store';

import { entryDraft, i18nAutoDupEnabled } from '$lib/services/contents/draft';
import { getOrCreate } from '$lib/services/utils/cache';

/**
 * @import { Writable } from 'svelte/store';
 * @import { DraftValueStoreKey, EntryDraft, InternalLocaleCode } from '$lib/types/private';
 * @import { FieldKeyPath } from '$lib/types/public';
 */

/**
 * Update a flatten object with new properties by adding, updating and deleting properties.
 * @internal
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
 * @internal
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

  const filtered = Object.entries(obj)
    .filter(([k]) => regex.test(k))
    .map(([k, v]) => [k.replace(regex, '_'), v])
    .sort();

  return [
    unflatten(Object.fromEntries(filtered))._ ?? [],
    Object.fromEntries(Object.entries(obj).filter(([k]) => !regex.test(k))),
  ];
};

/**
 * Update the value in a list field.
 * @param {object} args Arguments.
 * @param {InternalLocaleCode} args.locale Target locale.
 * @param {DraftValueStoreKey} [args.valueStoreKey] Key to store the values in {@link EntryDraft}.
 * @param {FieldKeyPath} args.keyPath Dot-notated field name.
 * @param {(arg: { valueList: any[], expanderStateList: boolean[] }) => void } args.manipulate A
 * function to manipulate the list, which takes one object argument containing the value list, file
 * list and view state list. The typical usage is `list.splice()`.
 */
export const updateListField = ({
  locale,
  valueStoreKey = 'currentValues',
  keyPath,
  manipulate,
}) => {
  const draft = /** @type {EntryDraft} */ (get(entryDraft));
  const { collection, collectionFile } = draft;
  const { defaultLocale } = (collectionFile ?? collection)._i18n;
  const [valueList, valueListRemainder] = getItemList(draft[valueStoreKey][locale], keyPath);

  const [expanderStateList, expanderStateListRemainder] =
    // Manipulation should only happen once with the default locale
    locale === defaultLocale ? getItemList(draft.expanderStates._, keyPath) : [[], []];

  manipulate({ valueList, expanderStateList });

  i18nAutoDupEnabled.set(false);

  /** @type {Writable<EntryDraft>} */ (entryDraft).update((_draft) => {
    updateObject(_draft[valueStoreKey][locale], {
      ...flatten({ [keyPath]: valueList }),
      ...valueListRemainder,
    });

    if (locale === defaultLocale) {
      updateObject(_draft.expanderStates._, {
        ...flatten({ [keyPath]: expanderStateList }),
        ...expanderStateListRemainder,
      });
    }

    return _draft;
  });

  i18nAutoDupEnabled.set(true);
};

/**
 * Remove an item from a multi-value field, such as a File or Image field with the `multiple` option
 * enabled. Our internal representation of such a field is a flattened object, so the item is
 * removed by shifting the subsequent values down by one and dropping the now-unused last key.
 *
 * The whole manipulation is done within a single {@link entryDraft} update. Deleting a property
 * doesn’t notify the store on its own — only an assignment does — so shifting the values with
 * separate assignments would leave subscribers, including the shared value map snapshot, holding a
 * map that still contains the removed key. The next removal would then read that key back and write
 * its stale value into the list.
 * @param {object} args Arguments.
 * @param {InternalLocaleCode} args.locale Target locale.
 * @param {DraftValueStoreKey} [args.valueStoreKey] Key to store the values in {@link EntryDraft}.
 * @param {FieldKeyPath} args.keyPath Dot-notated field name.
 * @param {number} args.index Index of the item to remove.
 * @returns {any[]} Updated value list.
 */
export const removeMultiValueItem = ({
  locale,
  valueStoreKey = 'currentValues',
  keyPath,
  index,
}) => {
  /** @type {any[]} */
  const updatedValue = [];

  /** @type {Writable<EntryDraft>} */ (entryDraft).update((draft) => {
    const values = draft[valueStoreKey][locale];

    for (let i = 0; ; i += 1) {
      const currentKey = `${keyPath}.${i}`;
      const nextKey = `${keyPath}.${i + 1}`;

      if (i < index) {
        updatedValue.push(values[currentKey]);
      } else if (nextKey in values) {
        values[currentKey] = values[nextKey];
        updatedValue.push(values[currentKey]);
      } else {
        // Assign `null` before deleting the property, so the draft proxy can revalidate the field
        values[currentKey] = null;
        delete values[currentKey];
        break;
      }
    }

    return draft;
  });

  return updatedValue;
};
