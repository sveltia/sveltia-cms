import { checkUnsupportedOptions } from '$lib/services/config/parser/utils/messages';

/**
 * @import { FieldParserArgs, UnsupportedOption } from '$lib/types/private';
 */

/**
 * Unsupported options for Markdown fields.
 * @type {UnsupportedOption[]}
 */
const UNSUPPORTED_OPTIONS = [{ prop: 'editorComponents', newProp: 'editor_components' }];

/**
 * Parse and validate a Markdown field configuration.
 * @param {FieldParserArgs} args Arguments.
 */
export const parseMarkdownFieldConfig = (args) => {
  checkUnsupportedOptions({ ...args, UNSUPPORTED_OPTIONS });
};
