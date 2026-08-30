import { get } from 'svelte/store';

import { entryDraft } from '$lib/services/contents/draft';
import { getListItemIndexes, indexListItems } from '$lib/services/contents/entry/content-index';
import { getComputedValue } from '$lib/services/contents/fields/compute/helpers';
import { getListFieldInfo } from '$lib/services/contents/fields/list/helpers';
import { COMPONENT_NAME_PREFIX_REGEX } from '$lib/services/contents/fields/rich-text';
import { getComponentDef } from '$lib/services/contents/fields/rich-text/components/definitions';

/**
 * @import {
 * DraftValueStoreKey,
 * EntryDraft,
 * FlattenedEntryContent,
 * InternalLocaleCode,
 * ListItemIndex,
 * } from '$lib/types/private';
 * @import {
 * ComputeField,
 * Field,
 * FieldKeyPath,
 * FieldWithSubFields,
 * FieldWithTypes,
 * ListField,
 * ListFieldWithSubField,
 * } from '$lib/types/public';
 */

/**
 * A Compute field found in the content, paired with the key path it occupies.
 * @typedef {object} ComputeFieldInfo
 * @property {FieldKeyPath} keyPath Key path of the field.
 * @property {ComputeField} fieldConfig Field configuration.
 */

/**
 * @typedef {object} CollectArgs
 * @property {Field} field Field configuration.
 * @property {FieldKeyPath} keyPath Key path the field occupies.
 * @property {FlattenedEntryContent} valueMap Flattened entry content.
 * @property {() => ListItemIndex} getIndex Get the index of the list items in the content. The
 * index is only built once a list is actually reached, so a Compute field that sits outside one
 * costs no scan at all.
 * @property {ComputeFieldInfo[]} results Collected fields, appended to in place.
 */

/**
 * Get the sub-fields of an Object field or list item, resolving the variable type against the type
 * name stored in the content when the field has the `types` option.
 * @param {Field} field Field configuration.
 * @param {FlattenedEntryContent} valueMap Flattened entry content.
 * @param {FieldKeyPath} keyPath Key path of the object or list item.
 * @returns {Field[]} Sub-fields, or an empty array if the field holds none.
 */
const getSubFields = (field, valueMap, keyPath) => {
  const { fields } = /** @type {FieldWithSubFields} */ (field);

  if (fields) {
    return fields;
  }

  const { types, typeKey = 'type' } = /** @type {FieldWithTypes} */ (field);

  return types?.find(({ name }) => name === valueMap[`${keyPath}.${typeKey}`])?.fields ?? [];
};

/**
 * Cache of {@link containsComputeField} results, keyed by the field configuration. Configurations
 * are stable objects, so each one is answered once per session rather than on every draft update.
 * @type {WeakMap<Field, boolean>}
 */
const computeFieldCacheMap = new WeakMap();

/**
 * Check whether the given field is a Compute field or holds one anywhere below it. Unlike
 * {@link collectFromField}, this only looks at the configuration, so every branch of a variable
 * type field is visited and the answer holds for the whole session.
 * @param {Field} field Field configuration.
 * @returns {boolean} Result.
 */
const containsComputeField = (field) => {
  const cached = computeFieldCacheMap.get(field);

  if (cached !== undefined) {
    return cached;
  }

  const { widget: fieldType = 'string' } = field;
  let result = false;

  if (fieldType === 'compute') {
    result = true;
  } else if (fieldType === 'object' || fieldType === 'list') {
    const { field: subField } = /** @type {ListFieldWithSubField} */ (field);
    const { fields = [] } = /** @type {FieldWithSubFields} */ (field);
    const { types = [] } = /** @type {FieldWithTypes} */ (field);

    result = [subField, ...fields, ...types.flatMap(({ fields: typeFields = [] }) => typeFields)]
      .filter(Boolean)
      .some(containsComputeField);
  }

  computeFieldCacheMap.set(field, result);

  return result;
};

/**
 * Collect the Compute fields in the given field, which may be one itself or hold some below it.
 * @param {CollectArgs} args Arguments.
 */
