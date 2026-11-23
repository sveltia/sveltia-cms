import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
import { getOrderFieldKey } from '$lib/services/contents/collection/entries/reorder/config';
import { getDraftI18nConfig } from '$lib/services/contents/i18n/config';
import { isValueEmpty } from '$lib/services/utils/object';
import { getPullRequestEntries } from '$lib/services/workflow';

/**
 * @import { EntryDraft, InternalLocaleCode } from '$lib/types/private';
 * @import { FieldKeyPath } from '$lib/types/public';
 */

/**
 * Get the highest number stored under the given key path by the entries of a collection, in the
 * given locale. The entries still in a pull request count too, as a new entry saved with
 * Editorial Workflow has taken its number as well, including the new entries riding along in the
 * pull request of an entry of another collection. A value that isn’t a finite number is ignored.
 * @param {object} args Arguments.
 * @param {string} args.collectionName Entry collection name.
 * @param {FieldKeyPath} args.keyPath Key path of the value.
 * @param {InternalLocaleCode} args.locale Locale of the values, usually the default locale.
 * @returns {number | undefined} Highest number, which can be zero or negative, or `undefined` if no
 * entry has a number.
 */
export const getMaxEntryNumber = ({ collectionName, keyPath, locale }) =>
  [...getEntriesByCollection(collectionName), ...getPullRequestEntries(collectionName)].reduce(
    (/** @type {number | undefined} */ max, entry) => {
      const content = entry.locales[locale]?.content;
      const rawValue = content?.[keyPath];
      // `Number()` turns an empty value, like `null` or an empty string, into `0`, which isn’t a
      // number the entry has
      const value = isValueEmpty(rawValue) ? NaN : Number(rawValue);

      return Number.isFinite(value) && (max === undefined || value > max) ? value : max;
    },
    undefined,
  );

/**
 * For new entries in reorder-enabled entry collections, assign a fresh manual sort order to the
 * draft’s current values: highest existing order + 1, or 1 if no entries have one yet. The entries
 * still in a pull request count too. Doing this at save time (rather than draft creation) makes the
 * assignment race-safe even when a draft has been backed up and restored after another entry took
 * the previously computed value. Callers must gate on `draft.isNew` and
 * `draft.collection._type === 'entry'` themselves.
 * @param {EntryDraft} draft Draft to mutate in place.
 * @param {number} [offset] Number of entries already given an order that isn’t in the collection
 * yet, such as the entries added from a Relation field that are saved along with the entry being
 * edited. Each of them takes the next order, so the new one comes after them.
 */
export const assignManualSortOrder = (draft, offset = 0) => {
  const { collection, currentValues } = draft;
  const orderKey = getOrderFieldKey(collection);

  if (!orderKey) {
    return;
  }

  const { defaultLocale } = getDraftI18nConfig(draft);

  const maxOrder = getMaxEntryNumber({
    collectionName: collection.name,
    keyPath: orderKey,
    locale: defaultLocale,
  });

  // The order starts from 1, even if an entry has a negative one
  const nextOrder = Math.max(maxOrder ?? 0, 0) + offset + 1;

  Object.values(currentValues).forEach((valueMap) => {
    valueMap[orderKey] = nextOrder;
  });
};
