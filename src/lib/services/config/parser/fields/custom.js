/**
 * @import { FieldParserArgs } from '$lib/types/private';
 * @import { CustomField } from '$lib/types/public';
 */

/**
 * Parse a field configuration using a custom field type registered with `CMS.registerFieldType()`.
 * The options such a field accepts are validated against the registered schema, so the parser has
 * nothing to check. A custom field control can still add files to the entry draft with the
 * `addFile` prop, though, and those files go to the field’s own `media_folder` if it has one, so
 * the option is collected the same way as for a File/Image field.
 * @param {FieldParserArgs} args Arguments.
 */
export const parseCustomFieldConfig = ({ config, context, collectors }) => {
  const { media_folder: mediaFolder } = /** @type {CustomField} */ (config);

  if (mediaFolder !== undefined) {
    collectors.mediaFields.add({ fieldConfig: /** @type {CustomField} */ (config), context });
  }
};
