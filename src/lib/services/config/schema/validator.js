import { Validator } from '@cfworker/json-schema';
import { isObject } from '@sveltia/utils/object';

/**
 * @import { OutputUnit } from '@cfworker/json-schema';
 * @import { SchemaValidationError } from '$lib/types/private';
 */

/**
 * The JSON Schema draft the published schema is written against.
 */
const SCHEMA_DRAFT = '7';
/**
 * Keywords that only report that something below them failed. The keyword that describes the
 * actual problem is reported separately, so these would be noise.
 */
const CONTAINER_KEYWORDS = ['$ref', 'properties', 'items', 'if', 'allOf', 'oneOf'];

/**
 * Keywords whose constraint is the value found at the keyword’s own location in the schema.
 */
const CONSTRAINT_PARAMS = {
  type: 'type',
  enum: 'allowedValues',
  const: 'allowedValue',
  minItems: 'limit',
  maxItems: 'limit',
  minLength: 'limit',
  maxLength: 'limit',
};

/**
 * Decode the escape sequences of a JSON pointer segment.
 * @param {string} segment Segment to decode.
 * @returns {string} Decoded segment.
 */
const decodeSegment = (segment) => segment.replaceAll('~1', '/').replaceAll('~0', '~');

/**
 * Split a location reported by the validator into JSON pointer segments.
 * @param {string} location Location, such as `#/properties/backend/$ref/properties/name/const`.
 * @returns {string[]} Segments.
 */
const getSegments = (location) =>
  location.replace(/^#/, '').split('/').filter(Boolean).map(decodeSegment);

/**
 * Resolve a keyword location within the schema. A `$ref` segment means the reference at that point
 * was followed, so the pointer it holds is resolved before the walk continues.
 * @param {Record<string, any>} schema Root schema.
 * @param {string} location Keyword location.
 * @returns {any} Value at that location, or `undefined` if it can’t be resolved.
 */
const resolveKeyword = (schema, location) =>
  getSegments(location).reduce((/** @type {any} */ node, segment) => {
    if (segment === '$ref' && isObject(node) && typeof node.$ref === 'string') {
      return getSegments(node.$ref).reduce(
        (/** @type {any} */ target, key) => target?.[key],
        schema,
      );
    }

    return node?.[segment];
  }, schema);

/**
 * Resolve an instance location within the configuration.
 * @param {any} config Raw CMS configuration.
 * @param {string} location Instance location.
 * @returns {any} Value at that location.
 */
const resolveInstance = (config, location) =>
  getSegments(location).reduce((/** @type {any} */ value, segment) => value?.[segment], config);

/**
 * Convert one validator output unit into the errors the reporter works with. A unit says which
 * keyword failed but not what it expected, so the constraint is read back from the schema. For
 * `required` the unit doesn’t name the missing property either, so every property the object lacks
 * is reported, one error each, matching how the rest of the reporting is keyed on a single option.
 * @param {OutputUnit} unit Output unit.
 * @param {Record<string, any>} schema Root schema.
 * @param {any} config Raw CMS configuration.
 * @returns {SchemaValidationError[]} Errors.
 */
const normalizeUnit = ({ keyword, keywordLocation, instanceLocation }, schema, config) => {
  const instancePath = instanceLocation.replace(/^#/, '');

  if (keyword === 'required') {
    const required = resolveKeyword(schema, keywordLocation);
    const value = resolveInstance(config, instanceLocation);

    /* v8 ignore next 3 -- the validator only reports `required` for an object, against a schema
    whose `required` is an array; the guard is here in case a location can’t be resolved */
    if (!Array.isArray(required) || !isObject(value)) {
      return [];
    }

    return required
      .filter((name) => !(name in value))
      .map((name) => ({ instancePath, keyword, params: { missingProperty: name } }));
  }

  const param = CONSTRAINT_PARAMS[/** @type {keyof CONSTRAINT_PARAMS} */ (keyword)];

  return [
    {
      instancePath,
      keyword,
      params: param ? { [param]: resolveKeyword(schema, keywordLocation) } : {},
    },
  ];
};

/**
 * Compile a schema into a function that validates a configuration against it.
 *
 * The validator interprets the schema rather than generating code for it, so the CMS never needs
 * `unsafe-eval` in its content security policy. Its output describes each problem by pointing into
 * the schema, so the expected type, values or limit are read back from there.
 * @param {Record<string, any>} schema Schema to validate against.
 * @returns {(config: any) => SchemaValidationError[]} Function returning the problems found, which
 * is empty when the configuration is valid.
 * @see https://github.com/cfworker/cfworker/tree/main/packages/json-schema
 */
export const compileSchema = (schema) => {
  // The validator mutates the schema it’s given while resolving references
  const validator = new Validator(structuredClone(schema), SCHEMA_DRAFT, false);

  return (config) => {
    const { valid, errors } = validator.validate(config);

    if (valid) {
      return [];
    }

    /** @type {Set<string>} */
    const seen = new Set();

    return (
      errors
        .filter(({ keyword }) => !CONTAINER_KEYWORDS.includes(keyword))
        // The validator reports `required` once per missing property, while `normalizeUnit` covers
        // them all at once, so only the first unit for a given object is expanded
        .filter(({ keyword, instanceLocation, keywordLocation }) => {
          if (keyword !== 'required') {
            return true;
          }

          const key = `${instanceLocation}|${keywordLocation}`;

          if (seen.has(key)) {
            return false;
          }

          seen.add(key);

          return true;
        })
        .flatMap((unit) => normalizeUnit(unit, schema, config))
    );
  };
};
