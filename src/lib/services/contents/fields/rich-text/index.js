import { cmsConfig } from '$lib/services/config';

/**
 * @import { TextEditorMode, TextEditorNodeType } from '@sveltia/ui';
 * @import {
 * MarkdownField,
 * RichTextEditorButtonName,
 * RichTextEditorComponentName,
 * RichTextEditorMode,
 * RichTextField,
 * RichTextValueFormat,
 * } from '$lib/types/public';
 */

/**
 * Regular expression to match the component name prefix in the key path, e.g. `body:c12:`.
 * @type {RegExp}
 */
export const COMPONENT_NAME_PREFIX_REGEX = /^.+?:\w+:/;

/**
 * Remove the component name prefix from a key path, e.g. `body:c12:src` → `src`, to look up
 * a rich text editor component’s field in the component definition. A key path without the prefix
 * is returned as is.
 * @param {string} keyPath Key path.
 * @returns {string} Key path without the prefix.
 */
export const stripComponentNamePrefix = (keyPath) =>
  keyPath.replace(COMPONENT_NAME_PREFIX_REGEX, '');

/**
 * The default `modes` property options.
 * @type {RichTextEditorMode[]}
 */
export const DEFAULT_MODES = ['rich_text', 'raw'];

/**
 * Key is a name used in Netlify/Decap CMS, value is a name used in Sveltia UI.
 * @type {Record<RichTextEditorMode, TextEditorMode>}
 */
export const NODE_NAME_MAP = {
  rich_text: 'rich-text',
  raw: 'plain-text',
};

/**
 * The default `buttons` property options. `align` is left out: it has to be enabled with the
 * `buttons` option.
 * @type {RichTextEditorButtonName[]}
 */
export const DEFAULT_BUTTONS = [
  'bold',
  'italic',
  'strikethrough',
  'code',
  'link',
  'heading-one',
  'heading-two',
  'heading-three',
  'heading-four',
  'heading-five',
  'heading-six',
  'bulleted-list',
  'numbered-list',
  'quote',
];

/**
 * Key is a name used in Netlify/Decap CMS, value is a name used in Sveltia UI. The built-in
 * `code-block`, `table` and `hr` components are implemented as buttons in Sveltia UI.
 * @type {Record<RichTextEditorButtonName | 'code-block' | 'table' | 'hr', TextEditorNodeType>}
 */
export const BUTTON_NAME_MAP = {
  bold: 'bold',
  italic: 'italic',
  strikethrough: 'strikethrough',
  code: 'code',
  link: 'link',
  'heading-one': 'heading-1',
  'heading-two': 'heading-2',
  'heading-three': 'heading-3',
  'heading-four': 'heading-4',
  'heading-five': 'heading-5',
  'heading-six': 'heading-6',
  'bulleted-list': 'bulleted-list',
  'numbered-list': 'numbered-list',
  quote: 'blockquote',
  align: 'align',
  'code-block': 'code-block',
  table: 'table',
  hr: 'horizontal-rule',
};

/**
 * Built-in editor component names enabled by default. `code-block` is a button in Sveltia CMS, but
 * it’s included here for consistency with the Netlify/Decap CMS API. The `table` and `hr`
 * components, also buttons, are left out: they have to be enabled with the `editor_components`
 * option.
 * @type {RichTextEditorComponentName[]}
 */
export const BUILTIN_COMPONENTS = ['code-block', 'image'];

/**
 * Get the format of the given field’s value, falling back to the `field_defaults.richtext` option.
 * Only the RichText field type supports the `format` option, as the Markdown field type, its alias,
 * always holds Markdown.
 * @param {MarkdownField | RichTextField} fieldConfig Field configuration.
 * @returns {RichTextValueFormat} Format.
 */
export const getValueFormat = (fieldConfig) => {
  if (fieldConfig.widget !== 'richtext') {
    return 'markdown';
  }

  const { format = cmsConfig.current?.field_defaults?.richtext?.format } = fieldConfig;

  return format === 'html' ? 'html' : 'markdown';
};