const collectFromField = (args) => {
  const { field, keyPath, valueMap, getIndex, results } = args;

  // Stop before descending into a subtree the configuration says holds nothing to compute. This is
  // what keeps an entry’s other content — a long list of plain fields, say — out of the walk
  if (!containsComputeField(field)) {
    return;
  }

  const { widget: fieldType = 'string' } = field;

  if (fieldType === 'compute') {
    results.push({ keyPath, fieldConfig: /** @type {ComputeField} */ (field) });

    return;
  }

  if (fieldType === 'object') {
    // A `null` value means the optional Object field is collapsed, so it holds no sub-values
    if (valueMap[keyPath] === null) {
      return;
    }

    getSubFields(field, valueMap, keyPath).forEach((subField) => {
      collectFromField({ ...args, field: subField, keyPath: `${keyPath}.${subField.name}` });
    });

    return;
  }

  // Only a List field is left: the guard above lets nothing else with sub-fields through, and a
  // simple List field holding primitives can’t contain a Compute field either
  const listField = /** @type {ListField} */ (field);
  const { hasSingleSubField } = getListFieldInfo(listField);

  getListItemIndexes(getIndex(), keyPath).forEach((itemIndex) => {
    const itemKeyPath = `${keyPath}.${itemIndex}`;

    // The single sub-field of a List field occupies the item’s own key path, with no name of its
    // own appended to it
    if (hasSingleSubField) {
      collectFromField({
        ...args,
        field: /** @type {ListFieldWithSubField} */ (listField).field,
        keyPath: itemKeyPath,
      });

      return;
    }

    getSubFields(listField, valueMap, itemKeyPath).forEach((subField) => {
      collectFromField({ ...args, field: subField, keyPath: `${itemKeyPath}.${subField.name}` });
    });
  });
};

/**
 * Collect the Compute fields in the given field list, descending into the Object fields and list
 * items that exist in the content.
 *
 * The fields are found from the configuration rather than from the content’s key paths, so a
 * Compute field is picked up even before it holds anything — which is the case for a field added to
 * the configuration after the entry was written, and for one inside a rich text editor component,
 * where missing values are deliberately not filled in.
 * @internal
 * @param {object} args Arguments.
 * @param {Field[]} args.fields Field list.
 * @param {FlattenedEntryContent} args.valueMap Flattened entry content.
 * @param {() => ListItemIndex} args.getIndex Get the index of the list items in the content.
 * @param {string} [args.keyPathPrefix] Key path prefix of the containing object, including its
 * trailing separator, e.g. `body:c12:` for a rich text editor component. Empty at the top level.
 * @returns {ComputeFieldInfo[]} Collected fields.
 */
export const collectComputeFields = ({ fields, valueMap, getIndex, keyPathPrefix = '' }) => {
  /** @type {ComputeFieldInfo[]} */
  const results = [];

  fields.forEach((field) => {
    collectFromField({
      field,
      keyPath: `${keyPathPrefix}${field.name}`,
      valueMap,
      getIndex,
      results,
    });
  });

  return results;
};

/**
 * Collect the Compute fields within the rich text editor components stored in the given content.
 *
 * Unlike an entry’s own fields, these aren’t known from the collection configuration: each
 * component instance records the component it was created from under its own key path prefix, and
 * the fields come from that component’s definition.
 * @internal
 * @param {FlattenedEntryContent} valueMap Flattened content of the `extraValues` store.
 * @param {() => ListItemIndex} getIndex Get the index of the list items in the content.
 * @returns {ComputeFieldInfo[]} Collected fields.
 */
export const collectComponentComputeFields = (valueMap, getIndex) => {
  /** @type {ComputeFieldInfo[]} */
  const results = [];
  /** @type {Set<string>} */
  const visitedPrefixes = new Set();

  Object.keys(valueMap).forEach((key) => {
    const [keyPathPrefix] = key.match(COMPONENT_NAME_PREFIX_REGEX) ?? [];

    if (keyPathPrefix === undefined || visitedPrefixes.has(keyPathPrefix)) {
      return;
    }

    visitedPrefixes.add(keyPathPrefix);

    const { fields } = getComponentDef(valueMap[`${keyPathPrefix}__sc_component_name`]) ?? {};

    if (fields) {
      results.push(...collectComputeFields({ fields, valueMap, getIndex, keyPathPrefix }));
    }
  });

  return results;
};

