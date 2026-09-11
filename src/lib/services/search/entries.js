import { allEntries } from '$lib/services/contents';
import { getListedCollections } from '$lib/services/contents/collection/entries';
import { getCollectionFilesByEntry } from '$lib/services/contents/collection/files';
import { getEntrySummary } from '$lib/services/contents/entry/summary';
import { searchTerms } from '$lib/services/search';
import { getNormalizedValueCache, hasMatch, normalize } from '$lib/services/search/util';
import { createDerivedState } from '$lib/services/utils/state.svelte';
import { mergeUnpublishedEntries, unpublishedEntries } from '$lib/services/workflow';

/**
 * @import { Entry, EntrySearchResult, InternalLocaleCode } from '$lib/types/private';
 * @import { FieldKeyPath } from '$lib/types/public';
 * @import { NormalizedValueCache } from '$lib/services/search/util';
 */

/**
 * Scan an entry for matches against the search terms.
 * @param {object} args Arguments.
 * @param {Entry} args.entry Entry to scan.
 * @param {string} args.terms Search terms.
 * @param {NormalizedValueCache} [args.normalizedValueCache] Normalized value cache shared within
 * one search, for values that many entries have in common, such as collection labels.
 * @returns {EntrySearchResult} Single search result.
 */
export const scanEntry = ({ entry, terms, normalizedValueCache = undefined }) => {
  // Count the number of matches, weighting the collection name and title
  let points = 0;
  /** @type {InternalLocaleCode | undefined} */
  let locale = undefined;
  /** @type {FieldKeyPath | undefined} */
  let keyPath = undefined;
  const collections = getListedCollections(entry);

  // An entry that every associated collection filters out can’t be opened — the content editor
  // would show “Entry not found” — so it must not be listed as a result at all
  if (!collections.length) {
    return { entry, points: 0, locale, keyPath };
  }

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

  const summary = getEntrySummary(collections[0], entry, {
    useTemplate: true,
    allowMarkdown: true,
  });

  // The entry’s own values are normalized once and kept for later searches, as long as the entry
  // object is around
  const entryValueCache = getNormalizedValueCache(entry);

  // Check if the entry summary matches
  if (hasMatch({ value: summary, terms, normalizedValueCache: entryValueCache })) {
    points += 10;
  }

  // Check if the entry content matches
  Object.entries(entry.locales).forEach(([_locale, { content }]) => {
    points += Object.entries(content).filter(([_keyPath, value]) => {
      const matched =
        (typeof value === 'string' &&
          !!value &&
          hasMatch({ value, terms, normalizedValueCache: entryValueCache })) ||
        (typeof value === 'number' &&
          hasMatch({ value: String(value), terms, normalizedValueCache: entryValueCache }));

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
 * Hold entry search results for the current search terms. `getEntrySummary()` may return a
 * localized label, and it reads the current app locale, so the results are also recomputed when the
 * locale changes.
 * @type {{ readonly current: EntrySearchResult[] }}
 * @todo Search relation fields.
 */
export const entrySearchResults = createDerivedState(() =>
  searchEntries({
    entries: mergeUnpublishedEntries(allEntries.current, unpublishedEntries.current),
    terms: searchTerms.current,
  }),
);
