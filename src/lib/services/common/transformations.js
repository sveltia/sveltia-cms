import { truncate } from '@sveltia/utils/string';
import dayjs from 'dayjs';
import dayjsCustomParseFormat from 'dayjs/plugin/customParseFormat';
import dayjsLocalizedFormat from 'dayjs/plugin/localizedFormat';
import dayjsUTC from 'dayjs/plugin/utc';

import { customStringTransformationRegistry } from '$lib/services/api/registries';
import { slugify } from '$lib/services/common/slug';
import { parseDateTimeConfig } from '$lib/services/contents/fields/date-time/config';
import { getParser, parseWithFormatFallback } from '$lib/services/contents/fields/date-time/parse';
import { getOrCreate, getOrCreateBounded } from '$lib/services/utils/cache';

/**
 * @import { StringTransformation } from '$lib/types/private';
 * @import { DateTimeField, Field, StringTransformer } from '$lib/types/public';
 */

/**
 * @typedef {object} DateTimeTransformationArgs
 * @property {string} format The date format string to use for output.
 * @property {string} [timeZone] The time zone to use (`utc` for UTC, otherwise local).
 */

/**
 * @typedef {object} DefaultTransformationArgs
 * @property {string} defaultValue The default value to return if the input value is falsy.
 */

/**
 * @typedef {object} TernaryTransformationArgs
 * @property {string} truthyValue The value to return if the input value is truthy.
 * @property {string} falsyValue The value to return if the input value is falsy.
 */

/**
 * @typedef {object} TruncateTransformationArgs
 * @property {string} max The maximum length of the string.
 * @property {string} [ellipsis] The string to append if truncation occurs.
 */

dayjs.extend(dayjsCustomParseFormat);
dayjs.extend(dayjsLocalizedFormat);
dayjs.extend(dayjsUTC);

const DATE_ONLY_REGEX = /^\d{4}-[01]\d-[0-3]\d$/;
const DATE_PART_REGEX = /T\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?Z$/;

/**
 * Names of the built-in string transformations, which can’t be used for a custom transformation.
 * `localize` is not a transformation but a flag in a slug template, e.g. `{{title | localize}}`.
 * @see https://sveltiacms.app/en/docs/string-transformations
 */
export const BUILTIN_STRING_TRANSFORMATIONS = Object.freeze([
  'date',
  'default',
  'localize',
  'lower',
  'slugify',
  'ternary',
  'truncate',
  'upper',
]);

/**
 * Regular expression matching a valid custom transformation name: letters, digits and underscores,
 * not starting with a digit.
 */
export const STRING_TRANSFORMATION_NAME_REGEX = /^[A-Za-z_]\w*$/;

/**
 * Regular expression matching a transformation that isn’t built-in, which may be a custom one, with
 * or without arguments, e.g. `reverse` or `wrap('[', ']')`.
 */
const OTHER_TRANSFORMATION_REGEX = new RegExp(
  `^(?<method>${STRING_TRANSFORMATION_NAME_REGEX.source.slice(1, -1)})(?:\\((?<args>.*)\\))?$`,
  's',
);

/**
 * Regular expression matching an argument of a transformation that isn’t built-in, along with the
 * following comma, if any. A string argument is quoted with single quotes, and like
 * {@link splitTransformations}, a quote only closes the argument before `,` or the end, so it can
 * contain an apostrophe. A numeric argument is not quoted.
 */
const OTHER_TRANSFORMATION_ARG_REGEX =
  /\s*(?:'(?<string>.*?)'|(?<number>-?\d+(?:\.\d+)?))\s*(?<separator>,|$)/sy;

const TRANSFORMATION_PARSERS = Object.entries({
  date: /^date\('(?<format>.+?)'(?:,\s*'(?<timeZone>.+?)')?\)$/,
  default: /^default\('(?<defaultValue>.+?)'\)$/,
  ternary: /^ternary\('(?<truthyValue>.*?)',\s*'(?<falsyValue>.*?)'\)$/,
  truncate: /^truncate\((?<max>\d+)(?:,\s*'(?<ellipsis>.+?)')?\)$/,
});

