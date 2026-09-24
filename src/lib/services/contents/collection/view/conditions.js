import { getDateTimeParts } from '@sveltia/utils/datetime';

import {
  DATE_TIME_FIELDS,
  TEMPLATE_TAG_REGEX,
  TEMPLATE_TAG_REPLACE_REGEX,
} from '$lib/services/common/template/constants';
import { COMPARISON_OPERATORS, matchesFilter } from '$lib/services/common/view';
import { getDate, isValidDate } from '$lib/services/contents/fields/date-time/helpers';
import { isValueEmpty } from '$lib/services/utils/object';
import { getRegex } from '$lib/services/utils/regex';

/**
 * @import { ViewConditions } from '$lib/services/common/view';
 * @import { DateTimeField, ViewComparisonValue } from '$lib/types/public';
 */

/**
 * A comparison value with its template tags resolved. The `{{now}}` tag resolves to a `Date` rather
 * than a string, so that it can be compared with a DateTime field value regardless of the field’s
 * `format`, which the parser would otherwise be applied to.
 * @typedef {ViewComparisonValue | Date} ResolvedValue
 */

/**
 * A comparison operator with its resolved target value.
 * @typedef {object} PreparedComparison
 * @property {(typeof COMPARISON_OPERATORS)[number]} operator Operator.
 * @property {any} target Target value. An array for `in` and `not_in`, a `Date` or `undefined` for
 * an ordinal comparison on a DateTime field, and a {@link ResolvedValue} otherwise.
 */

/**
 * Conditions ready to be tested against a series of entries, with the template tags resolved and
 * the pattern compiled once.
 * @typedef {object} PreparedConditions
 * @property {ResolvedValue | RegExp | undefined} pattern Pattern with its template tags resolved.
 * @property {RegExp | undefined} regex Compiled pattern, if it’s a regular expression.
 * @property {PreparedComparison[]} comparisons Comparisons to be satisfied.
 * @property {DateTimeField | undefined} dateFieldConfig DateTime field configuration, if the
 * target field is a DateTime field.
 */

/**
 * Strict `YYYY-MM-DD` date, which `new Date()` would parse as UTC midnight rather than local.
 */
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Check whether a comparison value holds a template tag, so that the conditions depend on the
 * current time.
 * @param {any} value Value from the configuration, or an array of them.
 * @returns {boolean} Whether a string with a tag is found.
 */
const hasTemplateTag = (value) =>
  Array.isArray(value)
    ? value.some(hasTemplateTag)
    : typeof value === 'string' && TEMPLATE_TAG_REGEX.test(value);

/**
 * Check whether the conditions of a view filter or group depend on the current time, which is the
 * case when the pattern or a comparison value holds a template tag like `{{today}}`. The entry list
 * then has to be recomputed as time goes by, not only when the view or the entries change.
 * @param {ViewConditions | null | undefined} conditions Conditions.
 * @returns {boolean} Result.
 */
export const usesCurrentTime = (conditions) =>
  !!conditions &&
  (hasTemplateTag(conditions.pattern) ||
    COMPARISON_OPERATORS.some((operator) => hasTemplateTag(conditions[operator])));

/**
 * Resolve the template tags in a comparison value. A string can hold `{{now}}`, `{{today}}` and
 * the parts of the current date and time, like `{{year}}`, all in the user’s local time zone.
 * @param {any} value Value from the configuration.
 * @param {Date} [now] Current date and time.
 * @returns {any} Value with the tags resolved. A string that is nothing but `{{now}}` resolves to
 * a `Date`, so that it stands for the exact instant however the target field is formatted; within
 * a longer string, it’s written in the `YYYY-MM-DDTHH:mm:ss` format. `{{today}}` resolves to the
 * `YYYY-MM-DD` format, which is what a date-only field stores, so the two sides of a comparison are
 * parsed the same way. Anything but a string is returned as is, and so is an unknown tag.
 */
