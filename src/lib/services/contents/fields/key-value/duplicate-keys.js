import {
  getKeyValueField,
  getPairsFromContent,
  PAIR_KEY_PATH_REGEX,
  setPairs,
} from '$lib/services/contents/fields/key-value/pairs';

/**
 * @import { GetFieldArgs, InternalLocaleCode, LocaleContentMap } from '$lib/types/private';
 * @import { FieldKeyPath } from '$lib/types/public';
 */

/**
 * Line up a locale’s key-value pairs with the default locale’s keys, as the `duplicate_keys` i18n
 * strategy requires. The locale keeps its own values: a key it already holds keeps its value, a key
 * that has just been renamed in the default locale — the pair at the same position, whose key is no
 * longer there — keeps the value it had under the old name, and a new key starts empty.
 * @param {[string, string][]} defaultPairs Pairs in the default locale.
 * @param {[string, string][]} localePairs Pairs in the locale to line up.
 * @returns {[string, string][]} Pairs for the locale, in the default locale’s order.
 */
export const alignPairs = (defaultPairs, localePairs) => {
  const keys = defaultPairs.map(([key]) => key);

  return defaultPairs.map(([key], index) => {
    const existing = localePairs.find(([_key]) => _key === key);

    if (existing) {
      return existing;
    }

    const displaced = localePairs[index];

    if (displaced && !keys.includes(displaced[0])) {
      return [key, displaced[1]];
    }

    return [key, ''];
  });
};

/**
 * Mirror the keys of a KeyValue field using the `duplicate_keys` i18n strategy from the default
 * locale to every other locale in the given value store, keeping each locale’s own values. See
 * {@link alignPairs} for how the values are carried over.
 * @param {object} args Arguments.
 * @param {LocaleContentMap} args.valueStore Value store to update, e.g. `draft.currentValues`,
 * keyed by locale. Each locale’s content is modified in place.
 * @param {InternalLocaleCode} args.defaultLocale Default locale.
 * @param {FieldKeyPath} args.keyPath Field key path.
 */
export const syncDuplicateKeys = ({ valueStore, defaultLocale, keyPath }) => {
  const defaultPairs = getPairsFromContent(valueStore[defaultLocale] ?? {}, keyPath);

  Object.entries(valueStore).forEach(([locale, content]) => {
    if (locale === defaultLocale) {
      return;
    }

    const localePairs = getPairsFromContent(content, keyPath);
    const alignedPairs = alignPairs(defaultPairs, localePairs);

    // Leave the content alone if nothing has changed, so the draft isn’t marked as modified
    if (
      alignedPairs.length !== localePairs.length ||
      alignedPairs.some(([key, value], index) => {
        const [_key, _value] = localePairs[index];

        return key !== _key || value !== _value;
      })
    ) {
      setPairs(content, keyPath, alignedPairs);
    }
  });
};

/**
 * Find the KeyValue fields using the `duplicate_keys` i18n strategy that hold pairs in any locale
 * of the given value store. The pairs are stored under arbitrary keys that `getField()` can’t
 * resolve, so the fields are found through the parent key path of each pair instead.
 * @param {object} args Arguments.
 * @param {LocaleContentMap} args.valueStore Value store, e.g. `draft.currentValues`, keyed by
 * locale.
 * @param {Omit<GetFieldArgs, 'keyPath' | 'valueMap'>} args.getFieldArgs Arguments for the
 * `getField()` function.
 * @returns {FieldKeyPath[]} Key paths of the fields.
 */
export const getDuplicateKeysFieldKeyPaths = ({ valueStore, getFieldArgs }) => {
  /** @type {Set<FieldKeyPath>} */
  const keyPaths = new Set();

  Object.values(valueStore).forEach((valueMap) => {
    Object.keys(valueMap).forEach((pairKeyPath) => {
      const fieldConfig = getKeyValueField({ ...getFieldArgs, keyPath: pairKeyPath, valueMap });

      if (fieldConfig?.i18n === 'duplicate_keys') {
        keyPaths.add(pairKeyPath.replace(PAIR_KEY_PATH_REGEX, ''));
      }
    });
  });

  return [...keyPaths];
};

/**
 * Mirror the keys of every KeyValue field using the `duplicate_keys` i18n strategy from the default
 * locale to the other locales in the given value store. See {@link syncDuplicateKeys}.
 * @param {object} args Arguments.
 * @param {LocaleContentMap} args.valueStore Value store to update, e.g. `draft.currentValues`,
 * keyed by locale. Each locale’s content is modified in place.
 * @param {InternalLocaleCode} args.defaultLocale Default locale.
 * @param {Omit<GetFieldArgs, 'keyPath' | 'valueMap'>} args.getFieldArgs Arguments for the
 * `getField()` function.
 */
export const syncAllDuplicateKeys = ({ valueStore, defaultLocale, getFieldArgs }) => {
  getDuplicateKeysFieldKeyPaths({ valueStore, getFieldArgs }).forEach((keyPath) => {
    syncDuplicateKeys({ valueStore, defaultLocale, keyPath });
  });
};