/**
 * Parse the arguments of a transformation that isn’t built-in, e.g. `10, '…'` for `shorten(10,
 * '…')`.
 * @param {string} string Arguments within the parentheses.
 * @returns {(string | number)[] | undefined} Parsed arguments: a string for a quoted argument and a
 * number for an unquoted one. `undefined` if any of the arguments is invalid.
 */
const parseOtherTransformationArgs = (string) => {
  /** @type {(string | number)[]} */
  const args = [];

  if (!string.trim()) {
    return args;
  }

  const regex = new RegExp(OTHER_TRANSFORMATION_ARG_REGEX);
  /** @type {string | undefined} */
  let separator;

  do {
    const groups = regex.exec(string)?.groups;

    if (!groups) {
      return undefined;
    }

    args.push(groups.string ?? Number(groups.number));
    ({ separator } = groups);
  } while (separator);

  return args;
};

/**
 * Parse a single transformation string into a structured object.
 * @param {string} transformation The transformation string.
 * @returns {StringTransformation} Parsed transformation.
 */
const parseTransformation = (transformation) => {
  // eslint-disable-next-line no-restricted-syntax
  for (const [method, regex] of TRANSFORMATION_PARSERS) {
    const entries = Object.entries(transformation.match(regex)?.groups ?? {});

    if (entries.length) {
      return {
        method,
        args: Object.fromEntries(entries.filter(([, value]) => value !== undefined)),
      };
    }
  }

  const { method, args } = transformation.match(OTHER_TRANSFORMATION_REGEX)?.groups ?? {};

  // A built-in transformation with invalid arguments, e.g. `truncate('a')`, is left unparsed, so it
  // doesn’t run with arguments it can’t use
  if (method && !BUILTIN_STRING_TRANSFORMATIONS.includes(method)) {
    if (args === undefined) {
      return { method, args: {} };
    }

    const customArgs = parseOtherTransformationArgs(args);

    if (customArgs) {
      return { method, args: {}, customArgs };
    }
  }

  return { method: transformation, args: {} };
};

/**
 * Split a string containing a value and transformations at the pipe (`|`) characters, except for
 * those within a quoted transformation argument like `default('Untitled | Draft')`. A single quote
 * only opens an argument after `(` or `,`, and only closes it before `,` or `)`, so an apostrophe
 * within an argument, as in `default('Don't')`, doesn’t throw off the parsing.
 * @param {string} string The string to be split.
 * @returns {string[]} Trimmed segments.
 */
const splitTransformations = (string) => {
  /** @type {string[]} */
  const segments = [];
  let segment = '';
  let quoted = false;

  [...string].forEach((char, index) => {
    if (char === "'") {
      if (!quoted && /[(,]\s*$/.test(string.slice(0, index))) {
        quoted = true;
      } else if (quoted && /^\s*[,)]/.test(string.slice(index + 1))) {
        quoted = false;
      }
    }

    if (char === '|' && !quoted) {
      segments.push(segment.trim());
      segment = '';
    } else {
      segment += char;
    }
  });

  segments.push(segment.trim());

  return segments;
};

/**
 * Cache of parsed placeholders, keyed by the placeholder string. Summary and slug templates are
 * applied to every entry, e.g. on every keystroke of an entry search, but only have a few
 * placeholders, which are parsed once here instead of once per entry.
 * @type {Map<string, { value: string, transformations: StringTransformation[] }>}
 */
const parsedTransformationsCache = new Map();

/**
 * Parse a string containing a value and multiple transformations separated by the pipe (`|`)
 * character. The result is cached and shared between callers, so it’s frozen.
 * @param {string} string The string containing a value and transformations.
 * @returns {{ value: string, transformations: StringTransformation[] }} Parsed value and
 * transformation entries.
 */
