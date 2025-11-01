/* eslint-disable camelcase */

/**
 * @import { FileField } from '$lib/types/public';
 * @import { FieldParserArgs } from '$lib/types/private';
 */

/**
 * Parse and validate a File field configuration.
 * @param {FieldParserArgs} args Arguments.
 */
export const parseFileFieldConfig = ({ fieldConfig, context, collectors }) => {
  const { media_folder } = /** @type {FileField} */ (fieldConfig);

  // Collect media folder information for later processing
  if (media_folder !== undefined) {
    collectors.mediaFields.add({
      // eslint-disable-next-line object-shorthand
      fieldConfig: /** @type {FileField} */ (fieldConfig),
      context,
    });
  }
};
