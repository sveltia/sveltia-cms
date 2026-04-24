/**
 * @typedef {Map<string, string>} NormalizedValueCache
 */

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
