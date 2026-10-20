import { highlightCodeToHTML } from '@sveltia/ui';
import { use } from 'marked';
import markedBidi from 'marked-bidi';

/**
 * @import { Tokens } from 'marked';
 */

/**
 * Whether {@link addMarkedExtensions} has added the extensions.
 */
let extensionsAdded = false;

/**
 * Render a code block with syntax highlighting using Shiki. This is done in the renderer to ensure
 * it runs before sanitization, allowing the highlighted HTML to be preserved in the preview. Shiki
 * loads its engine and grammars on demand, so this returns nothing until the language is ready;
 * the preview fetches it with `loadCodeHighlighter()` and renders the block again.
 * @param {Tokens.Code} token Code token.
 * @returns {string | false} Highlighted HTML, or `false` to fall back to the default renderer.
 */
export const renderCode = ({ text, lang }) =>
  (lang ? highlightCodeToHTML(text, lang) : undefined) ?? false;

/**
 * Add the extensions the RichText field preview needs to the shared Marked instance: `dir="auto"`
 * on the text blocks for bidirectional text, and syntax highlighting for the code blocks. They’re
 * added only once, as `use()` adds another layer on every call, and the shared instance outlives
 * any preview: adding them for each preview would make every code block go through one renderer
 * per preview ever rendered, until the stack overflows. The instance is shared rather than private,
 * so the extensions a site adds with `window.marked.use()` also apply to the preview.
 */
export const addMarkedExtensions = () => {
  if (extensionsAdded) {
    return;
  }

  extensionsAdded = true;
  use(markedBidi(), { renderer: { code: renderCode } });
};