export const resolveComparisonValue = (value, now = new Date()) => {
  if (typeof value !== 'string' || !TEMPLATE_TAG_REGEX.test(value)) {
    return value;
  }

  if (value === '{{now}}') {
    return now;
  }

  const { year, month, day, hour, minute, second } = getDateTimeParts({ date: now });
  const today = `${year}-${month}-${day}`;
  /** @type {Record<string, string>} */
  const parts = { year, month, day, hour, minute, second };

  return value.replace(TEMPLATE_TAG_REPLACE_REGEX, (match, /** @type {string} */ tag) => {
    if (tag === 'now') {
      return `${today}T${hour}:${minute}:${second}`;
    }

    if (tag === 'today') {
      return today;
    }

    if (DATE_TIME_FIELDS.includes(tag)) {
      return parts[tag];
    }

    return match;
  });
};

/**
 * Parse a value as a date the way the target field’s value is parsed.
 * @param {any} value Field value or resolved comparison value.
 * @param {DateTimeField | undefined} dateFieldConfig DateTime field configuration, if any.
 * @returns {Date | undefined} Date, or `undefined` if the value can’t be parsed.
 */
const toDate = (value, dateFieldConfig) => {
  if (value instanceof Date) {
    return isValidDate(value) ? value : undefined;
  }

  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (dateFieldConfig) {
    return getDate(String(value), dateFieldConfig);
  }

  // A date-only value, such as the `{{today}}` tag compared with an entry’s `commit_date`, stands
  // for the local day, whereas `new Date()` would parse it as UTC midnight and shift the day
  // boundary by the user’s UTC offset
  if (DATE_ONLY_REGEX.test(String(value))) {
    const [year, month, day] = String(value).split('-').map(Number);

    return new Date(year, month - 1, day);
  }

  const date = new Date(value);

  return isValidDate(date) ? date : undefined;
};

/**
 * Check whether a value can be compared as a number.
 * @param {any} value Value to check.
 * @returns {boolean} Whether the value is a finite number or a string holding one.
 */
const isNumberLike = (value) =>
  (typeof value === 'number' && Number.isFinite(value)) ||
  (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)));

/**
 * Compare a field value with a comparison target for an ordinal operator.
 * @param {object} args Arguments.
 * @param {any} args.value Field value.
 * @param {any} args.target Prepared target value.
 * @param {DateTimeField | undefined} args.dateFieldConfig DateTime field configuration, if the
 * target field is a DateTime field.
 * @returns {number | undefined} Negative if the value is less than the target, positive if
 * greater, zero if equal, or `undefined` if the two can’t be compared, which never satisfies the
 * operator. The two are compared as dates if the field is a DateTime field or either side is a
 * `Date`, such as an entry’s `commit_date` or the `{{now}}` tag, as numbers if both are numeric,
 * and as strings otherwise.
 */
const compareValues = ({ value, target, dateFieldConfig }) => {
  if (value === undefined || value === null || target === undefined || target === null) {
    return undefined;
  }

  if (dateFieldConfig || value instanceof Date || target instanceof Date) {
    const date = toDate(value, dateFieldConfig);
    const targetDate = toDate(target, dateFieldConfig);

    return date && targetDate ? date.getTime() - targetDate.getTime() : undefined;
  }

  if (isNumberLike(value) && isNumberLike(target)) {
    return Number(value) - Number(target);
  }

  const str = String(value);
  const targetStr = String(target);

  return str < targetStr ? -1 : str > targetStr ? 1 : 0;
};

/**
 * Check whether a field value equals a comparison target. A number or boolean in the configuration
 * equals its string form in the entry, and vice versa, as the file format decides which one is
 * stored.
 * @param {any} value Field value.
 * @param {any} target Prepared target value.
 * @returns {boolean} Whether the two are equal.
 */
const isEqual = (value, target) =>
  value === target ||
  (value !== undefined &&
    value !== null &&
    target !== undefined &&
    String(value) === String(target));

