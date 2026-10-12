import { isObject } from '@sveltia/utils/object';

/**
 * Source text of the integers read from files that a `number` can’t represent exactly, keyed by the
 * number they’re read as, e.g. `12345678901234567890` for `12345678901234567000`. The value is
 * `null` if different integers are read as the same number, so neither can be told from the other.
 *
 * Such an integer is read as the closest number rather than as a `BigInt`, which the entry draft,
 * its backup and the Number field can’t handle: they copy values with `JSON.stringify()`, which
 * throws on a `BigInt`. The formatters write the source text back instead of the number, so the
 * integer is saved exactly as long as it hasn’t been edited, which would give it another value.
 * @type {Map<number, string | null>}
 */
const unsafeIntegerSources = new Map();
/**
 * Regular expression testing whether a document may hold an integer that a `number` can’t represent
 * exactly. Any such integer has more than 15 digits, as `2 ** 53` is `9007199254740992`. Testing
 * first saves parsing the document in a slower way, which is hardly ever needed.
 */
const LONG_DIGIT_RUN_REGEX = /\d{16}/;
/**
 * Regular expression matching the source text of a decimal integer in a JSON document.
 */
const JSON_INTEGER_REGEX = /^-?\d+$/;

/**
 * Check whether the given document may hold an integer that a `number` can’t represent exactly.
 * @param {string} str Document.
 * @returns {boolean} Result.
 */
export const mayHaveUnsafeInteger = (str) => LONG_DIGIT_RUN_REGEX.test(str);

/**
 * Remember the source text of an integer read as a number that is not a safe integer. The source
 * text of an integer that the number represents exactly is remembered as well, so another integer
 * read as the same number can’t be taken for it.
 * @param {number} number Number the integer is read as.
 * @param {string} source Source text of the integer.
 */
const rememberSource = (number, source) => {
  const knownSource = unsafeIntegerSources.get(number);

  unsafeIntegerSources.set(
    number,
    knownSource === undefined || knownSource === source ? source : null,
  );
};

/**
 * Convert an integer to a `number`, remembering its source text if the number is not a safe
 * integer, as it may not represent the integer exactly.
 * @param {bigint} value Integer.
 * @returns {number} Number.
 */
export const toNumber = (value) => {
  const number = Number(value);

  if (!Number.isSafeInteger(number)) {
    rememberSource(number, String(value));
  }

  return number;
};

/**
 * Replace every `BigInt` in the given parsed document with a `number` using {@link toNumber}, and
 * remember the source text of any number that is an integer but not a safe one.
 * @param {any} value Parsed document or a value in it. Arrays and plain objects are updated in
 * place.
 * @returns {any} Value without a `BigInt`.
 */
export const replaceBigInts = (value) => {
  if (typeof value === 'bigint') {
    return toNumber(value);
  }

  // A parser may read an integer that the number represents exactly as a number
  if (Number.isInteger(value) && !Number.isSafeInteger(value)) {
    rememberSource(value, String(BigInt(value)));

    return value;
  }

  if (Array.isArray(value) || isObject(value)) {
    Object.entries(value).forEach(([key, val]) => {
      /** @type {Record<string, any>} */ (value)[key] = replaceBigInts(val);
    });
  }

  return value;
};

/**
 * A `JSON.parse()` reviver that reads an integer a `number` can’t represent exactly from its source
 * text with {@link toNumber}. A browser that doesn’t give the reviver the source text reads the
 * number as usual.
 * @param {string} _key Property name.
 * @param {any} value Parsed value.
 * @param {{ source?: string }} [context] Context, which holds the source text of a primitive value.
 * @returns {any} Value.
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse#the_reviver_parameter
 */
export const reviveUnsafeInteger = (_key, value, context) => {
  const source = context?.source;

  return typeof value === 'number' &&
    !Number.isSafeInteger(value) &&
    typeof source === 'string' &&
    JSON_INTEGER_REGEX.test(source)
    ? toNumber(BigInt(source))
    : value;
};

/**
 * Get the source text of the integer read as the given value, if a `number` can’t represent the
 * integer exactly.
 * @param {any} value Value.
 * @returns {string | undefined} Source text, or `undefined` if the value is not such a number or
 * its source text is not known for sure.
 */
export const getUnsafeIntegerSource = (value) =>
  typeof value === 'number' && !Number.isSafeInteger(value)
    ? (unsafeIntegerSources.get(value) ?? undefined)
    : undefined;

/**
 * Check whether any integer that a `number` can’t represent exactly has been read, so a formatter
 * can skip looking for one.
 * @returns {boolean} Result.
 */
export const hasUnsafeIntegerSources = () => unsafeIntegerSources.size > 0;

/**
 * Copy the given value, replacing every number read from an integer that a `number` can’t represent
 * exactly with a `BigInt` of the integer, for a formatter that writes a `BigInt` as an integer.
 * @param {any} value Value to be formatted.
 * @returns {any} Copy of arrays and plain objects; any other value as is.
 */
export const restoreBigInts = (value) => {
  const source = getUnsafeIntegerSource(value);

  if (source !== undefined) {
    return BigInt(source);
  }

  if (Array.isArray(value)) {
    return value.map(restoreBigInts);
  }

  // Leave class instances, such as a `TomlDate`, as they are
  if (isObject(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    return Object.fromEntries(
      Object.entries(value).map(([key, val]) => [key, restoreBigInts(val)]),
    );
  }

  return value;
};

/**
 * Clear the source text of the integers read so far. Used in tests.
 */
export const _resetUnsafeIntegerSources = () => {
  unsafeIntegerSources.clear();
};
