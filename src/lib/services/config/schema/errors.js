import { _, locale as appLocale } from '@sveltia/i18n';
import { isObject } from '@sveltia/utils/object';

import { addMessage } from '$lib/services/config/parser/utils/validator';
import { getListFormatter } from '$lib/services/contents/i18n';

/**
 * @import { ErrorObject } from 'ajv';
 * @import { ConfigParserCollectors, ConfigParserContext } from '$lib/types/private';
 * @import { CmsConfig } from '$lib/types/public';
 */

/**
 * Value types the schema uses, each with a localized name in `config.error.schema_value_type`.
 */
const VALUE_TYPES = ['string', 'number', 'integer', 'boolean', 'array', 'object', 'null'];
/**
 * Pattern matching a JSON pointer segment that indexes an array.
 */
const INDEX_REGEX = /^\d+$/;
/**
 * Decode the escape sequences of a JSON pointer segment.
 * @param {string} segment Segment to decode.
 * @returns {string} Decoded segment.
 */
const decodeSegment = (segment) => segment.replaceAll('~1', '/').replaceAll('~0', '~');

/**
 * Format the given items as a localized list of alternatives.
 * @param {string[]} items Items to format.
 * @returns {string} Formatted list, such as `a, b or c`.
 */
const formatList = (items) =>
  getListFormatter(appLocale.current, { type: 'disjunction' }).format(items);

/**
 * Format a value the configuration is expected to hold. An empty string is written as a pair of
 * quotes, which is easier to read than the nothing it would otherwise render as.
 * @param {any} value Value to format.
 * @returns {string} Quoted value.
 */
const formatValue = (value) =>
  `\`${typeof value === 'string' && value ? value : JSON.stringify(value)}\``;

/**
 * Get the localized name of a value type.
 * @param {string} type Type name from the schema.
 * @returns {string} Localized name, such as `a string`.
 */
const formatType = (type) => _(`config.error.schema_value_type.${type}`);

/**
 * Join the segments of an option path, writing array indexes in brackets.
 * @param {string[]} segments Segments to join.
 * @returns {string} Option path, such as `view_filters[0].pattern`.
 */
const formatOption = (segments) =>
  segments.reduce((path, segment) => {
    if (INDEX_REGEX.test(segment)) {
      return `${path}[${segment}]`;
    }

    return path ? `${path}.${segment}` : segment;
  }, '');

/**
 * Extend a field key path with the name of one of its sub-fields, following the same convention as
 * the configuration parser: sub-fields of a List field are addressed with a wildcard.
 * @param {string} keyPath Key path of the parent field, which is empty at the collection level.
 * @param {any} parent Parent field configuration.
 * @param {string} name Sub-field name.
 * @returns {string} Extended key path.
 */
const appendFieldName = (keyPath, parent, name) => {
  const base = parent?.widget === 'list' ? `${keyPath}.*` : keyPath;

  return base ? `${base}.${name}` : name;
};

/**
 * Work out which part of the configuration a JSON pointer refers to, so that the problem can be
 * reported the same way as the ones the configuration parser finds: located by collection, file and
 * field, with the remaining path naming the offending option.
 * @param {CmsConfig} config Raw CMS configuration.
 * @param {string} instancePath JSON pointer, such as `/collections/0/fields/2/widget`.
 * @returns {{ context: ConfigParserContext, option: string[] }} Parser context and the segments of
 * the option path relative to the located item.
 */
export const locateError = (config, instancePath) => {
  const segments = instancePath.split('/').slice(1).map(decodeSegment);
  /** @type {ConfigParserContext} */
  const context = {};
  /** @type {string[]} */
  const option = [];
  /** @type {any} */
  let node = config;
  let keyPath = '';
  let index = 0;
  // Walk the structural part of the pointer; everything from the first unrecognized segment on
  // names an option
  let structural = true;

  while (index < segments.length && structural) {
    const key = segments[index];
    const next = segments[index + 1];
    const item = next !== undefined && INDEX_REGEX.test(next) ? node?.[key]?.[next] : undefined;

    if (isObject(item) && node === config && (key === 'collections' || key === 'singletons')) {
      // A singleton is a file that doesn’t belong to a collection
      context[key === 'collections' ? 'collection' : 'collectionFile'] = /** @type {any} */ (item);
      node = item;
      index += 2;
    } else if (isObject(item) && key === 'files' && context.collection) {
      context.collectionFile = /** @type {any} */ (item);
      node = item;
      index += 2;
    } else if (isObject(item) && key === 'fields') {
      keyPath = appendFieldName(keyPath, node, item.name);
      node = item;
      index += 2;
    } else if (isObject(item) && key === 'types') {
      keyPath = `${keyPath}${node?.widget === 'list' ? '.*' : ''}<${item.name}>`;
      node = item;
      index += 2;
    } else if (key === 'field' && isObject(node?.field)) {
      keyPath = appendFieldName(keyPath, node, node.field.name);
      node = node.field;
      index += 1;
    } else {
      structural = false;
    }
  }

  option.push(...segments.slice(index));

  if (keyPath) {
    context.typedKeyPath = keyPath;
  }

  return { context, option };
};

