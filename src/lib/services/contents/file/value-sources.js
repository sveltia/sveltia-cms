import { isObject } from '@sveltia/utils/object';
import { isMap, isScalar, isSeq } from 'yaml';

/**
 * @import { Document, ScalarTag } from 'yaml';
 * @import { ValueSource, ValueSourceMap } from '$lib/types/private';
 */

/**
 * Source text of the values in a file that the parsed content holds in another type or can’t tell
 * apart from others, keyed by the path of the file they’re read from. A float that is a whole
 * number, e.g. `10.0`, `-3.0` or `1e3`, is read as the same `number` as an integer, e.g. `10`,
 * which a formatter would write. Hugo, written in Go, and other typed consumers then read an
 * integer instead of a float, so e.g. `eq .Params.price 10.0` turns false. A TOML native date or
 * time is held as a string, see `toml-sources.js`.
 *
 * The formatter writes such a value back as it was read, as long as it hasn’t been edited, so
 * saving an entry doesn’t change the type of a value. An edited value is saved like any other.
 * @type {Map<string, ValueSourceMap>}
 */
export const valueSources = new Map();

/**
 * Regular expression testing whether a document may hold a float that is a whole number: a number
 * with a fractional part of zeros or a number with an exponent. Testing first saves looking for one
 * in a document that has none.
 */
const WHOLE_NUMBER_FLOAT_REGEX = /(?:^|[^\d])\.0|\d\.0*(?!\d)|\d[eE][-+]?\d/;
/**
 * Regular expression matching the source text of an integer in a YAML 1.2 document: a decimal,
 * octal or hexadecimal one.
 * @see https://yaml.org/spec/1.2.2/#1032-tag-resolution
 */
const YAML_INTEGER_REGEX = /^[-+]?(?:\d+|0o[0-7]+|0x[\da-fA-F]+)$/;
/**
 * Regular expression matching the source text of a float in a YAML 1.2 document, other than an
 * infinity or a NaN.
 * @see https://yaml.org/spec/1.2.2/#1032-tag-resolution
 */
const YAML_FLOAT_REGEX = /^[-+]?(?:\.\d+|\d+(?:\.\d*)?)(?:[eE][-+]?\d+)?$/;
/**
 * Regular expression matching the source text of a number in a JSON document.
 * @see https://www.json.org/json-en.html
 */
const JSON_NUMBER_REGEX = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][-+]?\d+)?$/;
/**
 * Regular expression matching the source text of an integer in a JSON document.
 */
const JSON_INTEGER_REGEX = /^-?\d+$/;

/**
 * Check whether the given document may hold a float that is a whole number.
 * @param {string} str Document.
 * @returns {boolean} Result.
 */
export const mayHaveWholeNumberFloat = (str) => WHOLE_NUMBER_FLOAT_REGEX.test(str);

/**
 * Check whether the given value is a `number` that is a whole number, which a formatter writes as
 * an integer.
 * @param {any} value Value.
 * @returns {value is number} Result.
 */
const isWholeNumber = (value) => typeof value === 'number' && Number.isInteger(value);

/**
 * Get the text of the given whole number written as a float.
 * @param {number} value Whole number.
 * @returns {string} Text, e.g. `10.0`, or `1e+21` for a number written with an exponent anyway.
 */
export const getFloatText = (value) => {
  const text = Object.is(value, -0) ? '-0' : String(value);

  return /[.e]/.test(text) ? text : `${text}.0`;
};

/**
 * Join a key path and a key. A dot or a backslash in the key is escaped with a backslash, so a key
 * containing a dot can be told from a nested key: `a\.b` for `a.b`, and `a.b` for `b` in `a`.
 * @param {string} keyPath Key path of the parent, or an empty string for the document itself.
 * @param {string | number} key Property name or array index.
 * @returns {string} Key path.
 */
export const joinKeyPath = (keyPath, key) => {
  const escapedKey = String(key).replace(/[\\.]/g, '\\$&');

  return keyPath ? `${keyPath}.${escapedKey}` : escapedKey;
};

/**
 * Collect the source text of the floats that are whole numbers in the given YAML document. A float
 * reached through an alias is left out, as are the keys, which the parsed content holds as strings.
 * @param {Document} doc Document parsed by the YAML library.
 * @returns {ValueSourceMap} Source map. Empty if the document has no such float.
 */
