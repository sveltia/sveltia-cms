import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
import { getOrderFieldKey } from '$lib/services/contents/collection/entries/reorder/config';
import { getDraftI18nConfig } from '$lib/services/contents/i18n/config';
import { getUnpublishedEntriesByCollection } from '$lib/services/workflow';

/**
 * @import { EntryDraft, InternalLocaleCode } from '$lib/types/private';
 * @import { FieldKeyPath } from '$lib/types/public';
 */

/**
 * Get the highest number stored under the given key path by the entries of a collection, in the
 * given locale. The entries still in a pull request count too, as a new entry saved with
 * Editorial Workflow has taken its number as well. A value that isn’t a finite number is ignored,
 * and so is a negative one, as the result is never below zero.
 * @param {object} args Arguments.
 * @param {string} args.collectionName Entry collection name.
 * @param {FieldKeyPath} args.keyPath Key path of the value.
 * @param {InternalLocaleCode} args.locale Locale of the values, usually the default locale.
 * @returns {number} Highest number, or `0` if no entry has a positive one.
 */
export const getMaxEntryNumber = ({ collectionName, keyPath, locale }) =>
  [
    ...getEntriesByCollection(collectionName),
    ...getUnpublishedEntriesByCollection(collectionName),
  ].reduce((max, entry) => {
    const value = Number(entry.locales[locale]?.content?.[keyPath]);

    return Number.isFinite(value) && value > max ? value : max;
  }, 0);

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

  const nextOrder = maxOrder + offset + 1;

  Object.values(currentValues).forEach((valueMap) => {
    valueMap[orderKey] = nextOrder;
  });
};
