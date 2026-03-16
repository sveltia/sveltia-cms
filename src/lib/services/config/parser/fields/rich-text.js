import { checkUnsupportedOptions } from '$lib/services/config/parser/utils/validator';

/**
 * @import { FieldParserArgs, UnsupportedOption } from '$lib/types/private';
 */

/**
 * Unsupported options for RichText fields.
 * @type {UnsupportedOption[]}
 */
const UNSUPPORTED_OPTIONS = [
  // Deprecated camelCase option in Netlify/Decap CMS config, should be converted to snake_case.
  { prop: 'editorComponents', newProp: 'editor_components' },
];

/**
 * Parse and validate a RichText field configuration.
 * @param {FieldParserArgs} args Arguments.
 */
export const parseRichTextFieldConfig = (args) => {
  checkUnsupportedOptions({ ...args, UNSUPPORTED_OPTIONS });
};
