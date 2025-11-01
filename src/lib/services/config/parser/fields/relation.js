/* eslint-disable camelcase */

/**
 * @import { RelationField } from '$lib/types/public';
 * @import { FieldParserArgs } from '$lib/types/private';
 */

/**
 * Parse and validate a Relation field configuration.
 * @param {FieldParserArgs} args Arguments.
 */
export const parseRelationFieldConfig = ({ fieldConfig, context, collectors }) => {
  // Collect relation information for later processing
  collectors.relationFields.add({
    // eslint-disable-next-line object-shorthand
    fieldConfig: /** @type {RelationField} */ (fieldConfig),
    context,
  });
};
