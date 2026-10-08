import { sanitize } from 'isomorphic-dompurify';
import { Marked } from 'marked';
import { parseEntities } from 'parse-entities';

/**
 * Remove some inline Markdown syntax from the given string. This covers bold, italic, strikethrough
 * and code. This function does not remove single characters like the `_` prefix in `_redirects`.
 * @param {string} str Original string.
 * @returns {string} Modified string.
 */
export const removeMarkdownSyntax = (str) => {
  let result = str;
  let changed = true;

  // Keep processing until no more changes are made to handle nested cases
  while (changed) {
    const before = result;

    // Process from innermost to outermost by trying single character patterns first
    result = result.replaceAll(/([_*`~])([^_*`~]+)\1/g, '$2');

    // Then handle multi-character patterns (like ** or __ or ~~). The delimiter is capped at three
    // characters: with an unbounded run, a long stretch of mixed delimiters without a closing run,
    // e.g. `*_*_*_…`, tries every run length against the rest of the string, which takes minutes
    // on a title of a few dozen kilobytes. A longer run, e.g. `****`, is removed over several
    // passes of the loop instead.
    result = result.replaceAll(/([_*`~]{2,3})(.+?)\1/g, '$2');

    changed = result !== before;
  }

  return result;
};

/**
 * Private Markdown parser for {@link stripMarkdown}, which is unaffected by the extensions a site
 * adds to the shared `window.marked` instance, e.g. an async one that makes `parse()` return a
 * `Promise`.
 */
const markdownParser = new Marked();

/**
 * Line breaks, thematic breaks and the end tags of block elements, which separate words without any
 * whitespace in HTML, e.g. `<p>First</p><p>Second</p>`.
 */
const HTML_BLOCK_BOUNDARY_REGEX = new RegExp(
  '<(?:br|hr)\\b[^>]*>|</(?:address|article|aside|blockquote|caption|dd|details|div|dl|dt|' +
    'figcaption|figure|footer|h[1-6]|header|li|main|nav|ol|p|pre|section|summary|table|tbody|td|' +
    'tfoot|th|thead|tr|ul)\\s*>',
  'gi',
);

/**
 * Convert the given Markdown or HTML string to plain text by removing the Markdown syntax and HTML
 * tags, e.g. to show a Rich Text field value in a summary. Line breaks are collapsed into spaces.
 * @param {string} str Original string.
 * @returns {string} Plain text.
 */
export const stripMarkdown = (str) => {
  const html = /** @type {string} */ (markdownParser.parse(str)).replaceAll(
    HTML_BLOCK_BOUNDARY_REGEX,
    '$& ',
  );

  return parseEntities(sanitize(html, { ALLOWED_TAGS: [] }))
    .replaceAll(/\s+/g, ' ')
    .trim();
};
