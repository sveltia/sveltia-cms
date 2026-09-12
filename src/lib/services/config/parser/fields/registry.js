import { parseCustomFieldConfig } from '$lib/services/config/parser/fields/custom';
import { addMessage, checkName } from '$lib/services/config/parser/utils/validator';
import { BUILTIN_FIELD_TYPES } from '$lib/services/contents/fields';

/**
 * @import { Field } from '$lib/types/public';
 * @import {
 * ConfigParserCollectors,
 * ConfigParserContext,
 * FieldParserArgs,
 * } from '$lib/types/private';
 */

/**
 * Parsers for each field type, keyed by field type. The built-in parsers are registered by the
 * `fields` index module rather than imported here, because the List and Object field parsers
 * recurse into their subfields with {@link parseFields}: importing them from this module would make
 * the module graph circular.
 * @type {Record<string, (args: FieldParserArgs) => void>}
 */
export const fieldParsers = {};

/**
 * Parse and validate a single field configuration.
 * @param {FieldParserArgs} args Arguments.
 */
export const parseFieldConfig = (args) => {
  const { config, context } = args;
  const { name, widget: fieldType = 'string' } = config;
  const { typedKeyPath } = context;

  const newArgs = {
    ...args,
    context: {
      ...context,
      typedKeyPath: typedKeyPath ? `${typedKeyPath}.${name}` : name,
    },
  };

  // A field type that isn’t built in is a custom one. It’s parsed whether or not it has been
  // registered, because the registration itself isn’t the parser’s concern.
  const isBuiltIn = /** @type {string[]} */ (BUILTIN_FIELD_TYPES).includes(fieldType);
  const parser = fieldParsers[fieldType] ?? (isBuiltIn ? undefined : parseCustomFieldConfig);

  parser?.(newArgs);

  if (fieldType === 'date') {
    addMessage({ ...newArgs, strKey: 'date_field_type' });
  }
};

/**
 * Parse and validate multiple field configurations.
 * @param {Field[]} fields Array of field configs to parse.
 * @param {ConfigParserContext} context Context.
 * @param {ConfigParserCollectors} collectors Collectors.
 */
export const parseFields = (fields, context, collectors) => {
  const checkNameArgs = { nameCounts: {}, strKeyBase: 'field_name', context, collectors };

  fields?.forEach((config, index) => {
    const { name } = config;

    if (checkName({ ...checkNameArgs, name, index })) {
      parseFieldConfig({ config, context, collectors });
    }
  });
};
