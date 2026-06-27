import { truncate } from '@sveltia/utils/string';
import dayjs from 'dayjs';
import dayjsCustomParseFormat from 'dayjs/plugin/customParseFormat';
import dayjsLocalizedFormat from 'dayjs/plugin/localizedFormat';
import dayjsUTC from 'dayjs/plugin/utc';

import { slugify } from '$lib/services/common/slug';
import { parseDateTimeConfig } from '$lib/services/contents/fields/date-time/config';

/**
 * @import { StringTransformation } from '$lib/types/private';
 * @import { DateTimeField, Field } from '$lib/types/public';
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

const TRANSFORMATION_SPLIT_REGEX = /\s*\|\s*/;
const DATE_ONLY_REGEX = /^\d{4}-[01]\d-[0-3]\d$/;
const DATE_PART_REGEX = /T\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?Z$/;

const TRANSFORMATION_PARSERS = Object.entries({
  date: /^date\('(?<format>.+?)'(?:,\s*'(?<timeZone>.+?)')?\)$/,
  default: /^default\('(?<defaultValue>.+?)'\)$/,
  ternary: /^ternary\('(?<truthyValue>.*?)',\s*'(?<falsyValue>.*?)'\)$/,
  truncate: /^truncate\((?<max>\d+)(?:,\s*'(?<ellipsis>.+?)')?\)$/,
});

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

  return { method: transformation, args: {} };
};

/**
 * Parse a string containing a value and multiple transformations separated by the pipe (`|`)
 * character.
 * @param {string} string The string containing a value and transformations.
 * @returns {{ value: string, transformations: StringTransformation[] }} Parsed value and
 * transformation entries.
 */
export const parseTransformations = (string) => {
  const [value, ...rawTransformations] = string.trim().split(TRANSFORMATION_SPLIT_REGEX);

  return {
    value,
    transformations: rawTransformations.map((tf) => parseTransformation(tf)),
  };
};

/**
 * Transform the input value to its uppercase string representation.
 * @internal
 * @param {any} value The value to be transformed to uppercase.
 * @returns {string} The uppercase string representation of the input value.
 */
export const applyUpperCaseTransformation = (value) => String(value).toUpperCase();

/**
 * Transform the input value to a string and returns it in lowercase.
 * @internal
 * @param {any} value The value to be transformed to lowercase.
 * @returns {string} The lowercase string representation of the input value.
 */
export const applyLowerCaseTransformation = (value) => String(value).toLowerCase();

/**
 * Transform the input value to a formatted string based on the provided format and time zone
 * options.
 * @internal
 * @param {any} value The input value to be transformed into a date string.
 * @param {DateTimeTransformationArgs} args Transformation arguments.
 * @param {DateTimeField} fieldConfig Field configuration containing date and time settings.
 * @returns {string} The formatted date string if valid, otherwise an empty string.
 */
export const applyDateTransformation = (value, { format, timeZone }, fieldConfig) => {
  const sValue = String(value);
  const { dateOnly, utc } = parseDateTimeConfig(fieldConfig);

  const useUTC =
    timeZone === 'utc' ||
    utc ||
    (dateOnly && !!sValue.match(DATE_ONLY_REGEX)) ||
    (dateOnly && !!sValue.match(DATE_PART_REGEX));

  const date = (useUTC ? dayjs.utc : dayjs)(sValue);

  if (date.isValid()) {
    return date.format(format);
  }

  return '';
};

/**
 * Return the string representation of the given value if it is truthy; otherwise, returns the
 * provided default value.
 * @internal
 * @param {any} value The value to evaluate for truthiness.
 * @param {DefaultTransformationArgs} args Transformation arguments.
 * @returns {string} The stringified value or the default value.
 */
export const applyDefaultTransformation = (value, { defaultValue }) =>
  value ? String(value) : defaultValue;

/**
 * Return one of two values based on the truthiness of the input value.
 * @internal
 * @param {any} value The value to evaluate for truthiness.
 * @param {TernaryTransformationArgs} args Transformation arguments.
 * @returns {string} Returns `truthyValue` if `value` is truthy, otherwise returns `falsyValue`.
 */
export const ternaryTransformation = (value, { truthyValue, falsyValue }) =>
  value ? truthyValue : falsyValue;

/**
 * Truncate a string to a specified maximum length and append an ellipsis if truncation occurs.
 * @internal
 * @param {any} value The value to be truncated.
 * @param {TruncateTransformationArgs} args Transformation arguments.
 * @returns {string} The truncated string with ellipsis if applicable.
 */
export const applyTruncateTransformation = (value, { max, ellipsis = '…' }) =>
  truncate(String(value), Number(max), { ellipsis });

/**
 * Apply a single string transformation to the value based on the specified transformation type.
 * @internal
 * @param {object} args Arguments.
 * @param {Field} [args.fieldConfig] Field configuration, used for date transformations.
 * @param {any} args.value Original value to be transformed.
 * @param {StringTransformation} args.transformation Transformation entry.
 * @param {string} [args.locale] BCP 47 language tag passed to the `slugify` transformation.
 * @returns {string} Transformed value.
 * @see https://decapcms.org/docs/summary-strings/
 * @see https://sveltiacms.app/en/docs/string-transformations
 */
export const applyTransformation = ({ fieldConfig, value, transformation, locale }) => {
  const { method, args } = transformation;

  switch (method) {
    case 'upper':
      return applyUpperCaseTransformation(value);
    case 'lower':
      return applyLowerCaseTransformation(value);
    case 'slugify':
      return slugify(String(value), { locale });
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
    default:
      return String(value);
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
