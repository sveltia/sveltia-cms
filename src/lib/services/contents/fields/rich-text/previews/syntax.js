/**
 * @typedef {[start: number, end: number]} TextRange A range of a string, with an exclusive end.
 */

/**
 * Regex to match the opening line of a fenced code block, capturing the fence. It allows any
 * indentation, so a fence within a list item counts as well; a fence indented further is within an
 * indented code block, which is code anyway.
 */
const FENCE_OPEN_REGEX = /^([ \t]*)(`{3,}|~{3,})(.*)$/;
/**
 * Regex to match a run of backticks.
 */
const BACKTICKS_REGEX = /`+/g;
/**
 * Regex to match a blank line, which ends a paragraph and therefore a code span.
 */
const BLANK_LINE_REGEX = /\n[ \t]*\n/;

/**
 * Regex to match the start of an HTML block that ends at a blank line: a block-level tag, which can
 * interrupt a paragraph (type 6 in CommonMark). The tag names are the ones Marked recognizes.
 * @see https://spec.commonmark.org/0.31.2/#html-blocks
 */
const BLOCK_TAG_REGEX = new RegExp(
  '^ {0,3}</?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|' +
    'dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|' +
    'h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|' +
    'optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|' +
    'ul)(?:[ \\t]|/?>|$)',
  'i',
);

/**
 * Regex to match the start of an HTML block that ends at a blank line: a line with nothing but an
 * opening or closing tag of any other element, which cannot interrupt a paragraph (type 7).
 */
const LONE_TAG_REGEX =
  /^ {0,3}(?:<(?!(?:pre|script|style|textarea)[\s/>])[a-z][a-z\d-]*(?:[ \t]+[a-z_:][\w.:-]*(?:[ \t]*=[ \t]*(?:[^\s"'=<>`]+|'[^']*'|"[^"]*"))?)*[ \t]*\/?>|<\/[a-z][a-z\d-]*[ \t]*>)[ \t]*$/i;

/**
 * Check if the character at the given index is escaped with a backslash, which is itself not
 * escaped.
 * @param {string} text Text.
 * @param {number} index Index of the character.
 * @param {number} from Index to look for backslashes from.
 * @returns {boolean} Result.
 */
const isEscaped = (text, index, from) => {
  let count = 0;

  while (index - count > from && text[index - count - 1] === '\\') {
    count += 1;
  }

  return count % 2 === 1;
};

/**
 * Get the ranges of the fenced code blocks and code spans in the given Markdown, where any other
 * syntax is literal text. Indented code blocks are not detected, as an indented line can also be
 * the continuation of a list item.
 * @param {string} markdown Markdown.
 * @returns {TextRange[]} Ranges, sorted by position.
 * @see https://spec.commonmark.org/0.31.2/#fenced-code-blocks
 * @see https://spec.commonmark.org/0.31.2/#code-spans
 */
export const getCodeRanges = (markdown) => {
  /** @type {TextRange[]} */
  const ranges = [];
  /** @type {{ start: number, char: string, length: number } | undefined} */
  let fence;
  /** Start of the text outside fences that hasn’t been searched for code spans yet. */
  let textStart = 0;
  let lineStart = 0;

  /**
   * Add the code spans in the given part of the Markdown.
   * @param {number} start Start index.
   * @param {number} end End index.
   */
  const addCodeSpans = (start, end) => {
    const text = markdown.slice(start, end);
    const runs = [...text.matchAll(BACKTICKS_REGEX)];
    let cursor = 0;

    runs.forEach(({ 0: run, index }, runIndex) => {
      // Skip a run within a code span found already, or one escaped with a backslash
      if (index < cursor || isEscaped(text, index, cursor)) {
        return;
      }

      // A code span ends with the next run of the same length, within the same paragraph
      const closing = runs.find((r, i) => i > runIndex && r[0].length === run.length);

      if (closing && !BLANK_LINE_REGEX.test(text.slice(index, closing.index))) {
        cursor = closing.index + run.length;
        ranges.push([start + index, start + cursor]);
      }
    });
  };

  markdown.split('\n').forEach((line) => {
    const lineEnd = lineStart + line.length;

    if (fence) {
      const closing = line.trim();

      if (
        closing.startsWith(fence.char.repeat(fence.length)) &&
        closing === fence.char.repeat(closing.length)
      ) {
        ranges.push([fence.start, lineEnd]);
        fence = undefined;
        textStart = lineEnd;
      }
    } else {
      const [, indent = '', run = '', info = ''] = line.match(FENCE_OPEN_REGEX) ?? [];

      // The info string of a backtick fence cannot contain a backtick. The range starts with the
      // fence, so a component matching the fenced block from there isn’t taken for code
      if (run && !(run[0] === '`' && info.includes('`'))) {
        addCodeSpans(textStart, lineStart);
        fence = { start: lineStart + indent.length, char: run[0], length: run.length };
      }
    }

    lineStart = lineEnd + 1;
  });

  if (fence) {
    // An unclosed fence runs to the end
    ranges.push([fence.start, markdown.length]);
  } else {
    addCodeSpans(textStart, markdown.length);
  }

  return ranges.sort(([a], [b]) => a - b);
};

/**
 * Check if the given index is within any of the given ranges, after their start.
 * @param {number} index Index.
 * @param {TextRange[]} ranges Ranges.
 * @returns {boolean} Result.
 */
export const isWithinRanges = (index, ranges) =>
  ranges.some(([start, end]) => index > start && index < end);

/**
 * Check if the given line starts an HTML block that runs until a blank line.
 * @param {string} line Line.
 * @param {object} [options] Options.
 * @param {boolean} [options.afterParagraph] Whether the line follows a paragraph line, which only a
 * block-level tag can interrupt.
 * @returns {boolean} Result.
 */
export const startsHTMLBlock = (line, { afterParagraph = false } = {}) =>
  BLOCK_TAG_REGEX.test(line) || (!afterParagraph && LONE_TAG_REGEX.test(line));

/**
 * Check if the line at the given index is within an HTML block that runs until a blank line, as one
 * of the lines before it, since the previous blank line, starts such a block.
 * @param {string} markdown Markdown.
 * @param {number} lineStart Index of the start of the line.
 * @returns {boolean} Result.
 */
export const isWithinHTMLBlock = (markdown, lineStart) => {
  const lines = markdown.slice(0, Math.max(0, lineStart - 1)).split('\n');
  const runStart = lines.findLastIndex((line) => !line.trim()) + 1;

  return lines
    .slice(runStart)
    .some((line, index) => startsHTMLBlock(line, { afterParagraph: index > 0 }));
};