export const parseTransformations = (string) =>
  getOrCreateBounded(
    parsedTransformationsCache,
    string,
    () => {
      const [value, ...rawTransformations] = splitTransformations(string.trim());

      return Object.freeze({
        value,
        transformations: /** @type {StringTransformation[]} */ (
          Object.freeze(
            rawTransformations.map((tf) => {
              const { method, args, customArgs } = parseTransformation(tf);

              return Object.freeze({
                method,
                args: Object.freeze(args),
                ...(customArgs ? { customArgs: Object.freeze(customArgs) } : {}),
              });
            }),
          )
        ),
      });
    },
    500,
  );

/**
 * Transform the input value to its uppercase string representation.
 * @param {any} value The value to be transformed to uppercase.
 * @returns {string} The uppercase string representation of the input value.
 */
export const applyUpperCaseTransformation = (value) => String(value).toUpperCase();

/**
 * Transform the input value to a string and returns it in lowercase.
 * @param {any} value The value to be transformed to lowercase.
 * @returns {string} The lowercase string representation of the input value.
 */
export const applyLowerCaseTransformation = (value) => String(value).toLowerCase();

/**
 * Transform the input value to a formatted string based on the provided format and time zone
 * options. A value other than a `Date` is parsed in the field’s own `format` if it has one,
 * falling back to the default parsing if the value doesn’t match the format.
 * @param {any} value The input value to be transformed into a date string.
 * @param {DateTimeTransformationArgs} args Transformation arguments.
 * @param {DateTimeField} fieldConfig Field configuration containing date and time settings.
 * @returns {string} The formatted date string if valid, otherwise an empty string.
 */
export const applyDateTransformation = (value, { format, timeZone }, fieldConfig) => {
  const sValue = String(value);
  const { format: storedFormat, dateOnly, utc } = parseDateTimeConfig(fieldConfig);

  const useUTC =
    timeZone === 'utc' ||
    utc ||
    (dateOnly && !!sValue.match(DATE_ONLY_REGEX)) ||
    (dateOnly && !!sValue.match(DATE_PART_REGEX));

  const date =
    // A value in a format like `X` (Unix timestamp) can come as a number from the front matter
    storedFormat && !(value instanceof Date)
      ? parseWithFormatFallback({ value: sValue, format: storedFormat, parseAsUTC: useUTC })
      : getParser(useUTC)(sValue);

  if (date.isValid()) {
    return date.format(format);
  }

  return '';
};

/**
 * Return the string representation of the given value if it is truthy; otherwise, returns the
 * provided default value.
 * @param {any} value The value to evaluate for truthiness.
 * @param {DefaultTransformationArgs} args Transformation arguments.
 * @returns {string} The stringified value or the default value.
 */
export const applyDefaultTransformation = (value, { defaultValue }) =>
  value ? String(value) : defaultValue;

/**
 * Return one of two values based on the truthiness of the input value.
 * @param {any} value The value to evaluate for truthiness.
 * @param {TernaryTransformationArgs} args Transformation arguments.
 * @returns {string} Returns `truthyValue` if `value` is truthy, otherwise returns `falsyValue`.
 */
export const ternaryTransformation = (value, { truthyValue, falsyValue }) =>
  value ? truthyValue : falsyValue;

/**
 * Truncate a string to a specified maximum length and append an ellipsis if truncation occurs.
 * @param {any} value The value to be truncated.
 * @param {TruncateTransformationArgs} args Transformation arguments.
 * @returns {string} The truncated string with ellipsis if applicable.
 */
export const applyTruncateTransformation = (value, { max, ellipsis = '…' }) =>
  truncate(String(value), Number(max), { ellipsis });

/**
 * Names of the custom transformations that have failed, keyed by the function, so the error is
 * logged only once for each, rather than for every entry summary or keystroke. A different
 * function, e.g. a fixed one registered under the same name, starts over.
 * @type {WeakMap<StringTransformer, Set<string>>}
 */
const failedCustomTransformations = new WeakMap();

