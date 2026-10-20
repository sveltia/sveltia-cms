import { isObject } from '@sveltia/utils/object';
import { TomlDate } from 'smol-toml';

import {
  getFloatText,
  isFloatSource,
  joinKeyPath,
  mayHaveWholeNumberFloat,
  rememberValueSources,
  restoreValueSources,
} from '$lib/services/contents/file/value-sources';

/**
 * @import { ValueSource, ValueSourceMap } from '$lib/types/private';
 */

// The source text of the TOML values that the parsed content holds in another type is remembered
// in `valueSources`, like that of the values in a JSON or YAML file. A native date or time, e.g.
// `2024-01-01T10:00:00Z`, `1979-05-27` or `12:30:00`, is held as a string, e.g.
// `2024-01-01T10:00:00.000Z`, like a date in a JSON or YAML file, as the entry draft, its backup
// and the fields handle strings. Writing it back as it was read means saving an entry neither turns
// a date into a string nor changes how it’s written, e.g. by adding milliseconds or dropping
// microseconds. A float that is a whole number, e.g. `10.0`, is held as the same `number` as an
// integer, and is written back as a float rather than as an integer.

/**
 * Regular expression matching the text of a TOML date, time or date-time, with or without an
 * offset. TOML 1.1 allows leaving out the seconds.
 * @see https://toml.io/en/v1.0.0#offset-date-time
 */
const TOML_DATE_TIME_REGEX =
  /(?<![\w.:+-])(?:\d{4}-\d{2}-\d{2}(?:[Tt ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:[Zz]|[+-]\d{2}:\d{2})?)?|\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)(?![\w.:+-])/g;

/**
 * Regular expression matching the text of a TOML integer or float other than an infinity or a NaN.
 * A number in a date, a time, a bare key or a string counts as well.
 * @see https://toml.io/en/v1.0.0#integer
 * @see https://toml.io/en/v1.0.0#float
 */
const TOML_NUMBER_REGEX =
  /(?<![\w.:+-])[-+]?(?:0x[\da-fA-F_]+|0o[0-7_]+|0b[01_]+|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][-+]?\d[\d_]*)?)(?![\w.:+-])/g;

/**
 * Regular expression matching a TOML string, including a multiline one, or a comment, which can
 * hold text looking like a number.
 * @see https://toml.io/en/v1.0.0#string
 */
const TOML_STRING_OR_COMMENT_REGEX =
  /"""[\s\S]*?"""(?!")|'''[\s\S]*?'''(?!')|"(?:[^"\\\n]|\\.)*"|'[^'\n]*'|#[^\n]*/g;

/**
 * Regular expression matching the text of a decimal TOML float, other than an infinity or a NaN.
 */
const TOML_FLOAT_REGEX = /^[-+]?\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][-+]?\d[\d_]*)?$/;

/**
 * A TOML date written as the given source text, which tells more than the date itself: how the
 * date and the time are delimited and the fractional seconds beyond milliseconds.
 */
class SourcedTomlDate extends TomlDate {
  /** @type {string} */
  #source;

  /**
   * Create a date.
   * @param {string} value Date as it’s held in the parsed content.
   * @param {string} source Source text.
   */
  constructor(value, source) {
    super(value);
    this.#source = source;
  }

  /**
   * Get the source text, which the TOML formatter writes.
   * @returns {string} Source text.
   */
  toISOString() {
    return this.#source;
  }
}

/**
 * Create a TOML float that is a whole number, written as the given source text. The TOML formatter
 * writes a number that is an integer as an integer, but it writes a date as what `toISOString()`
 * returns, so the float is handed over as a date.
 * @param {number} value Number as it’s held in the parsed content.
 * @param {string} source Source text. Only a float representing the value is written as it is.
 * @returns {Date} Float.
 */
const createSourcedTomlFloat = (value, source) => {
  const text = isFloatSource(source, value, TOML_FLOAT_REGEX) ? source : getFloatText(value);

  return Object.assign(new Date(0), {
    /**
     * Get the source text, which the TOML formatter writes.
     * @returns {string} Source text.
     */
    toISOString: () => text,
  });
};

/**
 * Find the source text of each float in a TOML document that is a whole number, keyed by the number
 * the parsed content holds it as. Such a float can’t be told from an integer read as the same
 * number, so a number that is also written as an integer is left out. A float written in different
 * ways, e.g. `10.0` and `1e1`, is mapped to `null`. Strings and comments are left out, so e.g. a
 * title like `"Top 10"` doesn’t count as an integer.
 * @param {string} str TOML document.
 * @returns {Map<number, string | null>} Source text keyed by number.
 */
const findWholeNumberFloatSources = (str) => {
  /** @type {Map<number, string | null>} */
  const sources = new Map();
  /** @type {Set<number>} */
  const integers = new Set();

  str
    .replace(TOML_STRING_OR_COMMENT_REGEX, ' ')
    .match(TOML_NUMBER_REGEX)
    ?.forEach((source) => {
      const isFloat = !/^[-+]?0[xob]/.test(source) && /[.eE]/.test(source);
      const value = Number(source.replaceAll('_', ''));

      if (!isFloat) {
        integers.add(value);
      } else if (Number.isInteger(value)) {
        const knownSource = sources.get(value);

        sources.set(value, knownSource === undefined || knownSource === source ? source : null);
      }
    });

  integers.forEach((value) => {
    sources.delete(value);
  });

  return sources;
};

