import equal from 'fast-deep-equal';

import { forEachTargetLocale } from '$lib/services/contents/draft/update/locale';
import { syncDuplicateKeys } from '$lib/services/contents/fields/key-value/duplicate-keys';
import { getPairsFromContent, setPairs } from '$lib/services/contents/fields/key-value/pairs';

/**
 * @import { DraftValueStoreKey, EntryDraft, InternalLocaleCode } from '$lib/types/private';
 * @import { FieldKeyPath, KeyValueField } from '$lib/types/public';
 */

/**
 * Get key-value pairs from the entry draft.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {DraftValueStoreKey} [args.valueStoreKey] Key to store the values in {@link EntryDraft}.
 * @param {FieldKeyPath} args.keyPath Field key path.
 * @param {InternalLocaleCode} args.locale Current pane’s locale.
 * @returns {[string, string][]} Key-value pairs.
 */
export const getPairs = ({ draft, valueStoreKey = 'currentValues', keyPath, locale }) =>
  getPairsFromContent(draft[valueStoreKey][locale] ?? {}, keyPath);

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
 * Get the rows of the editor that have a key. A row whose key is still empty isn’t written to the
 * draft.
 * @param {[string, string][]} rows Key-value pairs shown in the editor.
 * @returns {[string, string][]} Pairs.
 */
const getKeyedRows = (rows) => rows.filter(([key]) => key.trim());

/**
 * Check whether the pairs stored in the draft differ from the rows of the editor, so the rows have
 * to be replaced with them. A row whose key is still empty hasn’t been written to the draft, so it
 * doesn’t count as a difference: adding one removes the `null` placeholder from the draft, which
 * makes the editor read the stored pairs again.
 * @param {object} args Arguments.
 * @param {[string, string][]} args.rows Key-value pairs shown in the editor.
 * @param {[string, string][]} args.storedPairs Key-value pairs stored in the draft.
 * @returns {boolean} Result.
 */
export const haveStoredPairsChanged = ({ rows, storedPairs }) =>
  !equal(getKeyedRows(rows), storedPairs);

/**
 * Check whether the `null` placeholder has to be stored for a field without pairs. A blank row
 * isn’t stored, so the field holds nothing until a key is filled in, and the placeholder enables
 * its validation.
 * @param {object} args Arguments.
 * @param {[string, string][]} args.storedPairs Key-value pairs stored in the draft.
 * @param {unknown} args.storedValue Value stored at the field’s key path.
 * @returns {boolean} Result.
 */
export const shouldStorePlaceholder = ({ storedPairs, storedValue }) =>
  !storedPairs.length && storedValue !== null;

/**
 * Get the pairs to be saved to the draft after the rows of the editor have changed.
 * @param {object} args Arguments.
 * @param {[string, string][]} args.rows Key-value pairs shown in the editor.
 * @param {('empty' | 'duplicate' | undefined)[]} args.validations Validation result of each row.
 * @param {() => [string, string][]} args.getStoredPairs Function returning the pairs stored in the
 * draft, only called when no row has a key.
 * @returns {[string, string][] | undefined} Pairs, or `undefined` if nothing is to be saved: a row
 * is invalid, or a row is waiting for its key, or there are no pairs to save and none to remove.
 */
export const getPairsToSave = ({ rows, validations, getStoredPairs }) => {
  if (validations.some(Boolean)) {
    return undefined;
  }

  const keyedRows = getKeyedRows(rows);

  if (keyedRows.length) {
    // Wait until every row has a key before saving
    return keyedRows.length === rows.length ? keyedRows : undefined;
  }

  // With no key in any row, the field holds no pairs, which only has to be saved when the last
  // pair has just been removed, leaving a blank row that isn’t stored. A blank pair stored as the
  // default value of a required field is left alone, so opening an entry changes nothing
  return getStoredPairs().some(([key]) => key.trim()) ? keyedRows : undefined;
};

/**
 * Save the key-value pairs to the entry draft.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {DraftValueStoreKey} [args.valueStoreKey] Key to store the values in {@link EntryDraft}.
 * @param {KeyValueField} args.fieldConfig Field configuration.
 * @param {FieldKeyPath} args.keyPath Field key path.
 * @param {InternalLocaleCode} args.locale Current pane’s locale.
 * @param {[string, string][]} args.pairs Key-value pairs.
 */
export const savePairs = ({
  draft,
  valueStoreKey = 'currentValues',
  keyPath,
  locale,
  fieldConfig,
  pairs,
}) => {
  const { i18n } = fieldConfig;
  const valueStore = draft[valueStoreKey];

  forEachTargetLocale({ valueStore, locale, i18n, draft, keyPath }, (content) => {
    setPairs(content, keyPath, pairs);

    // Without pairs, store the placeholder the editor uses for an empty field right away rather
    // than leaving it to the editor, so that the keys synced below take it along
    if (!pairs.length) {
      content[keyPath] = null;
    }
  });

  // Keys edited in the default locale have to reach the other locales
  if (i18n === 'duplicate_keys' && locale === draft.defaultLocale) {
    syncDuplicateKeys({ valueStore, defaultLocale: locale, keyPath });
  }
};
