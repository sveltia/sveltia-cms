/* eslint-disable camelcase */

import { parseMediaLibraries } from '$lib/services/config/parser/media-libraries';
import { checkUnsupportedOptions } from '$lib/services/config/parser/utils/validator';

/**
 * @import { FileField } from '$lib/types/public';
 * @import { FieldParserArgs, UnsupportedOption } from '$lib/types/private';
 */

/**
 * Unsupported options for Number fields.
 * @type {UnsupportedOption[]}
 */
const UNSUPPORTED_OPTIONS = [
  // Sveltia CMS doesn’t support the confusing option.
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

  parseMediaLibraries({ config, context, collectors });
  checkUnsupportedOptions({ ...args, UNSUPPORTED_OPTIONS });
};