export const collectYAMLFloatSources = (doc) => {
  /** @type {ValueSourceMap} */
  const sourceMap = {};

  /**
   * Add the source text of the floats in the given node to the map.
   * @param {unknown} node YAML node.
   * @param {string} keyPath Key path of the node.
   */
  const collect = (node, keyPath) => {
    if (isScalar(node)) {
      const { value, source, tag } = node;

      // A number is a float unless it’s written as an integer. The library reads a float with an
      // integer’s text and the `!!float` tag, e.g. `!!float 10`, as a string, while a float tag is
      // left out from the saved text, e.g. `!!float 10.0` is saved as `10.0`
      if (
        keyPath &&
        isWholeNumber(value) &&
        (!tag || tag === 'tag:yaml.org,2002:float') &&
        typeof source === 'string' &&
        !YAML_INTEGER_REGEX.test(source)
      ) {
        sourceMap[keyPath] = { value, source };
      }
    } else if (isMap(node)) {
      node.items.forEach(({ key, value }) => {
        if (isScalar(key)) {
          collect(value, joinKeyPath(keyPath, String(key.value)));
        }
      });
    } else if (isSeq(node)) {
      node.items.forEach((item, index) => {
        collect(item, joinKeyPath(keyPath, index));
      });
    }
  };

  collect(doc.contents, '');

  return sourceMap;
};

/**
 * A value to be written as the given source text, which tells more than the value itself, e.g. a
 * float that is a whole number. A formatter that doesn’t know about it writes the value.
 */
export class SourcedValue {
  /**
   * Create a value.
   * @param {any} value Value.
   * @param {string} source Source text.
   */
  constructor(value, source) {
    this.value = value;
    this.source = source;
  }

  /**
   * Get the value, which `JSON.stringify()` and the YAML library write without a replacer or a tag
   * that knows about the source text.
   * @returns {any} Value.
   */
  toJSON() {
    return this.value;
  }
}

/**
 * A `JSON.parse()` reviver that marks a float that is a whole number with a {@link SourcedValue},
 * held in the parsed content until its key path is known, so its source text can be collected with
 * {@link collectJSONFloatSources}. A browser that doesn’t give the reviver the source text reads
 * the number as usual.
 * @param {string} _key Property name.
 * @param {any} value Parsed value.
 * @param {{ source?: string }} [context] Context, which holds the source text of a primitive value.
 * @returns {any} Value.
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse#the_reviver_parameter
 */
export const reviveWholeNumberFloat = (_key, value, context) => {
  const source = context?.source;

  return isWholeNumber(value) && typeof source === 'string' && !JSON_INTEGER_REGEX.test(source)
    ? new SourcedValue(value, source)
    : value;
};

/**
 * Replace every float marked by {@link reviveWholeNumberFloat} in the given parsed JSON document
 * with its number, and collect the source text of those floats.
 * @param {any} parsed Parsed document. Arrays and plain objects are updated in place.
 * @returns {{ value: any, sourceMap: ValueSourceMap }} Document without a marked float, and the
 * source map, which is empty if the document has no such float.
 */
export const collectJSONFloatSources = (parsed) => {
  /** @type {ValueSourceMap} */
  const sourceMap = {};

  /**
   * Replace the marked floats in the given value.
   * @param {any} value Value.
   * @param {string} keyPath Key path of the value.
   * @returns {any} Value without a marked float.
   */
  const collect = (value, keyPath) => {
    if (value instanceof SourcedValue) {
      if (keyPath) {
        sourceMap[keyPath] = { value: value.value, source: value.source };
      }

      return value.value;
    }

    if (Array.isArray(value) || isObject(value)) {
      Object.entries(value).forEach(([key, val]) => {
        /** @type {Record<string, any>} */ (value)[key] = collect(val, joinKeyPath(keyPath, key));
      });
    }

    return value;
  };

  return { value: collect(parsed, ''), sourceMap };
};

/**
 * Remember the given source map of a file, if it’s not empty.
 * @param {string} path File path.
 * @param {ValueSourceMap} sourceMap Source map.
 */
export const rememberValueSources = (path, sourceMap) => {
  if (Object.keys(sourceMap).length) {
    valueSources.set(path, sourceMap);
  }
};

/**
 * Get the source map to save a file with, from the file before the save. The file after the save,
 * which may have been renamed, takes it over, so it’s saved the same way next time as well.
 * @param {object} args Arguments.
 * @param {string} [args.previousPath] Path of the file before the save, if it exists.
 * @param {string} args.path Path of the file after the save.
 * @returns {ValueSourceMap | undefined} Source map, or `undefined` if the file has none.
 */
export const getSavedValueSources = ({ previousPath, path }) => {
  const sourceMap = previousPath ? valueSources.get(previousPath) : undefined;

  // A new file doesn’t take over what was remembered for a file deleted from the same path
  if (sourceMap) {
    valueSources.set(path, sourceMap);
  } else {
    valueSources.delete(path);
  }

  return sourceMap;
};

/**
 * Move the source map of a file storing all the entries of an entry collection along with its
 * items, which can have been added, removed or reordered.
 * @param {ValueSourceMap} sourceMap Source map of the file.
 * @param {(number | undefined)[]} positions Position of each item in the array before the changes.
 * `undefined` for a new item.
 * @returns {ValueSourceMap} Source map of the items at their new positions.
 */
