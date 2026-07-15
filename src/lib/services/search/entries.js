import { derived } from 'svelte/store';

import { appLocaleStore } from '$lib/services/app/i18n';
import { allEntries } from '$lib/services/contents';
import { getCollectionFilesByEntry } from '$lib/services/contents/collection/files';
import { getAssociatedCollections } from '$lib/services/contents/entry';
import { getEntrySummary } from '$lib/services/contents/entry/summary';
import { searchTerms } from '$lib/services/search';
import { hasMatch, normalize } from '$lib/services/search/util';

/**
 * @import { Readable } from 'svelte/store';
 * @import { Entry, EntrySearchResult, InternalLocaleCode } from '$lib/types/private';
 * @import { FieldKeyPath } from '$lib/types/public';
 * @import { NormalizedValueCache } from '$lib/services/search/util';
 */

/**
 * Scan an entry for matches against the search terms.
 * @param {object} args Arguments.
 * @param {Entry} args.entry Entry to scan.
 * @param {string} args.terms Search terms.
 * @param {NormalizedValueCache} [args.normalizedValueCache] Normalized value cache.
 * @returns {EntrySearchResult} Single search result.
 */
export const scanEntry = ({ entry, terms, normalizedValueCache = undefined }) => {
  // Count the number of matches, weighting the collection name and title
  let points = 0;
  /** @type {InternalLocaleCode | undefined} */
  let locale = undefined;
  /** @type {FieldKeyPath | undefined} */
  let keyPath = undefined;
  const collections = getAssociatedCollections(entry);

  if (collections.length) {
    collections.forEach((collection) => {
      // Check if the collection label or name matches
      if (hasMatch({ value: collection.label || collection.name, terms, normalizedValueCache })) {
        points += 10;
      }

      // Check if the file labels or names match
      points += getCollectionFilesByEntry(collection, entry).filter((file) =>
        hasMatch({ value: file.label || file.name, terms, normalizedValueCache }),
      ).length;
    });

    const [collection] = collections;
    const summary = getEntrySummary(collection, entry, { useTemplate: true, allowMarkdown: true });

    // Check if the entry summary matches
    if (hasMatch({ value: summary, terms, normalizedValueCache })) {
      points += 10;
    }
  }

  // Check if the entry content matches
  Object.entries(entry.locales).forEach(([_locale, { content }]) => {
    points += Object.entries(content).filter(([_keyPath, value]) => {
      const matched =
        (typeof value === 'string' &&
          !!value &&
          hasMatch({ value, terms, normalizedValueCache })) ||
        (typeof value === 'number' &&
          hasMatch({ value: String(value), terms, normalizedValueCache }));

      // If this is the first match, store the locale and key path
      if (matched && !locale && !keyPath) {
        locale = _locale;
        keyPath = _keyPath;
      }

      return matched;
    }).length;
  });

  return { entry, points, locale, keyPath };
};

/**
 * Search entries based on the given search terms.
 * @param {object} args Arguments.
 * @param {Entry[]} args.entries All entries to search in.
 * @param {string} args.terms Search terms.
 * @returns {EntrySearchResult[]} Search results sorted by relevance.
 */
export const searchEntries = ({ entries, terms }) => {
  terms = normalize(terms);

  if (!entries.length || !terms) {
    return [];
  }

  /** @type {NormalizedValueCache} */
  const normalizedValueCache = new Map();

  return entries
    .map((entry) => scanEntry({ entry, terms, normalizedValueCache }))
    .filter(({ points }) => points > 0)
    .sort((a, b) => b.points - a.points);
};

/**
 * Hold entry search results for the current search terms.
 * @type {Readable<EntrySearchResult[]>}
 * @todo Search relation fields.
 */
export const entrySearchResults = derived(
  // Include `appLocale.current` as a dependency because `getEntrySummary()` may return a localized
  // label
  [allEntries, searchTerms, appLocaleStore],
  ([entries, terms]) => searchEntries({ entries, terms }),
);