/**
 * Prepare the conditions of a view filter or group to be tested against a series of entries.
 * @param {ViewConditions} conditions Conditions.
 * @param {object} [options] Options.
 * @param {DateTimeField} [options.dateFieldConfig] DateTime field configuration, if the target
 * field is a DateTime field. The target of an ordinal comparison is then parsed as a date once,
 * rather than for every entry.
 * @param {Date} [options.now] Current date and time, which the template tags resolve to.
 * @returns {PreparedConditions} Prepared conditions.
 */
export const prepareConditions = (conditions, { dateFieldConfig, now = new Date() } = {}) => {
  const pattern = resolveComparisonValue(conditions.pattern, now);

  const comparisons = COMPARISON_OPERATORS.filter(
    (operator) => conditions[operator] !== undefined,
  ).map((operator) => {
    const value = conditions[operator];

    if (operator === 'empty') {
      return { operator, target: value };
    }

    if (operator === 'in' || operator === 'not_in') {
      return {
        operator,
        target: (Array.isArray(value) ? value : [value]).map((item) =>
          resolveComparisonValue(item, now),
        ),
      };
    }

    const target = resolveComparisonValue(value, now);

    if (dateFieldConfig && operator !== 'eq' && operator !== 'ne') {
      return { operator, target: toDate(target, dateFieldConfig) };
    }

    return { operator, target };
  });

  return { pattern, regex: getRegex(pattern), comparisons, dateFieldConfig };
};

/**
 * Check whether a field value satisfies the prepared conditions.
 * @param {object} args Arguments.
 * @param {any} args.rawValue Field value as stored in the entry. An array for a multi-value field,
 * such as a List field or a Relation field with `multiple: true`, which is matched item by item:
 * the entry satisfies a condition when any of its items does, and `ne` and `not_in` when none does.
 * @param {any} [args.refValue] Field value as displayed, when it differs from the stored value: the
 * label of the option a relation field refers to, or an array of labels for a multi-value field. An
 * equality check accepts either, so a filter can name the option the way the editor sees it or the
 * way it’s stored.
 * @param {PreparedConditions} args.conditions Prepared conditions.
 * @returns {boolean} Whether the value matches the pattern, if any, and satisfies every
 * comparison. An entry without a value for the field only satisfies `ne`, `not_in` and `empty:
 * true`.
 * @see https://github.com/sveltia/sveltia-cms/issues/997
 * @see https://github.com/sveltia/sveltia-cms/issues/1004
 */
export const matchesConditions = ({ rawValue, refValue, conditions }) => {
  const { pattern, regex, comparisons, dateFieldConfig } = conditions;
  const rawValues = [rawValue].flat().filter((value) => value !== undefined);

  // A label that can’t be resolved falls back to the stored value, so the two lists can overlap
  const values = [
    ...new Set([...rawValues, ...[refValue].flat().filter((value) => value !== undefined)]),
  ];

  if (pattern !== undefined && !values.some((value) => matchesFilter(value, pattern, regex))) {
    return false;
  }

  return comparisons.every(({ operator, target }) => {
    switch (operator) {
      case 'eq':
        return values.some((value) => isEqual(value, target));
      case 'ne':
        return !values.some((value) => isEqual(value, target));
      case 'in':
        return values.some((value) => target.some((/** @type {any} */ t) => isEqual(value, t)));
      case 'not_in':
        return !values.some((value) => target.some((/** @type {any} */ t) => isEqual(value, t)));
      case 'empty':
        // A multi-value or Object field is empty when none of its items has a value
        return [rawValue].flat().every(isValueEmpty) === target;

      default:
        return rawValues.some((value) => {
          const result = compareValues({ value, target, dateFieldConfig });

          if (result === undefined) {
            return false;
          }

          if (operator === 'lt') {
            return result < 0;
          }

          if (operator === 'lte') {
            return result <= 0;
          }

          if (operator === 'gt') {
            return result > 0;
          }

          return result >= 0;
        });
    }
  });
};
