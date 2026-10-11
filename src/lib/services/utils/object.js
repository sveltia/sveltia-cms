import { isObject } from '@sveltia/utils/object';
import { compare } from '@sveltia/utils/string';
import { unflatten } from 'flat';

/**
 * Character that replaces a dot in an object key when the key becomes a key path segment, so that
 * a key like `example.com`, which a KeyValue field or any data the configuration doesn’t cover can
 * hold, isn’t split into nested objects on save. A Private Use Area character is unlikely to appear
 * in a key, and it leaves the dot as the only key path delimiter, so a key path can still be split
 * with `.` and its segments matched with `[^.]`. The UI only shows unescaped keys.
 */
const ESCAPED_DOT = '\uE000';
/**
 * Character that precedes a literal {@link ESCAPED_DOT} or itself in an escaped key segment, so any
 * key round-trips unchanged.
 */
const ESCAPE_CHAR = '\uE001';
/**
 * Regular expression matching the characters to escape in a key segment.
 */
const ESCAPE_REGEX = /[.\uE000\uE001]/g;
/**
 * Regular expression matching an escape sequence in a key segment.
 */
const UNESCAPE_REGEX = /\uE001([\uE000\uE001])|\uE000/g;
/**
 * Regular expression testing whether a key segment or path holds an escape sequence.
 */
const ESCAPED_KEY_REGEX = /[\uE000\uE001]/;
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
 * Escape an object key to be used as a key path segment, so a dot in it isn’t taken as a delimiter.
 * @param {string} key Object key, e.g. `example.com`.
 * @returns {string} Key path segment without any dot.
 */
export const escapeKeySegment = (key) =>
  // Testing first is faster than always replacing, as hardly any key needs escaping
  key.includes('.') || ESCAPED_KEY_REGEX.test(key)
    ? key.replace(ESCAPE_REGEX, (char) => (char === '.' ? ESCAPED_DOT : `${ESCAPE_CHAR}${char}`))
    : key;

/**
 * Restore an object key from a key path segment escaped with {@link escapeKeySegment}.
 * @param {string} segment Key path segment.
 * @returns {string} Object key.
 */
export const unescapeKeySegment = (segment) =>
  ESCAPED_KEY_REGEX.test(segment)
    ? segment.replace(UNESCAPE_REGEX, (_match, char) => char ?? '.')
    : segment;

/**
 * Check whether the given value is a plain object or array with any key, which the `flat` library
 * flattens itself when it finds one in a map to unflatten.
 * @param {any} value Value.
 * @returns {boolean} Result.
 */
const isNonEmptyCollection = (value) =>
  ['[object Object]', '[object Array]'].includes(Object.prototype.toString.call(value)) &&
  !!Object.keys(value).length;

/**
 * Check whether the given value is a plain object, not an array, with a key that looks like a list
 * index, e.g. `{ "2024": "a" }`. A key path doesn’t tell an object key from a list index, so the
 * `flat` library would unflatten the object into an array.
 * @param {any} value Value.
 * @returns {boolean} Result.
 */
const hasIndexLikeKey = (value) =>
  Object.prototype.toString.call(value) === '[object Object]' &&
  Object.keys(value).some((key) => INDEX_KEY_REGEX.test(key));

/**
 * Check whether the given flattened map holds a property of the object at the given key path whose
 * key looks like a list index, e.g. `years.2024` for `years`. Unless the map also holds a
 * placeholder at the key path, as {@link flattenKeys} adds, the object would be unflattened into an
 * array.
 * @param {Record<string, any>} map Flattened map.
 * @param {string} keyPath Key path of the object.
 * @returns {boolean} Result.
 */
export const hasIndexLikeChildKey = (map, keyPath) => {
  const prefix = `${keyPath}.`;

  return Object.keys(map).some(
    (key) => key.startsWith(prefix) && INDEX_KEY_REGEX.test(key.slice(prefix.length).split('.')[0]),
  );
};

