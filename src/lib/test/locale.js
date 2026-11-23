import { onTestFinished, vi } from 'vitest';

/**
 * Make `toLocaleLowerCase()` follow a Turkish default locale until the test finishes, like a
 * browser that lowercases in its own locale, which turns `I` into `ı` without a dot.
 */
export const emulateTurkishLowerCase = () => {
  const { toLocaleLowerCase } = String.prototype;

  const spy = vi.spyOn(String.prototype, 'toLocaleLowerCase').mockImplementation(
    /**
     * Lowercase the string in Turkish unless another locale is given.
     * @param {Intl.LocalesArgument} [locales] Locales.
     * @returns {string} Lowercased string.
     * @this {string}
     */
    function lower(locales) {
      return toLocaleLowerCase.call(this, locales ?? 'tr');
    },
  );

  onTestFinished(() => {
    spy.mockRestore();
  });
};
