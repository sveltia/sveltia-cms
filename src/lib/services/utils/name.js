/**
 * Splits text into the characters a reader sees, keeping an emoji or a letter with its combining
 * marks whole.
 */
const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
/**
 * A letter or a digit, which an initial has to be.
 */
const LETTER_REGEX = /[\p{L}\p{N}]/u;
/**
 * Chinese, Japanese and Korean, whose names aren’t abbreviated to initials: the first character of
 * the family name stands for the person instead, as an avatar commonly shows.
 */
const CJK_REGEX = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

/**
 * Get the first letter or digit of a word, whole.
 * @param {string} word Word, which has one.
 * @returns {string} Letter.
 */
const getFirstLetter = (word) =>
  /** @type {Intl.SegmentData} */ (
    [...graphemeSegmenter.segment(word)].find(({ segment }) => LETTER_REGEX.test(segment))
  ).segment;

/**
 * Get the initials of a name to show in place of an avatar, e.g. `AL` for Ada Lovelace, or `山` for
 * 山田太郎.
 * @param {string} name Name.
 * @param {string} [fallback] Another name to take them from if the name has no letters, e.g. one
 * made of emoji, such as the username.
 * @returns {string} Initials, at most two, or an empty string.
 */
export const getInitials = (name, fallback = '') => {
  // Only words with a letter, so each one has an initial
  const words = name
    .trim()
    .split(/\s+/)
    .filter((word) => LETTER_REGEX.test(word));

  if (!words.length) {
    return fallback ? getInitials(fallback) : '';
  }

  if (CJK_REGEX.test(getFirstLetter(words[0]))) {
    return getFirstLetter(words[0]);
  }

  return words.slice(0, 2).map(getFirstLetter).join('').toLocaleUpperCase();
};
