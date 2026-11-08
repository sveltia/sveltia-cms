import { createLazyModule } from '$lib/services/api/lazy-module';
import { loadModule } from '$lib/services/app/dependencies';

/**
 * @typedef {(string: string, options?: { locale?: string }) => string} TransliterateFunction
 */

/**
 * Regular expression to match the combining marks a decomposed string has for its accents.
 */
const COMBINING_MARKS_REGEX = /\p{M}/gu;

/**
 * Loader for the transliterate library. Only the `clean_accents` slug option uses it, so it’s kept
 * out of the main bundle and fetched from the CDN.
 * @see https://www.npmjs.com/package/@sindresorhus/transliterate
 */
const transliterator = createLazyModule({
  /**
   * Fetch the library.
   * @returns {Promise<TransliterateFunction>} The `transliterate` function.
   */
  loader: async () => (await loadModule('@sindresorhus/transliterate', 'index.js')).default,
  notLoadedMessage: 'The transliterate library is not loaded yet.',
});

/**
 * Load the transliterate library. It’s loaded with the configuration that enables the
 * `clean_accents` slug option, as slugs are made synchronously. Calling this again does nothing
 * once it has loaded. A failure is logged rather than thrown, and {@link transliterateString} then
 * falls back to stripping accents.
 * @returns {Promise<void>} Promise that resolves once the library has been loaded or failed.
 */
export const loadTransliterator = async () => {
  try {
    await transliterator.load();
  } catch (ex) {
    // eslint-disable-next-line no-console
    console.error('Failed to load the transliterate library', ex);
  }
};

/**
 * Transliterate the given string to ASCII. The library takes a BCP 47 tag and picks the rules for
 * its language, e.g. `tr` for `tr-TR`, and `nb` for `no`, while ignoring a locale it has no rules
 * for. An underscore, as in `pt_BR`, is turned into a hyphen it understands. If the library failed
 * to load, the accents are only stripped from the letters, so `é` becomes `e` but `ß` is kept.
 * @param {string} string String to be transliterated.
 * @param {string} [locale] Locale code, e.g. `de` or `pt_BR`.
 * @returns {string} Transliterated string.
 */
export const transliterateString = (string, locale) => {
  const decomposed = string.normalize('NFD');

  return transliterator.loaded.current
    ? transliterator.get()(decomposed, { locale: locale?.replaceAll('_', '-') })
    : decomposed.replaceAll(COMBINING_MARKS_REGEX, '');
};

/**
 * Forget the loaded library. Used in tests.
 */
export const _resetTransliterator = transliterator.reset;
