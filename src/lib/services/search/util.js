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
export const getNormalizedValueCache = (owner) => {
  let cache = persistentCaches.get(owner);

  if (!cache) {
    cache = new Map();
    persistentCaches.set(owner, cache);
  }

  return cache;
};

/**
 * Normalize the given string for search value comparison. Since `transliterate` is slow, we only
 * apply basic normalization.
 * @param {string} value Original value.
 * @returns {string} Normalized value.
 * @see https://stackoverflow.com/q/990904
 */
export const normalize = (value) => {
  value = value.trim();

  if (!value) {
    return '';
  }

  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase();
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
