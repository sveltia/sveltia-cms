import { customComponentRegistry } from '$lib/services/api/registries';
import { addMessage, checkUnsupportedOptions } from '$lib/services/config/parser/utils/validator';
import { isInlinePatternComponent } from '$lib/services/contents/fields/rich-text/components/inline-pattern';
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
 * Buttons that format a whole block, which a single-line field can’t use. An unknown button name
 * is reported against the JSON schema instead.
 */
const BLOCK_BUTTONS = [
  'heading-one',
  'heading-two',
  'heading-three',
  'heading-four',
  'heading-five',
  'heading-six',
  'quote',
  'bulleted-list',
  'numbered-list',
  'align',
];

/**
 * Built-in editor components that are blocks, which a single-line field can’t hold.
 */
const BLOCK_COMPONENTS = ['code-block', 'table', 'hr'];

/**
 * Check whether the given editor component is a block, which a single-line field can’t hold. A
 * custom component is one unless it’s matched within a paragraph; an unknown one isn’t reported
 * here.
 * @param {string} name Component name.
 * @returns {boolean} Result.
 */
const isBlockComponent = (name) => {
  if (BLOCK_COMPONENTS.includes(name)) {
    return true;
  }

  const definition = customComponentRegistry.get(name);

  return (
    !!definition &&
    !isInlinePatternComponent(definition) &&
    !isInlineComponentDef(/** @type {any} */ (definition))
  );
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
