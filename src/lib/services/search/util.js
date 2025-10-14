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
 * Check if the given label matches the search terms.
 * @param {object} args Arguments.
 * @param {string} args.value Value to check against.
 * @param {string} args.terms Search terms.
 * @returns {boolean} Result of the match check.
 */
export const hasMatch = ({ value, terms }) => normalize(value).includes(terms);
