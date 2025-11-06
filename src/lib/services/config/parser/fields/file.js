/* eslint-disable camelcase */

import { checkUnsupportedOptions } from '$lib/services/config/parser/utils/messages';

/**
 * @import { FileField } from '$lib/types/public';
 * @import { FieldParserArgs, UnsupportedOption } from '$lib/types/private';
 */

/**
 * Unsupported options for Number fields.
 * @type {UnsupportedOption[]}
 */
const UNSUPPORTED_OPTIONS = [
  { prop: 'allow_multiple', newProp: 'multiple', strKey: 'allow_multiple' },
];

/**
 * Parse and validate a File field configuration.
 * @param {FieldParserArgs} args Arguments.
 */
export const parseFileFieldConfig = (args) => {
  const { config, context, collectors } = args;
  const { media_folder } = /** @type {FileField} */ (config);

  // Collect media folder information for later processing
  if (media_folder !== undefined) {
    collectors.mediaFields.add({
      fieldConfig: /** @type {FileField} */ (config),
      context,
    });
  }

  checkUnsupportedOptions({ ...args, UNSUPPORTED_OPTIONS });
};
