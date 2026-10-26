import { addMessage, checkUnsupportedOptions } from '$lib/services/config/parser/utils/validator';
import {
  BUTTON_COMPONENTS,
  DEFAULT_BUTTONS,
  INLINE_BUTTONS,
} from '$lib/services/contents/fields/rich-text';
import { getComponentDef } from '$lib/services/contents/fields/rich-text/components/definitions';
import { isInlineComponentDef } from '$lib/services/contents/fields/rich-text/components/utils';

/**
 * @import { FieldParserArgs, UnsupportedOption } from '$lib/types/private';
 * @import { MarkdownField, RichTextField } from '$lib/types/public';
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
 * Buttons that format a whole block, which a single-line field can’t use: all the buttons but the
 * inline ones, including `align`, which isn’t enabled by default. An unknown button name is
 * reported against the JSON schema instead.
 * @type {string[]}
 */
const BLOCK_BUTTONS = [
  ...DEFAULT_BUTTONS.filter((name) => !INLINE_BUTTONS.includes(name)),
  'align',
];

/**
 * Check whether the given editor component is a block, which a single-line field can’t hold. The
 * built-in ones implemented as buttons are, while any other one is unless its resolved definition
 * is matched within a paragraph, as a pattern-based inline component or the built-in `image` is.
 * An unknown component isn’t reported here.
 * @param {string} name Component name.
 * @returns {boolean} Result.
 */
const isBlockComponent = (name) => {
  if (/** @type {string[]} */ (BUTTON_COMPONENTS).includes(name)) {
    return true;
  }

  const definition = getComponentDef(name);

  return !!definition && !isInlineComponentDef(definition);
};

/**
 * Warn about the block-level buttons and editor components listed for a single-line field, which
 * the editor leaves out, as it only holds inline content.
 * @param {FieldParserArgs} args Arguments.
 */
const checkSingleLineOptions = ({ config, context, collectors }) => {
  const {
    multiline = context.cmsConfig?.field_defaults?.richtext?.multiline ?? true,
    buttons,
    editor_components: editorComponents,
  } = /** @type {MarkdownField | RichTextField} */ (config);

  if (multiline !== false) {
    return;
  }

  /**
   * Each option with its listed names, and the check for a block-level item.
   * @type {[string, string[] | undefined, (name: string) => boolean][]}
   */
  const options = [
    ['buttons', buttons, (name) => BLOCK_BUTTONS.includes(name)],
    ['editor_components', editorComponents, isBlockComponent],
  ];

  options.forEach(([option, names, isBlock]) => {
    if (!Array.isArray(names)) {
      return;
    }

    names.filter(isBlock).forEach((name) => {
      addMessage({
        type: 'warning',
        strKey: 'single_line_block_item',
        values: { option, name },
        context,
        collectors,
      });
    });
  });
};

/**
 * Parse and validate a RichText field configuration.
 * @param {FieldParserArgs} args Arguments.
 */
export const parseRichTextFieldConfig = (args) => {
  checkUnsupportedOptions({ ...args, UNSUPPORTED_OPTIONS });
  checkSingleLineOptions(args);
};