/**
 * Flatten an object or array into a map of dot-notated key paths, like the `flat` library does,
 * escaping every object key with {@link escapeKeySegment}, so that {@link unflattenKeys} restores
 * the same structure even if a key contains a dot.
 *
 * A plain object with a key that looks like a list index, e.g. `{ "2024": "a" }`, also gets an
 * empty object at its own key path, ahead of its properties, e.g. `years: {}` before `years.2024`.
 * When unflattening, the placeholder makes the parent an object rather than an array, while the key
 * paths stay the same, so the value can still be found by the key path of a field named `2024`.
 * @param {Record<string, any> | any[]} value Object or array to flatten.
 * @param {string} [prefix] Key path to prepend to every key path, e.g. `list.0`. It must be escaped
 * already, if needed. An empty value is then stored at the prefix itself, as `flatten()` does with
 * `{ [prefix]: value }`.
 * @returns {Record<string, any>} Flattened map.
 */
export const flattenKeys = (value, prefix) => {
  /** @type {Record<string, any>} */
  const map = {};

  /**
   * Add the properties of an object or array to the map.
   * @param {Record<string, any> | any[]} object Object or array.
   * @param {string} [parentKeyPath] Key path of the object or array.
   */
  const step = (object, parentKeyPath) => {
    if (parentKeyPath !== undefined && hasIndexLikeKey(object)) {
      map[parentKeyPath] = {};
    }

    Object.entries(object).forEach(([key, val]) => {
      const segment = escapeKeySegment(key);
      const keyPath = parentKeyPath === undefined ? segment : `${parentKeyPath}.${segment}`;

      if (isNonEmptyCollection(val)) {
        step(val, keyPath);
      } else {
        map[keyPath] = val;
      }
    });
  };

  if (isNonEmptyCollection(value)) {
    step(value, prefix);
  } else if (prefix !== undefined) {
    map[prefix] = value;
  }

  return map;
};

/**
 * Transform a key path segment while unflattening: unescape it, then add {@link STRING_KEY_PREFIX}
 * if it’s a numeric string key.
 * @param {string} segment Key path segment.
 * @returns {string} Transformed segment.
 */
const transformSegment = (segment) => prefixStringKey(unescapeKeySegment(segment));

/**
 * Unflatten a map of dot-notated keys with the `flat` library, while keeping every key segment that
 * isn’t a list index as a string key, and restoring the keys escaped with {@link escapeKeySegment}.
 *
 * The library turns any segment that `Number()` can parse into a number, so an empty key, which a
 * KeyValue field can hold, becomes `0`, and a key like `01` becomes `1`, which also makes an array
 * out of a new parent object. Such segments are prefixed while unflattening, then restored. A key
 * that looks like a list index, e.g. `2024`, is a list index unless the map holds an empty object
 * at the parent key path first, as {@link flattenKeys} adds for an object with such a key.
 * @param {Record<string, any>} map Map of dot-notated keys.
 * @returns {Record<string, any>} Unflattened map.
 * @see https://github.com/hughsk/flat/issues/103
 */
export const unflattenKeys = (map) => {
  const entries = Object.entries(map);

  // The library flattens a nested object or array value itself, without escaping its keys, and
  // would apply the transformation below to them. Flatten it here instead, at the same position
  if (entries.some(([, value]) => isNonEmptyCollection(value))) {
    return unflattenKeys(
      Object.fromEntries(
        entries.flatMap(([key, value]) =>
          isNonEmptyCollection(value) ? Object.entries(flattenKeys(value, key)) : [[key, value]],
        ),
      ),
    );
  }

  if (
    !entries.some(([key]) => ESCAPED_KEY_REGEX.test(key) || key.split('.').some(isNumericStringKey))
  ) {
    return unflatten(map);
  }

  return restoreStringKeys(unflatten(map, { transformKey: transformSegment }));
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
