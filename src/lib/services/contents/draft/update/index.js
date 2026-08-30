import { entryDraft, i18nAutoDupEnabled } from '$lib/services/contents/draft';
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
  i18nAutoDupEnabled.set(false);

  entryDraft.update((draft) => {
    if (!draft) {
      return draft;
    }

    Object.keys(draft[valueStoreKey] ?? {}).forEach((_locale) => {
      if (i18n !== 'duplicate' && _locale !== locale) {
        return;
      }

      // Drop the existing subtree and write the new value in its place. The placeholder
      // `setSubtree()` writes also keeps validation running when there are no items at all
      setSubtree(draft[valueStoreKey][_locale], keyPath, value);
    });

    return draft;
  });

  i18nAutoDupEnabled.set(true);
};