/**
 * Describe a single schema violation.
 * @param {ErrorObject} error Validation error.
 * @param {string} option Option path the error applies to.
 * @returns {{ strKey: string, values: Record<string, string> }} I18n string key and values.
 */
const describeError = ({ keyword, params }, option) => {
  if (keyword === 'enum') {
    return {
      strKey: 'schema_invalid_enum',
      values: { option, values: formatList(params.allowedValues.map(formatValue)) },
    };
  }

  if (keyword === 'const') {
    return params.allowedValue === ''
      ? { strKey: 'schema_invalid_empty_value', values: { option } }
      : { strKey: 'schema_invalid_const', values: { option, value: String(params.allowedValue) } };
  }

  if (keyword === 'minItems' || keyword === 'maxItems') {
    return { strKey: 'schema_invalid_item_count', values: { option, count: String(params.limit) } };
  }

  return { strKey: 'schema_invalid_value', values: { option } };
};

/**
 * Turn the validator’s output into configuration errors.
 *
 * The validator reports one error for every constraint the configuration failed, which includes the
 * branches of a union it was never meant to match and every object enclosing the actual mistake. To
 * keep the report readable, the branch selections the adapted schema introduces are dropped, only
 * the innermost location is kept, and the alternatives of a union are merged into a single message.
 * @param {object} args Arguments.
 * @param {CmsConfig} args.config Raw CMS configuration.
 * @param {ErrorObject[]} args.errors Validation errors.
 * @param {ConfigParserCollectors} args.collectors Collectors.
 */
export const reportSchemaErrors = ({ config, errors, collectors }) => {
  // `if` errors only say which branch of a union was selected, which is never the problem
  const relevant = errors.filter(({ keyword }) => keyword !== 'if');
  const paths = [...new Set(relevant.map(({ instancePath }) => instancePath))];
  // Anything wrong inside an object also fails the object itself, and the enclosing report is
  // always the vaguer of the two
  const innermost = paths.filter((path) => !paths.some((other) => other.startsWith(`${path}/`)));

  innermost.forEach((path) => {
    const group = relevant.filter(({ instancePath }) => instancePath === path);
    const { context, option } = locateError(config, path);
    const hasAlternatives = group.some(({ keyword }) => keyword === 'anyOf');

    const missing = group
      .filter(({ keyword }) => keyword === 'required')
      .map(({ params }) => formatOption([...option, params.missingProperty]));

    const others = group.filter(({ keyword }) => keyword !== 'required' && keyword !== 'anyOf');

    // A value that fails several type constraints belongs to a union that couldn’t be reduced to a
    // single branch, so the types it may take are reported together
    const types = [
      ...new Set(
        others
          .filter(({ keyword, params }) => keyword === 'type' && VALUE_TYPES.includes(params.type))
          .map(({ params }) => /** @type {string} */ (params.type)),
      ),
    ];

    // Several missing properties across the branches of a union mean any one of them will do
    if (missing.length > 1 && hasAlternatives) {
      addMessage({
        strKey: 'schema_missing_one_of',
        values: { options: formatList([...new Set(missing)].map(formatValue)) },
        context,
        collectors,
      });
    } else {
      [...new Set(missing)].forEach((name) => {
        addMessage({
          strKey: 'schema_missing_option',
          values: { option: name },
          context,
          collectors,
        });
      });
    }

    if (types.length) {
      addMessage({
        strKey: 'schema_invalid_type',
        values: { option: formatOption(option), type: formatList(types.map(formatType)) },
        context,
        collectors,
      });
    }

    others
      .filter(({ keyword, params }) => !(keyword === 'type' && VALUE_TYPES.includes(params.type)))
      .forEach((error) => {
        addMessage({ ...describeError(error, formatOption(option)), context, collectors });
      });

    // A union that failed without any usable detail still needs to be reported
    if (!missing.length && !others.length) {
      addMessage({
        strKey: 'schema_invalid_value',
        values: { option: formatOption(option) },
        context,
        collectors,
      });
    }
  });
};
