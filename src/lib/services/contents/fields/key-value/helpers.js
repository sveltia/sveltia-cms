import { get } from 'svelte/store';

import { forEachTargetLocale } from '$lib/services/contents/draft/update/locale';
import { syncDuplicateKeys } from '$lib/services/contents/fields/key-value/duplicate-keys';
import { getPairsFromContent, setPairs } from '$lib/services/contents/fields/key-value/pairs';

/**
 * @import { Writable } from 'svelte/store';
 * @import { DraftValueStoreKey, EntryDraft, InternalLocaleCode } from '$lib/types/private';
 * @import { FieldKeyPath, KeyValueField } from '$lib/types/public';
 */

/**
 * Get key-value pairs from the draft store.
 * @param {object} args Arguments.
 * @param {Writable<EntryDraft>} args.entryDraft Draft store.
 * @param {DraftValueStoreKey} [args.valueStoreKey] Key to store the values in {@link EntryDraft}.
 * @param {FieldKeyPath} args.keyPath Field key path.
 * @param {InternalLocaleCode} args.locale Current pane’s locale.
 * @returns {[string, string][]} Key-value pairs.
 */
export const getPairs = ({ entryDraft, valueStoreKey = 'currentValues', keyPath, locale }) =>
  getPairsFromContent(get(entryDraft)[valueStoreKey][locale] ?? {}, keyPath);

/**
 * Validate the given key-value pairs.
 * @param {object} args Arguments.
 * @param {[string, string][]} args.pairs Key-value pairs.
 * @param {boolean[]} args.edited Whether each pair’s key is edited.
 * @returns {('empty' | 'duplicate' | undefined)[]} Result.
 */
export const validatePairs = ({ pairs, edited }) =>
  pairs.map(([key], index, arr) => {
    if (!key.trim() && edited[index]) {
      return 'empty';
    }

    if (key.trim() && arr.findIndex((i) => i[0] === key) !== index) {
      return 'duplicate';
    }

    return undefined;
  });

/**
 * Save the key-value pairs to the draft store.
 * @param {object} args Arguments.
 * @param {Writable<EntryDraft>} args.entryDraft Draft store.
 * @param {DraftValueStoreKey} [args.valueStoreKey] Key to store the values in {@link EntryDraft}.
 * @param {KeyValueField} args.fieldConfig Field configuration.
 * @param {FieldKeyPath} args.keyPath Field key path.
 * @param {InternalLocaleCode} args.locale Current pane’s locale.
 * @param {[string, string][]} args.pairs Key-value pairs.
 */
export const savePairs = ({
  entryDraft,
  valueStoreKey = 'currentValues',
  keyPath,
  locale,
  fieldConfig,
  pairs,
}) => {
  const { i18n } = fieldConfig;

  entryDraft.update((draft) => {
    if (draft) {
      const valueStore = draft[valueStoreKey];

      forEachTargetLocale({ valueStore, locale, i18n }, (content) => {
        setPairs(content, keyPath, pairs);
      });

      // Keys edited in the default locale have to reach the other locales
      if (i18n === 'duplicate_keys' && locale === draft.defaultLocale) {
        syncDuplicateKeys({ valueStore, defaultLocale: locale, keyPath });
      }
    }

    return draft;
  });
};