/**
 * Find the source text of each date, time and date-time in a TOML document, keyed by the string
 * the parsed content holds it as. Text that reads as the same value but is written in another way,
 * e.g. `2024-01-01T10:00:00Z` and `2024-01-01T10:00:00.000Z`, can’t be told apart, so such a value
 * is mapped to `null`. Text in a string or a comment counts as well, which only risks the same.
 * @param {string} str TOML document.
 * @returns {Map<string, string | null>} Source text keyed by value.
 */
const findDateSources = (str) => {
  /** @type {Map<string, string | null>} */
  const sources = new Map();

  str.match(TOML_DATE_TIME_REGEX)?.forEach((source) => {
    const date = new TomlDate(source);

    if (date.isValid()) {
      const value = date.toISOString();
      const knownSource = sources.get(value);

      sources.set(value, knownSource === undefined || knownSource === source ? source : null);
    }
  });

  return sources;
};

/**
 * Collect the source text of the native dates and the floats that are whole numbers in the given
 * parsed TOML document.
 * @param {string} str TOML document.
 * @param {any} parsed Document parsed by the TOML library, which holds a native date as a
 * `TomlDate`.
 * @returns {ValueSourceMap} Source map. Empty if the document has no such value.
 */
const collectSources = (str, parsed) => {
  /** @type {ValueSourceMap} */
  const sourceMap = {};
  /** @type {Map<string, string | null> | undefined} */
  let dateSources;
  /** @type {Map<number, string | null> | undefined} */
  let floatSources;

  /**
   * Add the source text of the dates and floats in the given value to the map.
   * @param {any} value Value.
   * @param {string} keyPath Key path of the value.
   */
  const collect = (value, keyPath) => {
    if (value instanceof TomlDate) {
      const iso = value.toISOString();

      dateSources ??= findDateSources(str);

      // A date whose source text can’t be told is still written as a native date
      sourceMap[keyPath] = { value: iso, source: dateSources.get(iso) ?? iso };
    } else if (Number.isInteger(value)) {
      floatSources ??= mayHaveWholeNumberFloat(str) ? findWholeNumberFloatSources(str) : new Map();

      // A float written in different ways is still written as a float
      if (floatSources.has(value)) {
        sourceMap[keyPath] = { value, source: floatSources.get(value) ?? getFloatText(value) };
      }
    } else if (Array.isArray(value) || isObject(value)) {
      Object.entries(value).forEach(([key, val]) => {
        collect(val, joinKeyPath(keyPath, key));
      });
    }
  };

  collect(parsed, '');

  return sourceMap;
};

/**
 * Remember the source text of the TOML values in the given file that the parsed content holds in
 * another type or can’t tell apart from others, if there are any.
 * @param {object} args Arguments.
 * @param {string} args.path File path.
 * @param {string} args.str TOML document, which is the front matter for a Markdown file.
 * @param {any} args.parsed Document parsed by the TOML library.
 */
export const rememberTomlValueSources = ({ path, str, parsed }) => {
  rememberValueSources(path, collectSources(str, parsed));
};

/**
 * Check whether the given date to be saved is the one read from a TOML file. A Date & Time field
 * gives a native date, while any other field gives the string the parsed content holds.
 * @param {any} value Value to be saved.
 * @param {any} parsedValue Value in the parsed content.
 * @returns {boolean} Result.
 */
const isUnchanged = (value, parsedValue) =>
  value === parsedValue || (value instanceof TomlDate && value.toISOString() === parsedValue);

/**
 * Replace a value to be saved as a TOML document with one that the TOML formatter writes as its
 * source text, if it hasn’t changed since it was read from the file.
 * @param {any} value Value to be saved.
 * @param {ValueSource} valueSource Value read from the file at the same key path.
 * @returns {SourcedTomlDate | Date | undefined} Replacement, or `undefined` if the value has
 * changed.
 */
const replaceUnchangedTomlValue = (value, { value: parsedValue, source }) => {
  if (typeof parsedValue === 'number') {
    return value === parsedValue ? createSourcedTomlFloat(parsedValue, source) : undefined;
  }

  return isUnchanged(value, parsedValue) ? new SourcedTomlDate(parsedValue, source) : undefined;
};

/**
 * Copy the given content to be saved as a TOML document, replacing every value that hasn’t changed
 * since it was read from the file with one that the TOML formatter writes as its source text.
 * @param {any} content Content.
 * @param {ValueSourceMap} sourceMap Source map of the file.
 * @returns {any} Copy of the content.
 */
export const restoreTomlValueSources = (content, sourceMap) =>
  restoreValueSources(content, sourceMap, replaceUnchangedTomlValue);