export const moveArrayItemSources = (sourceMap, positions) => {
  /** @type {Map<string, [string, ValueSourceMap[string]][]>} */
  const itemSources = new Map();

  Object.entries(sourceMap).forEach(([keyPath, valueSource]) => {
    const [index, ...rest] = keyPath.split('.');

    if (!itemSources.has(index)) {
      itemSources.set(index, []);
    }

    /** @type {[string, ValueSourceMap[string]][]} */ (itemSources.get(index)).push([
      rest.join('.'),
      valueSource,
    ]);
  });

  return Object.fromEntries(
    positions.flatMap((from, index) =>
      from === undefined
        ? []
        : (itemSources.get(String(from)) ?? []).map(([subPath, valueSource]) => [
            subPath ? `${index}.${subPath}` : String(index),
            valueSource,
          ]),
    ),
  );
};

/**
 * Replace a number to be saved with a {@link SourcedValue}, which the JSON and YAML formatters
 * write as its source text, if it hasn’t changed since it was read from the file.
 * @param {any} value Value to be saved.
 * @param {ValueSource} valueSource Value read from the file at the same key path.
 * @returns {SourcedValue | undefined} Replacement, or `undefined` if the value has changed or is
 * not a number.
 */
const replaceUnchangedValue = (value, { value: parsedValue, source }) =>
  typeof value === 'number' && value === parsedValue ? new SourcedValue(value, source) : undefined;

/**
 * Copy the given content to be saved, replacing every value that hasn’t changed since it was read
 * from the file with one that the formatter writes as its source text.
 * @param {any} value Content, or a value in it.
 * @param {ValueSourceMap} sourceMap Source map of the file.
 * @param {(value: any, valueSource: ValueSource) => any} [replace] Function returning the
 * replacement of a value that has a source, or `undefined` if the value has changed. The default
 * one gives a {@link SourcedValue}.
 * @param {string} [keyPath] Key path of the value.
 * @returns {any} Copy of arrays and plain objects; any other value as is, or replaced.
 */
export const restoreValueSources = (
  value,
  sourceMap,
  replace = replaceUnchangedValue,
  keyPath = '',
) => {
  const valueSource = keyPath && Object.hasOwn(sourceMap, keyPath) ? sourceMap[keyPath] : undefined;
  const replacement = valueSource ? replace(value, valueSource) : undefined;

  if (replacement !== undefined) {
    return replacement;
  }

  if (Array.isArray(value)) {
    return value.map((val, index) =>
      restoreValueSources(val, sourceMap, replace, joinKeyPath(keyPath, index)),
    );
  }

  // Leave class instances, such as a `TomlDate`, as they are
  if (isObject(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    return Object.fromEntries(
      Object.entries(value).map(([key, val]) => [
        key,
        restoreValueSources(val, sourceMap, replace, joinKeyPath(keyPath, key)),
      ]),
    );
  }

  return value;
};

/**
 * Check whether the given source text is a float representing the given number in a document of
 * the given format, so it can be written as it is.
 * @param {string} source Source text.
 * @param {any} value Value.
 * @param {RegExp} regex Regular expression matching a number in the format. An underscore it lets
 * through, as in a TOML number, is ignored when reading the number.
 * @returns {boolean} Result.
 */
export const isFloatSource = (source, value, regex) =>
  typeof value === 'number' &&
  regex.test(source) &&
  /[.eE]/.test(source) &&
  Number(source.replaceAll('_', '')) === value;

/**
 * Get the text to write a {@link SourcedValue} as in a JSON document.
 * @param {SourcedValue} sourcedValue Value.
 * @returns {string | undefined} Source text, or `undefined` if it’s not a JSON number representing
 * the value.
 */
export const getJSONSourceText = ({ value, source }) =>
  isFloatSource(source, value, JSON_NUMBER_REGEX) ? source : undefined;

/**
 * YAML tag writing a {@link SourcedValue} as its source text, or as the value if the text is not a
 * YAML float representing the value. It’s the default float tag, so the tag isn’t written.
 * @type {ScalarTag}
 */
export const sourcedValueYAMLTag = {
  /**
   * Check whether the tag applies to the given value.
   * @param {unknown} value Value.
   * @returns {boolean} Result.
   */
  identify: (value) => value instanceof SourcedValue,
  default: true,
  tag: 'tag:yaml.org,2002:float',
  /**
   * Read the text of a scalar node, which the tag isn’t used for, as it’s only given to the
   * formatter.
   * @param {string} str Text.
   * @returns {number} Number.
   */
  resolve: (str) => Number(str),
  /**
   * Write the value of a scalar node.
   * @param {{ value: unknown }} node Scalar node.
   * @returns {string} Text.
   */
  stringify: ({ value: sourcedValue }) => {
    const { value, source } = /** @type {SourcedValue} */ (sourcedValue);

    if (isFloatSource(source, value, YAML_FLOAT_REGEX)) {
      return source;
    }

    // Only a number can be written as raw text; anything else is written as a quoted string
    return typeof value === 'number' ? getFloatText(value) : JSON.stringify(String(value));
  },
};