/**
 * Check whether a field’s value has to be computed for the given locale. This mirrors the condition
 * under which the editor shows the field: a field that can’t be edited in a locale doesn’t hold a
 * value there either, and writing one would add it to the saved file.
 * @param {object} args Arguments.
 * @param {Field} args.fieldConfig Field configuration.
 * @param {InternalLocaleCode} args.locale Locale code.
 * @param {InternalLocaleCode} args.defaultLocale Default locale code.
 * @param {boolean} args.i18nEnabled Whether i18n is enabled for the collection.
 * @returns {boolean} Result.
 */
const isLocaleTarget = ({ fieldConfig, locale, defaultLocale, i18nEnabled }) =>
  locale === defaultLocale ||
  (i18nEnabled && [true, 'translate', 'duplicate'].includes(fieldConfig.i18n ?? false));

/**
 * Resolve every Compute field in the given locale’s content and write the results back. The content
 * is modified in place.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {DraftValueStoreKey} args.valueStoreKey Key the values are stored under.
 * @param {InternalLocaleCode} args.locale Locale code.
 * @param {FlattenedEntryContent} args.valueMap Flattened entry content for the locale.
 * @returns {boolean} Whether any value has changed.
 */
const updateLocaleComputedValues = ({ draft, valueStoreKey, locale, valueMap }) => {
  const { collectionName, fileName, collection, collectionFile, fields, isIndexFile } = draft;
  const { i18nEnabled, defaultLocale } = (collectionFile ?? collection)._i18n;
  /** @type {ListItemIndex | undefined} */
  let index;

  /**
   * Get the index of the list items in the content, building it on first use.
   * @returns {ListItemIndex} Index.
   */
  const getIndex = () => {
    index ??= indexListItems(valueMap);

    return index;
  };

  const computeFields =
    valueStoreKey === 'extraValues'
      ? collectComponentComputeFields(valueMap, getIndex)
      : collectComputeFields({ fields, valueMap, getIndex });

  let changed = false;

  computeFields.forEach(({ keyPath, fieldConfig }) => {
    // The values of a rich text editor component belong to the document text, which is edited in
    // every locale the parent field is, so the entry’s own locale rules don’t apply to them
    if (
      valueStoreKey !== 'extraValues' &&
      !isLocaleTarget({ fieldConfig, locale, defaultLocale, i18nEnabled })
    ) {
      return;
    }

    const value = getComputedValue({
      fieldConfig,
      keyPath,
      locale,
      valueMap,
      collectionName,
      fileName,
      isIndexFile,
    });

    if (valueMap[keyPath] !== value) {
      valueMap[keyPath] = value;
      changed = true;
    }
  });

  return changed;
};

/**
 * Resolve every Compute field in the current entry draft and write the results back.
 *
 * A Compute field derives its value from the rest of the content, so it has to be resolved again
 * whenever anything changes — including a change the user can’t see, such as a list item removed
 * while its parent is collapsed, which shifts the index of every item below it. That’s why the
 * draft is walked here rather than letting each field editor compute its own value: an editor only
 * runs while it’s rendered, and neither a collapsed list item nor one that has yet to be scrolled
 * into view renders its fields.
 *
 * A value is written only when it actually changes, so the store update this ends with settles on
 * the next run instead of looping.
 * @returns {boolean} Whether any value has changed.
 */
export const updateComputedValues = () => {
  const draft = get(entryDraft);

  if (!draft) {
    return false;
  }

  const { currentLocales, fields } = draft;
  let changed = false;

  /** @type {DraftValueStoreKey[]} */ (['currentValues', 'extraValues']).forEach(
    (valueStoreKey) => {
      // The entry’s own fields are known up front, so an entry configured without a Compute field
      // skips the content walk entirely. A rich text editor component’s fields aren’t, but nothing
      // has to be walked while the document holds no component either
      if (valueStoreKey === 'currentValues' && !fields.some(containsComputeField)) {
        return;
      }

      Object.entries(draft[valueStoreKey]).forEach(([locale, valueMap]) => {
        if (!currentLocales[locale] || !Object.keys(valueMap).length) {
          return;
        }

        if (updateLocaleComputedValues({ draft, valueStoreKey, locale, valueMap })) {
          changed = true;
        }
      });
    },
  );

  if (changed) {
    // Notify the subscribers, including the shared value map snapshot, of the values just written
    entryDraft.update((_draft) => _draft);
  }

  return changed;
};
