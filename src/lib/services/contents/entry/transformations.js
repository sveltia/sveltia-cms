import { truncate } from '@sveltia/utils/string';
import moment from 'moment';
import { parseDateTimeConfig } from '$lib/services/contents/widgets/date-time/helper';

const dateRegex = /^date\('(?<format>.*?)'\)$/;
const defaultRegex = /^default\('?(?<defaultValue>.*?)'?\)$/;
const ternaryRegex = /^ternary\('?(?<truthyValue>.*?)'?,\s*'?(?<falsyValue>.*?)'?\)$/;
const truncateRegex = /^truncate\((?<max>\d+)(?:,\s*'?(?<ellipsis>.*?)'?)?\)$/;

/**
 * Apply a string transformation to the value.
 * @param {object} args - Arguments.
 * @param {Field} [args.fieldConfig] - Field configuration.
 * @param {string} args.value - Original value.
 * @param {string} args.transformation - Transformation, e.g `upper`, `truncate(10)`.
 * @returns {string} Transformed value.
 * @see https://decapcms.org/docs/summary-strings/
 */
export const applyTransformation = ({ fieldConfig, value, transformation }) => {
  const slugPartStr = String(value);

  if (transformation === 'upper') {
    return slugPartStr.toUpperCase();
  }

  if (transformation === 'lower') {
    return slugPartStr.toLowerCase();
  }

  const dateTransformer = transformation.match(dateRegex);

  if (dateTransformer?.groups) {
    const { format } = dateTransformer.groups;
    const { dateOnly, utc } = parseDateTimeConfig(/** @type {DateTimeField} */ (fieldConfig ?? {}));

    return (
      utc ||
      (dateOnly && !!slugPartStr?.match(/^\d{4}-[01]\d-[0-3]\d$/)) ||
      (dateOnly && !!slugPartStr.match(/T00:00(?::00)?(?:\.000)?Z$/))
        ? moment.utc(slugPartStr)
        : moment(slugPartStr)
    ).format(format);
  }

  const defaultTransformer = transformation.match(defaultRegex);

  if (defaultTransformer?.groups) {
    const { defaultValue } = defaultTransformer.groups;

    return value ? slugPartStr : defaultValue;
  }

  const ternaryTransformer = transformation.match(ternaryRegex);

  if (ternaryTransformer?.groups) {
    const { truthyValue, falsyValue } = ternaryTransformer.groups;

    return value ? truthyValue : falsyValue;
  }

  const truncateTransformer = transformation.match(truncateRegex);

  if (truncateTransformer?.groups) {
    const { max, ellipsis = '…' } = truncateTransformer.groups;

    return truncate(slugPartStr, Number(max), { ellipsis });
  }

  return slugPartStr;
};

/**
 * Apply string transformations to the value.
 * @param {object} args - Arguments.
 * @param {Field} [args.fieldConfig] - Field configuration.
 * @param {string} args.value - Original value.
 * @param {string[]} args.transformations - List of transformations.
 * @returns {string} Transformed value.
 */
export const applyTransformations = ({ fieldConfig, value, transformations }) => {
  transformations.forEach((transformation) => {
    value = applyTransformation({ fieldConfig, value, transformation });
  });

  return value;
};
