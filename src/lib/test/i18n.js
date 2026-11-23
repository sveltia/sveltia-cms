import { vi } from 'vitest';

/**
 * Build a translation function that looks up the message of the given key and fills in the
 * `{name}` placeholders with the values, or returns the key itself for an unknown message.
 * @param {Record<string, string>} strings Messages by key. The object is read on every call, so a
 * test can change a message.
 * @returns {(key: string, options?: { values?: Record<string, any> }) => string} Function.
 */
export const createTranslator = (strings) => (key, options) => {
  let message = strings[key] || key;

  if (options?.values) {
    Object.entries(options.values).forEach(([k, v]) => {
      message = message.replace(`{${k}}`, v);
    });
  }

  return message;
};

/**
 * Translation function that spells out the message key, followed by the values as JSON, if any,
 * e.g. `branch_not_found:{"repo":"repo"}`.
 * @param {string} key Message key.
 * @param {{ values?: Record<string, any> }} [options] Options.
 * @returns {string} Message.
 */
const translateWithValues = (key, options) =>
  options?.values ? `${key}:${JSON.stringify(options.values)}` : key;

/**
 * Build a mock of the `@sveltia/i18n` module for a unit test, which doesn’t load any messages.
 * Return it from the factory of a `vi.mock('@sveltia/i18n')` call, which imports this module
 * dynamically, as the call is hoisted above the imports.
 * @param {object} [options] Options.
 * @param {(key: string, options?: any) => string} [options.translate] Translation function, which
 * `_` is a mock of. Defaults to one that returns the message key, or one of the below.
 * @param {Record<string, string>} [options.strings] Messages by key: the default translation
 * function looks up the message, filling in the values, as {@link createTranslator} does.
 * @param {boolean} [options.values] Whether the default translation function spells out the
 * values after the key, e.g. `branch_not_found:{"repo":"repo"}`.
 * @param {string} [options.locale] App locale. If given, the mock exports a `locale` with the
 * `current` value and a mock `set` function.
 * @param {Record<string, any>} [options.exports] Any other export, e.g. `dictionary`.
 * @returns {Record<string, any>} Module mock.
 */
export const createI18nMock = ({
  translate = undefined,
  strings = undefined,
  values = false,
  locale = undefined,
  exports = {},
} = {}) => ({
  _: vi.fn(
    translate ??
      (strings ? createTranslator(strings) : undefined) ??
      (values ? translateWithValues : (/** @type {string} */ key) => key),
  ),
  ...(locale === undefined ? {} : { locale: { current: locale, set: vi.fn() } }),
  ...exports,
});
