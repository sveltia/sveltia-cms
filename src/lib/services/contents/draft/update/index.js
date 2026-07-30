import { flatten } from 'flat';

import { entryDraft, i18nAutoDupEnabled } from '$lib/services/contents/draft';

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

      // Remove all existing values for the List field in the current locale, including any nested
      // subfields, to ensure that the new value is set cleanly.
      /* v8 ignore start */
      Object.keys(draft[valueStoreKey][_locale] ?? {}).forEach((_keyPath) => {
        if (_keyPath === keyPath || _keyPath.startsWith(`${keyPath}.`)) {
          delete draft[valueStoreKey][_locale][_keyPath];
        }
      });
      /* v8 ignore end */

      // Make sure validation is triggered even if no items provided
      draft[valueStoreKey][_locale][keyPath] = Array.isArray(value) ? [] : {};

      // Add the new value(s) for the List field in the current locale.
      Object.entries(flatten(value)).forEach(([key, val]) => {
        draft[valueStoreKey][_locale][`${keyPath}.${key}`] = val;
      });
    });

    return draft;
  });

  i18nAutoDupEnabled.set(true);
};
