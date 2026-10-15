import { suspendAutoDuplication } from '$lib/services/contents/draft';
import { forEachTargetLocale } from '$lib/services/contents/draft/update/locale';
import { isKeyPathWithin } from '$lib/services/contents/entry/key-paths';
import { getSubtree } from '$lib/services/contents/entry/subtree';
import { getLocalizedRelationValue } from '$lib/services/contents/fields/relation/helpers/locale';
import { getDraftI18nConfig } from '$lib/services/contents/i18n/config';
import { flattenKeys } from '$lib/services/utils/object';

/**
 * @import {
 * DraftValueStoreKey,
 * EntryDraft,
 * ExpanderStateList,
 * InternalLocaleCode,
 * } from '$lib/types/private';
 * @import { Field, FieldKeyPath } from '$lib/types/public';
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
 * Traverse the given object by decoding dot-notated key path.
 *
 * The object is a draft’s live content, not a snapshot of it, and the caller writes the manipulated
 * list straight back into it, so the key paths have to be read as they are right now.
 * @param {Record<string, any>} obj Original object.
 * @param {FieldKeyPath} keyPath Dot-notated field name.
 * @returns {[values: any, remainder: any]} Unflatten values and flatten remainder.
 */
export const getItemList = (obj, keyPath) => [
  getSubtree(obj, keyPath, { live: true }) ?? [],
  // Only the list itself and the key paths below it belong to the list, not a sibling whose name
  // merely begins with the list’s, such as `tags-extra` for `tags`
  Object.fromEntries(Object.entries(obj).filter(([k]) => !isKeyPathWithin(k, keyPath))),
];

/**
 * Move the expander states of a list’s items to follow the items once the list has been
 * manipulated. The states are flattened, so an item’s own state, e.g. `authors.1`, comes with the
 * states of the objects and lists nested in it, e.g. `authors.1.details#` or `authors.1.books.0`,
 * which all have to be renumbered along with the item.
 * @param {Record<string, boolean>} states Flattened expander states.
 * @param {FieldKeyPath} keyPath Dot-notated field name of the list.
 * @param {ExpanderStateList} expanderStateList Manipulated list.
 * @returns {Record<string, boolean>} New expander states.
 */
