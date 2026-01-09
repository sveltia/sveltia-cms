import { truncate } from '@sveltia/utils/string';
import dayjs from 'dayjs';
import dayjsCustomParseFormat from 'dayjs/plugin/customParseFormat';
import dayjsLocalizedFormat from 'dayjs/plugin/localizedFormat';
import dayjsUTC from 'dayjs/plugin/utc';

import { parseDateTimeConfig } from '$lib/services/contents/fields/date-time/helper';

/**
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

export const DATE_TRANSFORMATION_REGEX = /^date\('(?<format>.+?)'(?:,\s*'(?<timeZone>.+?)')?\)$/;
export const DEFAULT_TRANSFORMATION_REGEX = /^default\('(?<defaultValue>.+?)'\)$/;
export const TERNARY_TRANSFORMATION_REGEX =
  /^ternary\('(?<truthyValue>.*?)',\s*'(?<falsyValue>.*?)'\)$/;
export const TRUNCATE_TRANSFORMATION_REGEX = /^truncate\((?<max>\d+)(?:,\s*'(?<ellipsis>.+?)')?\)$/;

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
    (dateOnly && !!sValue.match(/^\d{4}-[01]\d-[0-3]\d$/)) ||
    (dateOnly && !!sValue.match(/T\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?Z$/));

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
 * @param {string} args.transformation Transformation, e.g `upper`, `truncate(10)`.
 * @returns {string} Transformed value.
 * @see https://decapcms.org/docs/summary-strings/
 * @see https://sveltiacms.app/en/docs/string-transformations
 */
export const applyTransformation = ({ fieldConfig, value, transformation }) => {
  if (transformation === 'upper') {
    return applyUpperCaseTransformation(value);
  }

  if (transformation === 'lower') {
    return applyLowerCaseTransformation(value);
  }

  const dateTransformer = transformation.match(DATE_TRANSFORMATION_REGEX);

  if (dateTransformer?.groups) {
    return applyDateTransformation(
      value,
      /** @type {DateTimeTransformationArgs} */ (dateTransformer.groups),
      /** @type {DateTimeField} */ (fieldConfig ?? {}),
    );
  }

  const defaultTransformer = transformation.match(DEFAULT_TRANSFORMATION_REGEX);

  if (defaultTransformer?.groups) {
    return applyDefaultTransformation(
      value,
      /** @type {DefaultTransformationArgs} */ (defaultTransformer.groups),
    );
  }

  const ternaryTransformer = transformation.match(TERNARY_TRANSFORMATION_REGEX);

  if (ternaryTransformer?.groups) {
    return ternaryTransformation(
      value,
      /** @type {TernaryTransformationArgs} */ (ternaryTransformer.groups),
    );
  }

  const truncateTransformer = transformation.match(TRUNCATE_TRANSFORMATION_REGEX);

  if (truncateTransformer?.groups) {
    return applyTruncateTransformation(
      value,
      /** @type {TruncateTransformationArgs} */ (truncateTransformer.groups),
    );
  }

  return String(value);
};

/**
 * Apply string transformations to the value.
 * @param {object} args Arguments.
 * @param {Field} [args.fieldConfig] Field configuration.
 * @param {any} args.value Original value.
 * @param {string[]} args.transformations List of transformations.
 * @returns {string} Transformed value.
 */
export const applyTransformations = ({ fieldConfig, value, transformations }) => {
  transformations.forEach((transformation) => {
    value = applyTransformation({ fieldConfig, value, transformation });
  });

  return value;
};