/**
 * Apply a custom string transformation registered with `CMS.registerStringTransformation()`. An
 * error thrown by the function, or a Promise returned by it, is logged once per function and
 * name, and the value is returned as is, so a broken transformation doesn’t break the UI.
 * @param {object} args Arguments.
 * @param {string} args.method Transformation name.
 * @param {StringTransformer} args.transform Transformation function.
 * @param {any} args.value Original value to be transformed.
 * @param {readonly (string | number)[]} [args.customArgs] Transformation arguments.
 * @param {string} [args.locale] Locale code of the entry content.
 * @returns {string} Transformed value.
 */
export const applyCustomTransformation = ({ method, transform, value, customArgs, locale }) => {
  try {
    const result = transform(value, {
      args: [...(customArgs ?? [])],
      locale: locale === '_default' ? undefined : locale,
    });

    // Check for any thenable, not only a native Promise
    if (typeof (/** @type {any} */ (result)?.then) === 'function') {
      // Avoid an unhandled rejection
      /** @type {PromiseLike<any>} */ (result).then(undefined, () => undefined);

      throw new TypeError('The function must return a string, not a Promise');
    }

    return String(result ?? '');
  } catch (ex) {
    const failedNames = getOrCreate(failedCustomTransformations, transform, () => new Set());

    if (!failedNames.has(method)) {
      failedNames.add(method);
      // eslint-disable-next-line no-console
      console.error(
        `The custom “${method}” string transformation failed. Further errors are not logged:`,
        ex,
      );
    }

    return String(value ?? '');
  }
};

/**
 * Apply a single string transformation to the value based on the specified transformation type.
 * @param {object} args Arguments.
 * @param {Field} [args.fieldConfig] Field configuration, used for date transformations.
 * @param {any} args.value Original value to be transformed.
 * @param {StringTransformation} args.transformation Transformation entry.
 * @param {string} [args.locale] BCP 47 language tag passed to the `slugify` transformation and
 * custom transformations.
 * @returns {string} Transformed value.
 * @see https://decapcms.org/docs/summary-strings/
 * @see https://sveltiacms.app/en/docs/string-transformations
 */
export const applyTransformation = ({ fieldConfig, value, transformation, locale }) => {
  const { method, args, customArgs } = transformation;

  switch (method) {
    case 'upper':
      return applyUpperCaseTransformation(value);
    case 'lower':
      return applyLowerCaseTransformation(value);
    case 'slugify':
      // Don’t fall back to a random UUID for an empty value; the transformation is used in Compute
      // fields, where a value that changes on every render causes an infinite update loop
      // @see https://github.com/sveltia/sveltia-cms/issues/946
      return slugify(String(value), { fallback: false, locale });
    case 'date':
      return applyDateTransformation(
        value,
        /** @type {DateTimeTransformationArgs} */ (args),
        /** @type {DateTimeField} */ (fieldConfig ?? {}),
      );
    case 'default':
      return applyDefaultTransformation(value, /** @type {DefaultTransformationArgs} */ (args));
    case 'ternary':
      return ternaryTransformation(value, /** @type {TernaryTransformationArgs} */ (args));
    case 'truncate':
      return applyTruncateTransformation(value, /** @type {TruncateTransformationArgs} */ (args));

    default: {
      const transform = customStringTransformationRegistry.get(method);

      if (transform) {
        return applyCustomTransformation({ method, transform, value, customArgs, locale });
      }

      return String(value);
    }
  }
};

/**
 * Apply string transformations to the value.
 * @param {object} args Arguments.
 * @param {Field} [args.fieldConfig] Field configuration.
 * @param {any} args.value Original value.
 * @param {StringTransformation[]} args.transformations Transformation entries.
 * @param {string} [args.locale] BCP 47 language tag passed to the `slugify` transformation.
 * @returns {string} Transformed value.
 */
export const applyTransformations = ({ fieldConfig, value, transformations, locale }) => {
  transformations.forEach((transformation) => {
    value = applyTransformation({ fieldConfig, value, transformation, locale });
  });

  return value;
};
