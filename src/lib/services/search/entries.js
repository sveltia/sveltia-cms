import { derived } from 'svelte/store';
import { locale as appLocale } from 'svelte-i18n';
import { allEntries } from '$lib/services/contents';
import { getCollectionFilesByEntry } from '$lib/services/contents/collection/files';
import { getAssociatedCollections } from '$lib/services/contents/entry';
import { getEntrySummary } from '$lib/services/contents/entry/summary';
import { searchTerms } from '$lib/services/search';
import { hasMatch, normalize } from '$lib/services/search/util';

/**
 * @import { Readable } from 'svelte/store';
 * @import { Entry } from '$lib/types/private';
 */

/**
 * Scan an entry for matches against the search terms.
 * @param {object} args Arguments.
 * @param {Entry} args.entry Entry to scan.
 * @param {string} args.terms Search terms.
 * @returns {number} Points scored for the entry based on matches.
 */
const scanEntry = ({ entry, terms }) => {
  // Count the number of matches, weighting the collection name and title
  let points = 0;
  const collections = getAssociatedCollections(entry);

  if (collections.length) {
    collections.forEach((collection) => {
      // Check if the collection label or name matches
      if (hasMatch({ value: collection.label || collection.name, terms })) {
        points += 10;
      }

      // Check if the file labels or names match
      points += getCollectionFilesByEntry(collection, entry).filter((file) =>
        hasMatch({ value: file.label || file.name, terms }),
      ).length;
    });

    const [collection] = collections;
    const summary = getEntrySummary(collection, entry, { useTemplate: true, allowMarkdown: true });

    // Check if the entry summary matches
    if (hasMatch({ value: summary, terms })) {
      points += 10;
    }
  }

  // Check if the entry content matches
  Object.values(entry.locales).forEach(({ content }) => {
    points += Object.values(content).filter(
      (value) =>
        (typeof value === 'string' && !!value && hasMatch({ value, terms })) ||
        (typeof value === 'number' && hasMatch({ value: String(value), terms })),
    ).length;
  });

  return points;
};

/**
 * Search entries based on the given search terms.
 * @param {object} args Arguments.
 * @param {Entry[]} args.entries All entries to search in.
 * @param {string} args.terms Search terms.
 * @returns {Entry[]} Search results sorted by relevance.
 */
const searchEntries = ({ entries, terms }) => {
  terms = normalize(terms);

  if (!entries.length || !terms) {
    return [];
  }

  return entries
    .map((entry) => ({ entry, points: scanEntry({ entry, terms }) }))
    .filter(({ points }) => points > 0)
    .sort((a, b) => b.points - a.points)
    .map(({ entry }) => entry);
};

/**
 * Hold entry search results for the current search terms.
 * @type {Readable<Entry[]>}
 * @todo Search relation fields.
 */
export const entrySearchResults = derived(
  // Include `appLocale` as a dependency because `getEntrySummary()` may return a localized label
  [allEntries, searchTerms, appLocale],
  ([entries, terms]) => searchEntries({ entries, terms }),
);
