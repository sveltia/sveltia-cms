import { getDefaultValues } from '$lib/services/contents/draft/defaults';
import { getInitialExpanderState } from '$lib/services/contents/editor/fields';
import { tagListItems } from '$lib/services/contents/fields/list/helpers';
import { unflattenKeys } from '$lib/services/utils/object';

/**
 * @import { EntryDraft, InternalLocaleCode } from '$lib/types/private';
 * @import { Field, FieldKeyPath } from '$lib/types/public';
 */

/**
 * Get the initial expander states of a List field with subfield(s) and its items.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {FieldKeyPath} args.keyPath Key path of the list.
 * @param {number} args.itemCount Number of items in the list.
 * @param {InternalLocaleCode} args.locale Locale code.
 * @param {boolean | 'auto'} [args.collapsed] The `collapsed` option of the field, which applies to
 * the items.
 * @param {boolean | 'auto'} [args.minimizeCollapsed] The `minimize_collapsed` option of the field,
 * which applies to the list itself. With `auto`, an empty list is expanded.
 * @returns {Record<string, boolean>} Map of key path and state. The list itself is keyed by its key
 * path with the `#` suffix.
 */
export const getInitialListExpanderStates = ({
  draft,
  keyPath,
  itemCount,
  locale,
  collapsed,
  minimizeCollapsed = false,
}) => ({
  [`${keyPath}#`]: minimizeCollapsed === 'auto' ? !itemCount : !minimizeCollapsed,
  ...Object.fromEntries(
    Array.from({ length: itemCount }, (__, index) => {
      const key = `${keyPath}.${index}`;

      return [key, getInitialExpanderState({ draft, key, locale, collapsed })];
    }),
  ),
});

/**
 * Create an item to be added to a List field with subfield(s): a copy of an existing item, or a new
 * one filled with the default values.
 * @param {object} args Arguments.
 * @param {any[]} args.valueList Current items of the list. Unless the list has a single subfield,
 * the items are tagged with their original key paths in place, as they’re about to shift.
 * @param {FieldKeyPath} args.keyPath Key path of the list.
 * @param {number} [args.dupIndex] List index of the item to be duplicated, if any.
 * @param {Field[]} args.subFields Subfields of the new item, used to fill in the default values.
 * @param {boolean} args.hasSingleSubField Whether the list has a single subfield, in which case the
 * items are the subfield values themselves rather than objects.
 * @param {Field} [args.field] Single subfield of the list, if any.
 * @param {string} [args.type] Variable type name of the new item, if the list has variable types.
 * @param {string} args.typeKey Property name holding the variable type name.
 * @param {InternalLocaleCode} args.locale Locale code.
 * @param {InternalLocaleCode} args.defaultLocale Default locale code.
 * @returns {any} New item.
 */
export const createListItem = ({
  valueList,
  keyPath,
  dupIndex,
  subFields,
  hasSingleSubField,
  field,
  type,
  typeKey,
  locale,
  defaultLocale,
}) => {
  const newItem = (() => {
    if (typeof dupIndex === 'number') {
      return structuredClone(valueList[dupIndex]);
    }

    const item = unflattenKeys(getDefaultValues({ fields: subFields, locale, defaultLocale }));

    return hasSingleSubField && field ? item[field.name] : item;
  })();

  if (type) {
    newItem[typeKey] = type;
  }

  if (!hasSingleSubField) {
    // Add a random ID to the new item to ensure it is unique. This is necessary for the `key`
    // attribute in the `each` block.
    newItem.__sc_item_id = crypto.randomUUID();
    // A duplicated item is a new one, so it mustn’t keep the original position of its source, or a
    // revert would treat it as the source item
    delete newItem.__sc_item_original_key_path;

    // Track original key paths for existing items before they shift due to the insertion
    tagListItems(valueList, keyPath);
  }

  return newItem;
};
