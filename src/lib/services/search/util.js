import { getOrCreate } from '$lib/services/utils/cache';

/**
 * @typedef {Map<string, string>} NormalizedValueCache
 */

/**
 * Normalized value caches that outlive a single search, keyed by the object the values belong to,
 * typically an entry. Normalizing every field of every entry is what a search mostly spends its
 * time on, and the values rarely change between two searches, so the work is kept for as long as
 * the object is around; a saved or reloaded entry is a new object, so its cache starts over.
 * @type {WeakMap<object, NormalizedValueCache>}
 */
const persistentCaches = new WeakMap();

/**
 * Get the normalized value cache for the given object, creating it on first use.
 * @param {object} owner Object the values belong to.
 * @returns {NormalizedValueCache} Cache.
 */
export const getNormalizedValueCache = (owner) =>
  getOrCreate(persistentCaches, owner, () => new Map());

/**
 * Match the combining marks that follow a letter of a script where they are accents or optional
 * vowel points a query can leave out: Latin, Greek, Cyrillic, Hebrew and Arabic. Elsewhere a mark
 * is part of the spelling — Japanese kana voicing marks (`ビ` vs `ヒ`), Devanagari vowel signs,
 * Thai tone marks — so stripping it would make unrelated words match. The same goes for the breve
 * of the Cyrillic `й` and `ў`, which are letters of their own, unlike `ё`, commonly written `е`.
 */
const ACCENT_REGEX = new RegExp(
  `(?<=[${['Latin', 'Greek', 'Hebrew', 'Arabic']
    .map((script) => `\\p{Script=${script}}`)
    .join('')}]\\p{M}*)\\p{M}|(?<=\\p{Script=Cyrillic}\\p{M}*)[\\p{M}--[\\u0306]]`,
  'gv',
);

/**
 * Match a string made of ASCII characters only.
 */
// eslint-disable-next-line no-control-regex
const ASCII_REGEX = /^[\x00-\x7F]*$/;

/**
 * Normalize the given string for search value comparison: fold accents like `é` to `e` and
 * lowercase it. Since `transliterate` is slow, we only apply basic normalization. The accents are
 * stripped from the decomposed (NFD) string, then the result is composed (NFC) again, so that a
 * Hangul syllable like `학` isn’t left split into its letters, where `하` would match it.
 * @param {string} value Original value.
 * @returns {string} Normalized value.
 * @see https://stackoverflow.com/q/990904
 */
export const normalize = (value) => {
  value = value.trim();

  if (!value) {
    return '';
  }

  // ASCII text has nothing to decompose or strip, so it only has to be lowercased, which saves most
  // of the work for the bulk of the content of many sites
  if (ASCII_REGEX.test(value)) {
    return value.toLocaleLowerCase();
  }

  return value.normalize('NFD').replace(ACCENT_REGEX, '').toLocaleLowerCase().normalize('NFC');
};

/**
 * Get a normalized value, using the provided per-search cache when available.
 * @param {string} value Original value.
 * @param {NormalizedValueCache} [normalizedValueCache] Normalized value cache.
 * @returns {string} Normalized value.
 */
const getNormalizedValue = (value, normalizedValueCache = undefined) => {
  if (!normalizedValueCache) {
    return normalize(value);
  }

  const cachedValue = normalizedValueCache.get(value);

  if (cachedValue !== undefined) {
    return cachedValue;
  }

  const normalizedValue = normalize(value);

  normalizedValueCache.set(value, normalizedValue);

  return normalizedValue;
};

/**
 * Check if the given label matches the search terms.
 * @param {object} args Arguments.
 * @param {string} args.value Value to check against.
 * @param {string} args.terms Search terms.
 * @param {NormalizedValueCache} [args.normalizedValueCache] Normalized value cache.
 * @returns {boolean} Result of the match check.
 */
export const hasMatch = ({ value, terms, normalizedValueCache = undefined }) =>
  getNormalizedValue(value, normalizedValueCache).includes(terms);

/**
 * Split the search terms into normalized, unique, whitespace-separated tokens, so that a query like
 * “annual report cover” can match a file named `annual-report-cover-photo.png`, where the words are
 * present but not separated by spaces.
 * @param {string} terms Search terms.
 * @returns {string[]} Tokens. Empty if the terms are blank.
 */
export const tokenize = (terms) => [...new Set(normalize(terms).split(/\s+/).filter(Boolean))];

/**
 * Check if the value contains every one of the given tokens, in any order.
 * @param {object} args Arguments.
 * @param {string} args.value Value to check against.
 * @param {string[]} args.tokens Search tokens from {@link tokenize}. An empty list matches any
 * value, so callers should bail out early when the search terms are blank.
 * @param {NormalizedValueCache} [args.normalizedValueCache] Normalized value cache.
 * @returns {boolean} Result of the match check.
 */
export const hasAllMatches = ({ value, tokens, normalizedValueCache = undefined }) => {
  const normalizedValue = getNormalizedValue(value, normalizedValueCache);

  return tokens.every((token) => normalizedValue.includes(token));
};
