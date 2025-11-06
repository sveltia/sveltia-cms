import { parseFields } from '$lib/services/config/parser/fields';
import { checkDuplicateNames } from '$lib/services/config/parser/utils/messages';

/**
 * @import { ObjectField } from '$lib/types/public';
 * @import { FieldParserArgs } from '$lib/types/private';
 */

/**
 * Parse and validate an Object field configuration.
 * @param {FieldParserArgs} args Arguments.
 */
export const parseObjectFieldConfig = (args) => {
  const { config, context, collectors } = args;
  const { fields: subfields, types } = /** @type {ObjectField} */ (config);
  const { typedKeyPath } = context;
  /** @type {Record<string, number>} */
  const nameCounts = {};

  // Handle subfields
  if (subfields) {
    parseFields(subfields, context, collectors);
  }

  // Handle variable types
  types?.forEach(({ name: type, fields: typedFields }) => {
    nameCounts[type] = (nameCounts[type] ?? 0) + 1;

    if (typedFields) {
      parseFields(
        typedFields,
        { ...context, typedKeyPath: `${typedKeyPath}<${type}>` },
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