export const moveListExpanderStates = (states, keyPath, expanderStateList) => {
  const prefix = `${keyPath}.`;
  /** @type {Record<string, boolean>} */
  const newStates = {};
  /** @type {Map<number, [suffix: string, state: boolean][]>} */
  const itemStates = new Map();

  Object.entries(states).forEach(([key, state]) => {
    // The list’s own state, e.g. `authors#`, stays as it is, as do the states of other fields
    const [, index, suffix] = key.startsWith(prefix)
      ? (key.slice(prefix.length).match(/^(\d+)($|[.#].*)/) ?? [])
      : [];

    if (index === undefined) {
      newStates[key] = state;
    } else {
      itemStates.set(Number(index), [...(itemStates.get(Number(index)) ?? []), [suffix, state]]);
    }
  });

  expanderStateList.forEach((item, index) => {
    if (typeof item === 'number') {
      itemStates.get(item)?.forEach(([suffix, state]) => {
        newStates[`${prefix}${index}${suffix}`] = state;
      });
    } else {
      newStates[`${prefix}${index}`] = item;
    }
  });

  return newStates;
};

/**
 * Update the value in a list field.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {InternalLocaleCode} args.locale Target locale.
 * @param {DraftValueStoreKey} [args.valueStoreKey] Key to store the values in {@link EntryDraft}.
 * @param {FieldKeyPath} args.keyPath Dot-notated field name.
 * @param {(arg: { valueList: any[], expanderStateList: ExpanderStateList }) => void }
 * args.manipulate A function to manipulate the list, which takes one object argument containing the
 * value list and the expander state list, to be manipulated in the same way. The typical usage is
 * `list.splice()`.
 */
export const updateListField = ({
  draft,
  locale,
  valueStoreKey = 'currentValues',
  keyPath,
  manipulate,
}) => {
  const { defaultLocale } = getDraftI18nConfig(draft);
  const [valueList, valueListRemainder] = getItemList(draft[valueStoreKey][locale], keyPath);
  const isDefaultLocale = locale === defaultLocale;
  // Manipulation should only happen once with the default locale
  /** @type {ExpanderStateList} */
  const expanderStateList = isDefaultLocale ? [...Array(valueList.length).keys()] : [];

  manipulate({ valueList, expanderStateList });

  suspendAutoDuplication(() => {
    updateObject(draft[valueStoreKey][locale], {
      ...flattenKeys(valueList, keyPath),
      ...valueListRemainder,
    });

    if (isDefaultLocale) {
      updateObject(
        draft.expanderStates._,
        moveListExpanderStates(draft.expanderStates._, keyPath, expanderStateList),
      );
    }
  });
};

/**
 * Update the value in a list field for every locale the update has to be written to: the given
 * locale, or every locale if the field has the `duplicate` i18n strategy. See
 * {@link forEachTargetLocale} and {@link updateListField}.
 *
 * The items of a translatable list with a subfield using the `duplicate` strategy are paired across
 * the locales by their position, so an item added, removed or moved in the default locale is added,
 * removed or moved in every other locale as well. Otherwise the remaining items would no longer
 * line up, and a duplicated value would be copied to the wrong item.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {InternalLocaleCode} args.locale Locale being edited.
 * @param {Field['i18n']} args.i18n Field-level `i18n` option.
 * @param {boolean} [args.pairedItems] Whether the list’s items are paired across the locales,
 * because the list has a subfield with the `duplicate` strategy.
 * @param {Field} [args.fieldConfig] Field configuration. If given, the values of another locale are
 * localized for the manipulation, which works with the values of the locale being edited. This is
 * for a Relation field whose `value_field` option has a locale prefix, e.g. `{{locale}}/{{slug}}`,
 * so that its value is stored as `fr/foo` rather than `en/foo` in the French content.
 * @param {DraftValueStoreKey} [args.valueStoreKey] Key to store the values in {@link EntryDraft}.
 * @param {FieldKeyPath} args.keyPath Dot-notated field name.
 * @param {(arg: {
 * valueList: any[], expanderStateList: ExpanderStateList, locale: InternalLocaleCode
 * }) => void } args.manipulate A function to manipulate the list, which also takes the locale the
 * values are for, so that an item added to every locale can be created for each. See
 * {@link updateListField}.
 */
export const updateListFieldForLocales = ({
  draft,
  locale,
  i18n,
  pairedItems = false,
  fieldConfig,
  valueStoreKey = 'currentValues',
  keyPath,
  manipulate,
}) => {
  /**
   * Localize the values in a list.
   * @param {any[]} list Values.
   * @param {InternalLocaleCode} sourceLocale Locale the values are for.
   * @param {InternalLocaleCode} targetLocale Locale to localize the values for.
   * @returns {any[]} Localized values.
   */
  const localize = (list, sourceLocale, targetLocale) =>
    list.map((value) =>
      getLocalizedRelationValue({
        fieldConfig: /** @type {Field} */ (fieldConfig),
        value,
        sourceLocale,
        targetLocale,
      }),
    );

  const { defaultLocale } = (draft.collectionFile ?? draft.collection)._i18n;

  forEachTargetLocale(
    {
      valueStore: draft[valueStoreKey],
      locale,
      // The structure of a list with paired items is duplicated from the default locale, even
      // though the list itself is translatable (https://github.com/sveltia/sveltia-cms/issues/1065)
      i18n: pairedItems && locale === defaultLocale ? 'duplicate' : i18n,
      draft,
      keyPath,
    },
    (_valueMap, _locale) => {
      updateListField({
        draft,
        locale: _locale,
        valueStoreKey,
        keyPath,
        manipulate:
          !fieldConfig || _locale === locale
            ? ({ valueList, expanderStateList }) =>
                manipulate({ valueList, expanderStateList, locale: _locale })
            : ({ valueList, expanderStateList }) => {
                // Manipulate the values as they would be in the locale being edited, as the
                // manipulation compares and adds values of that locale, then localize them back
                const sourceList = localize(valueList, _locale, locale);

                manipulate({ valueList: sourceList, expanderStateList, locale });
                valueList.splice(0, valueList.length, ...localize(sourceList, locale, _locale));
              },
      });
    },
  );
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
 * Add values to a multi-value field, such as a File or Image field with the `multiple` option
 * enabled, after its existing items, or put a value in place of an existing item.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {InternalLocaleCode} args.locale Target locale.
 * @param {DraftValueStoreKey} [args.valueStoreKey] Key to store the values in {@link EntryDraft}.
 * @param {FieldKeyPath} args.keyPath Dot-notated field name.
 * @param {any[]} args.newValues Values to add.
 * @param {number} [args.replaceIndex] Index of the item to replace with the first value. The other
 * values are ignored, because an item can only be replaced by one.
 * @param {number} [args.max] Maximum number of items the field takes. The values that don’t fit are
 * ignored, so dropping or picking more files than there’s room for doesn’t exceed the limit.
 */
export const addMultiValueItems = ({
  draft,
  locale,
  valueStoreKey = 'currentValues',
  keyPath,
  newValues,
  replaceIndex,
  max = Infinity,
}) => {
  const values = draft[valueStoreKey][locale];

  if (replaceIndex !== undefined) {
    const [newValue] = newValues;

    if (newValue !== undefined) {
      values[`${keyPath}.${replaceIndex}`] = newValue;
    }

    return;
  }

  const { length } = getMultiValueList(values, keyPath);

  newValues.slice(0, Math.max(0, max - length)).forEach((value, index) => {
    values[`${keyPath}.${length + index}`] = value;
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
