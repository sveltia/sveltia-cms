import { entryDraft } from '$lib/services/contents/draft';
import { forEachTargetLocale } from '$lib/services/contents/draft/update/locale';
import { setSubtree } from '$lib/services/contents/entry/subtree';

/**
 * @import { DraftValueStoreKey, InternalLocaleCode } from '$lib/types/private';
 * @import { Field, FieldKeyPath } from '$lib/types/public';
 */

/**
 * Update a field with a non-primitive value. Since our internal representation of such fields is a
 * flattened object, we need to flatten the new value and update the draft accordingly.
 * @param {object} args Arguments.
 * @param {DraftValueStoreKey} args.valueStoreKey Value store key.
 * @param {FieldKeyPath} args.keyPath Field key path.
 * @param {InternalLocaleCode} args.locale Locale code.
 * @param {Field['i18n']} args.i18n Field i18n configuration.
 * @param {any[] | Record<string, any>} args.value Value to set.
 */
export const updateNonPrimitiveValue = ({ valueStoreKey, locale, keyPath, i18n, value }) => {
  entryDraft.update((draft) => {
    if (!draft) {
      return draft;
    }

    // Drop the existing subtree and write the new value in its place. The placeholder
    // `setSubtree()` writes also keeps validation running when there are no items at all
    forEachTargetLocale({ valueStore: draft[valueStoreKey], locale, i18n }, (valueMap) => {
      setSubtree(valueMap, keyPath, value);
    });

    return draft;
  });
};
