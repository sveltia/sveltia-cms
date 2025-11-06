import { parseFieldConfig, parseFields } from '$lib/services/config/parser/fields';
import { checkDuplicateNames } from '$lib/services/config/parser/utils/messages';

/**
 * @import { ListField } from '$lib/types/public';
 * @import { FieldParserArgs } from '$lib/types/private';
 */

/**
 * Parse and validate a List field configuration.
 * @param {FieldParserArgs} args Arguments.
 */
export const parseListFieldConfig = (args) => {
  const { config, context, collectors } = args;
  const { field: subfield, fields: subfields, types } = /** @type {ListField} */ (config);
  const { typedKeyPath } = context;
  /** @type {Record<string, number>} */
  const nameCounts = {};

  // Handle single subfield
  if (subfield) {
    parseFieldConfig({
      config: subfield,
      context: { ...context, typedKeyPath: `${typedKeyPath}.*` },
      collectors,
    });
  }

  // Handle subfields
  if (subfields) {
    parseFields(subfields, { ...context, typedKeyPath: `${typedKeyPath}.*` }, collectors);
  }

  // Handle variable types
  types?.forEach(({ name: type, fields: typedFields }) => {
    nameCounts[type] = (nameCounts[type] ?? 0) + 1;

    if (typedFields) {
      parseFields(
        typedFields,
        { ...context, typedKeyPath: `${typedKeyPath}.*<${type}>` },
        collectors,
      );
    }
  });

  checkDuplicateNames({
    nameCounts,
    strKey: 'duplicate_variable_type',
    context,
    collectors,
  });
};
