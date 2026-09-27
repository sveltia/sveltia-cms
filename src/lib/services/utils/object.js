import { isObject } from '@sveltia/utils/object';
import { compare } from '@sveltia/utils/string';
import { unflatten } from 'flat';

/**
 * Prefix temporarily added to a key segment that {@link unflattenKeys} must keep as a string key.
 * A NUL character can’t start a list index, and a key starting with it is not a number.
 */
const STRING_KEY_PREFIX = '\u0000';
/**
 * Regular expression matching a key segment that is a list index.
 */
const INDEX_KEY_REGEX = /^(?:0|[1-9]\d*)$/;
/**
 * Check whether the given key segment is not a list index but still parsed as a number by the
 * `flat` library, e.g. an empty string or `01`.
 * @param {string} key Key segment.
 * @returns {boolean} Result.
 */
const isNumericStringKey = (key) => !Number.isNaN(Number(key)) && !INDEX_KEY_REGEX.test(key);
/**
 * Add {@link STRING_KEY_PREFIX} to the given key segment if it’s a numeric string key.
 * @param {string} key Key segment.
 * @returns {string} Key segment.
 */
const prefixStringKey = (key) => (isNumericStringKey(key) ? `${STRING_KEY_PREFIX}${key}` : key);

/**
 * Remove {@link STRING_KEY_PREFIX} from the object keys in the given value, recursively.
 * @param {any} value Value unflattened with prefixed key segments.
 * @returns {any} Value with the original keys. Arrays are updated in place, while plain objects are
 * rebuilt to keep their key order.
 */
const restoreStringKeys = (value) => {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      value[index] = restoreStringKeys(item);
    });

    return value;
  }

  // Leave class instances, such as a `Date`, as they are
  if (isObject(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    return Object.fromEntries(
      Object.entries(value).map(([key, val]) => [
        key.startsWith(STRING_KEY_PREFIX) ? key.slice(STRING_KEY_PREFIX.length) : key,
        restoreStringKeys(val),
      ]),
    );
  }

  return value;
};

/**
 * Unflatten a map of dot-notated keys with the `flat` library, while keeping every key segment that
 * isn’t a list index as a string key.
 *
 * The library turns any segment that `Number()` can parse into a number, so an empty key, which a
 * KeyValue field can hold, becomes `0`, and a key like `01` becomes `1`, which also makes an array
 * out of a new parent object. Such segments are prefixed while unflattening, then restored.
 * @param {Record<string, any>} map Map of dot-notated keys.
 * @returns {Record<string, any>} Unflattened map.
 * @see https://github.com/hughsk/flat/issues/103
 */
export const unflattenKeys = (map) => {
  if (!Object.keys(map).some((key) => key.split('.').some(isNumericStringKey))) {
    return unflatten(map);
  }

  return restoreStringKeys(unflatten(map, { transformKey: prefixStringKey }));
};

/**
 * Unflatten a map of dot-notated keys, sorting the keys first so that a parent key always precedes
 * its own children.
 *
 * A map may hold an empty object or array at a key that also has children, as a placeholder for the
 * value the children make up. The `flat` library fills such a placeholder in from the children, but
 * only when it comes first; encountered last, it overwrites everything below it and the children
 * are silently lost. A parent key is a prefix of its children, hence shorter, so sorting puts it
 * first. The comparison is numeric, so indexed keys are ordered `2` before `10` rather than
 * lexicographically.
 * @param {Record<string, any> | null | undefined} map Map of dot-notated keys. A nullish value is
 * passed through, just like the `flat` library does.
 * @returns {Record<string, any>} Unflattened map.
 */
export const unflattenMap = (map) =>
  map
    ? unflattenKeys(Object.fromEntries(Object.entries(map).sort(([a], [b]) => compare(a, b))))
    : unflatten(map);

/**
 * Check whether a value is empty, such as `undefined`, `null`, an empty string, an empty array, or
 * an empty object.
 * @param {any} value Value to check.
 * @returns {boolean} Whether the value is empty. An array or object holding only empty values is
 * not empty. Only a plain object counts as an object, as a `Date`, including a `TomlDate`, is an
 * object without any keys.
 */
export const isValueEmpty = (value) =>
  // Don’t use `!value` as `false` and `0` are valid values
  value === undefined ||
  value === null ||
  value === '' ||
  (Array.isArray(value) && !value.length) ||
  (isObject(value) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value)) &&
    !Object.keys(value).length);
