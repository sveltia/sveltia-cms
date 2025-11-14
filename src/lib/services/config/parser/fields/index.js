import { parseDateTimeFieldConfig } from '$lib/services/config/parser/fields/datetime';
import { parseFileFieldConfig } from '$lib/services/config/parser/fields/file';
import { parseListFieldConfig } from '$lib/services/config/parser/fields/list';
import { parseMarkdownFieldConfig } from '$lib/services/config/parser/fields/markdown';
import { parseNumberFieldConfig } from '$lib/services/config/parser/fields/number';
import { parseObjectFieldConfig } from '$lib/services/config/parser/fields/object';
import { parseRelationFieldConfig } from '$lib/services/config/parser/fields/relation';
import { addMessage, checkName } from '$lib/services/config/parser/utils/messages';

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
  datetime: parseDateTimeFieldConfig,
  file: parseFileFieldConfig,
  image: parseFileFieldConfig, // alias
  list: parseListFieldConfig,
  markdown: parseMarkdownFieldConfig,
  number: parseNumberFieldConfig,
  object: parseObjectFieldConfig,
  relation: parseRelationFieldConfig,
};

/**
 * Parse and validate a single field configuration.
 * @param {FieldParserArgs} args Arguments.
 */
export const parseFieldConfig = (args) => {
  const { config, context } = args;
  const { name, widget = 'string' } = config;
  const { typedKeyPath } = context;

  const newArgs = {
    ...args,
    context: {
      ...context,
      typedKeyPath: typedKeyPath ? `${typedKeyPath}.${name}` : name,
    },
  };

  parsers[widget]?.(newArgs);

  if (widget === 'date') {
    addMessage({ ...newArgs, strKey: 'date_widget' });
  }
};

/**
 * Parse and validate multiple field configurations.
 * @param {Field[]} fields Array of field configs to parse.
 * @param {ConfigParserContext} context Context.
 * @param {ConfigParserCollectors} collectors Collectors.
 */
export const parseFields = (fields, context, collectors) => {
  const checkNameArgs = { nameCounts: {}, strKeyBase: 'field_name' };

  fields?.forEach((config, index) => {
    const { name } = config;

    if (checkName({ ...checkNameArgs, name, index, context, collectors })) {
      parseFieldConfig({ config, context, collectors });
    }
  });
};
