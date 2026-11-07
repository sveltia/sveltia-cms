import { getEntryDisplayLocale } from '$lib/services/contents/entry/paths';
import { getPropertyValue } from '$lib/services/contents/entry/values';

/**
 * @import { InternalLocaleCode } from '$lib/types/private';
 */

/**
 * Check whether a raw field value is empty, so that the entry has nothing to sort or group by.
 * @param {any} value Raw value.
 * @returns {boolean} Whether the value is `undefined`, `null` or an empty string.
 */
export const isEmptyValue = (value) => value === undefined || value === null || value === '';

/**
 * Get an entry’s field value in the locale the entry is listed in, for the collection’s `filter`
 * option and the entry list’s sorting, filtering and grouping. That’s the default locale, or the
 * first locale the entry has if it lacks the default one, e.g. a multi-file i18n entry with only
 * `hello.fr.md`, like its summary. See `getEntryDisplayLocale()`.
 * @param {Parameters<typeof getPropertyValue>[0]} args Arguments for `getPropertyValue()`, where
 * `locale` is the default locale of the collection.
 * @returns {any} Value.
 */
export const getListedEntryValue = ({ entry, locale, ...rest }) =>
  getPropertyValue({
    ...rest,
    entry,
    // An entry without any locale has no value, so the locale doesn’t matter
    locale: /** @type {InternalLocaleCode} */ (getEntryDisplayLocale(entry.locales, locale)),
  });

/**
 * Normalize the value of a multi-value field, which comes as an array of the item values: a List
 * field, or a Relation, Select or media field with `multiple: true`. The empty items are dropped,
 * and an array left without any item is no value at all, rather than an empty string once
 * stringified, so the entry sorts last and falls into the “Other” group like any entry without a
 * value. Any other value is returned as is.
 * @param {any} value Value from {@link getListedEntryValue}.
 * @returns {any} Normalized value.
 */
export const normalizeMultiValue = (value) => {
  if (!Array.isArray(value)) {
    return value;
  }

  const items = value.filter((item) => !isEmptyValue(item));

  return items.length ? items : undefined;
};
