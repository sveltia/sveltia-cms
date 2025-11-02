import { parseFileFieldConfig } from '$lib/services/config/parser/fields/file';
import { parseListFieldConfig } from '$lib/services/config/parser/fields/list';
import { parseObjectFieldConfig } from '$lib/services/config/parser/fields/object';
import { parseRelationFieldConfig } from '$lib/services/config/parser/fields/relation';

/**
 * @import { Field } from '$lib/types/public';
 * @import {
 * ConfigParserCollectors,
 * ConfigParserContext,
 * FieldParserArgs,
 * } from '$lib/types/private';
 */

/**
 * Parsers for each field widget type.
 * @type {Record<string, (args: FieldParserArgs) => void>}
 */
const parsers = {
  file: parseFileFieldConfig,
  image: parseFileFieldConfig, // alias
  list: parseListFieldConfig,
  object: parseObjectFieldConfig,
  relation: parseRelationFieldConfig,
};

/**
 * Parse and validate a single field configuration.
 * @param {FieldParserArgs} args Arguments.
 */
export const parseFieldConfig = ({ fieldConfig, context, collectors }) => {
  const { name, widget = 'string' } = fieldConfig;
  const { typedKeyPath } = context;

  parsers[widget]?.({
    fieldConfig,
    context: { ...context, typedKeyPath: typedKeyPath ? `${typedKeyPath}.${name}` : name },
    collectors,
  });
};

/**
 * Parse and validate multiple field configurations.
 * @param {Field[]} fields Array of field configs to parse.
 * @param {ConfigParserContext} context Context.
 * @param {ConfigParserCollectors} collectors Collectors.
 */
export const parseFields = (fields, context, collectors) => {
  fields?.forEach((fieldConfig) => {
    parseFieldConfig({ fieldConfig, context, collectors });
  });
};
