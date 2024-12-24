/**
 * The default `modes` property options.
 */
export const defaultModes = ['rich_text', 'raw'];

/**
 * Key is a name used in Netlify/Decap CMS, value is a name used in Sveltia UI.
 * @type {Record<string, import("@sveltia/ui").TextEditorMode>}
 */
export const modeNameMap = {
  rich_text: 'rich-text',
  raw: 'plain-text',
};

/**
 * The default `buttons` property options.
 */
export const defaultButtons = [
  'bold',
  'italic',
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
  'code-block', // Temporary
];

/**
 * Key is a name used in Netlify/Decap CMS, value is a name used in Sveltia UI.
 * @type {Record<string, import("@sveltia/ui").TextEditorInlineType |
 * import("@sveltia/ui").TextEditorBlockType>}
 */
export const buttonNameMap = {
  bold: 'bold',
  italic: 'italic',
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
  'code-block': 'code-block', // Temporary
};

/**
 * The default `editor_components` property options.
 */
export const defaultComponents = ['image'];

/**
 * Custom components registered using `CMS.registerEditorComponent`.
 * @type {EditorComponentConfiguration[]}
 */
export const registeredComponents = [];
