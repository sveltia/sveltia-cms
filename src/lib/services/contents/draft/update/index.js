import { isObject } from '@sveltia/utils/object';

import { forEachTargetLocale } from '$lib/services/contents/draft/update/locale';
import { getKeysByPrefix } from '$lib/services/contents/entry/key-paths';
import { setSubtree } from '$lib/services/contents/entry/subtree';

/**
 * @import { DraftValueStoreKey, EntryDraft, InternalLocaleCode } from '$lib/types/private';
 * @import { Field, FieldKeyPath } from '$lib/types/public';
 */

/**
 * Update a field with a non-primitive value. Since our internal representation of such fields is a
 * flattened object, we need to flatten the new value and update the draft accordingly.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {DraftValueStoreKey} args.valueStoreKey Value store key.
 * @param {FieldKeyPath} args.keyPath Field key path.
 * @param {InternalLocaleCode} args.locale Locale code.
 * @param {Field['i18n']} args.i18n Field i18n configuration.
 * @param {any[] | Record<string, any>} args.value Value to set.
 */
export const updateNonPrimitiveValue = ({ draft, valueStoreKey, locale, keyPath, i18n, value }) => {
  // Drop the existing subtree and write the new value in its place. The placeholder `setSubtree()`
  // writes also keeps validation running when there are no items at all
  forEachTargetLocale(
    { valueStore: draft[valueStoreKey], locale, i18n, draft, keyPath },
    (valueMap) => {
      setSubtree(valueMap, keyPath, value);
    },
  );
};

/**
 * Update a field whose value can be of any type, like a custom field: an array or object is stored
 * under its child key paths, and a primitive replaces whatever the field held before. When a
 * control clears a list or object value with `null` or an empty string, the child key paths have
 * to go too, or they would still make up the old value, both in the control and in the saved file.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {DraftValueStoreKey} args.valueStoreKey Value store key.
 * @param {FieldKeyPath} args.keyPath Field key path.
 * @param {InternalLocaleCode} args.locale Locale code.
 * @param {Field['i18n']} args.i18n Field i18n configuration.
 * @param {any} args.value Value to set.
 */
export const updateFieldValue = ({ draft, valueStoreKey, locale, keyPath, i18n, value }) => {
  if (Array.isArray(value) || isObject(value)) {
    updateNonPrimitiveValue({ draft, valueStoreKey, locale, keyPath, i18n, value });

    return;
  }

  forEachTargetLocale(
    { valueStore: draft[valueStoreKey], locale, i18n, draft, keyPath },
    (valueMap) => {
      // Keep the field’s own key in place rather than deleting it as well, so that it isn’t moved
      // to the end of the map
      getKeysByPrefix(valueMap, `${keyPath}.`, { live: true }).forEach((key) => {
        delete valueMap[key];
      });

      valueMap[keyPath] = value;
    },
  );
};
