import { lexer } from 'marked';

import {
  isFenceClose,
  matchFenceOpen,
} from '$lib/services/contents/fields/rich-text/previews/syntax';
import { getOrCreate } from '$lib/services/utils/cache';
import { escapeHTML } from '$lib/services/utils/string';

/**
 * @import { Token, Tokens } from 'marked';
 */

/**
 * HTML void elements that cannot have children or a closing tag. Used to avoid incorrectly
 * entering HTML block mode when a void element starts a line.
 * @see https://developer.mozilla.org/en-US/docs/Glossary/Void_element
 */
const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

/**
 * Match the opening line of a fenced code block at the top level, with at most 3 spaces before the
 * fence. A fence indented further is within an indented code block or a list item.
 * @param {string} line Line.
 * @returns {ReturnType<typeof matchFenceOpen>} Fence. See {@link matchFenceOpen}.
 */
const matchBlockFenceOpen = (line) => {
  const opening = matchFenceOpen(line);

  return opening && /^ {0,3}$/.test(opening.indent) ? opening : undefined;
};

/**
 * Regex to detect a line that opens an HTML block element, capturing the tag name.
 */
const HTML_OPEN_TAG_REGEX = /^<([a-zA-Z][a-zA-Z0-9]*)(?:[\s>])/;

/**
 * Starts of the HTML blocks that run until a line with the given end marker rather than a blank
 * line: raw text elements, comments, processing instructions, declarations and CDATA sections
 * (types 1 to 5 in CommonMark). The end marker can be on the same line.
 * @type {{ start: RegExp, end: RegExp }[]}
 * @see https://spec.commonmark.org/0.31.2/#html-blocks
 */
const RAW_HTML_BLOCKS = [
  {
    start: /^ {0,3}<(?:pre|script|style|textarea)(?:[\s>]|$)/i,
    end: /<\/(?:pre|script|style|textarea)>/i,
  },
  { start: /^ {0,3}<!--/, end: /-->/ },
  { start: /^ {0,3}<\?/, end: /\?>/ },
  { start: /^ {0,3}<![a-z]/i, end: />/ },
  { start: /^ {0,3}<!\[CDATA\[/, end: /\]\]>/ },
];

/**
 * Regex to detect a list item, whose content can continue after a blank line.
 */
const LIST_ITEM_REGEX = /^ {0,3}(?:[-+*]|\d{1,9}[.)])(?:[ \t]|$)/;
/**
 * @type {Map<string, { openRe: RegExp, closeRe: RegExp }>}
 */
const htmlTagRegexCache = new Map();

/**
 * Split an HTML string into its top-level nodes, so a preview only re-renders the nodes that have
 * changed, like {@link splitMarkdownBlocks} does for Markdown. Elements and text are kept,
 * including the whitespace between them, while comments are dropped.
 * @param {string} html The full HTML string.
 * @returns {string[]} Array of non-empty block strings.
 */
export const splitHTMLBlocks = (html) => {
  const template = document.createElement('template');

  template.innerHTML = html;

  return [...template.content.childNodes]
    .map((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        return /** @type {Element} */ (node).outerHTML;
      }

      return node.nodeType === Node.TEXT_NODE ? escapeHTML(/** @type {Text} */ (node).data) : '';
    })
    .filter(Boolean);
};

/**
 * Check if the given line opens a raw HTML block, which runs until its end marker, and the marker
 * is not on the same line.
 * @param {string} line Line.
 * @returns {RegExp | undefined} End marker regex, if the block continues on the next lines.
 */
const getRawHTMLBlockEnd = (line) => {
  const block = RAW_HTML_BLOCKS.find(({ start }) => start.test(line));

  return block && !block.end.test(line.replace(block.start, '')) ? block.end : undefined;
};

/**
 * Split a Markdown string into logical blocks at blank lines, keeping fenced code blocks (backtick
 * or tilde fences), HTML block elements (e.g. `<div>`), raw HTML blocks such as comments, and lists
 * whose items continue after a blank line intact even when they contain blank lines.
 * @param {string} markdown The full Markdown string.
 * @returns {string[]} Array of non-empty block strings.
 */
export const splitMarkdownBlocks = (markdown) => {
  if (!markdown) return [];

  const lines = markdown.split('\n');
  /** @type {string[]} */
  const blocks = [];
  /** @type {string[]} */
  const current = [];
  /** @type {{ char: string, length: number } | null} */
  let fence = null;
  /** @type {{ tag: string, depth: number, openRe: RegExp, closeRe: RegExp } | null} */
  let htmlBlock = null;
  /** @type {RegExp | undefined} */
  let rawHTMLBlockEnd;
  /** Whether the current block has a list item. */
  let inList = false;

  /**
   * Check if the next line with any text after the given line continues a list: an indented line,
   * which is part of the last item, or another item.
   * @param {number} index Index of a blank line.
   * @returns {boolean} Result.
   */
  const continuesList = (index) => {
    const nextLine = lines.find((line, i) => i > index && line.trim()) ?? '';

    return /^[ \t]/.test(nextLine) || LIST_ITEM_REGEX.test(nextLine);
  };

  lines.forEach((line, index) => {
    if (fence) {
      current.push(line);

      // A closing fence can have at most 3 leading spaces
      if (line.length - line.trimStart().length <= 3 && isFenceClose(line, fence)) {
        fence = null;
      }
    } else if (rawHTMLBlockEnd) {
      current.push(line);

      if (rawHTMLBlockEnd.test(line)) {
        rawHTMLBlockEnd = undefined;
      }
    } else if (htmlBlock) {
      current.push(line);

      // Reuse pre-compiled regexes stored when the block was opened (avoids two regex allocations
      // per line for potentially long HTML blocks).
      const { openRe, closeRe } = htmlBlock;

      htmlBlock.depth += [...line.matchAll(openRe)].length - [...line.matchAll(closeRe)].length;

      if (htmlBlock.depth <= 0) {
        htmlBlock = null;
      }
    } else {
      const fenceMatch = matchBlockFenceOpen(line);

      rawHTMLBlockEnd = fenceMatch ? undefined : getRawHTMLBlockEnd(line);

      if (fenceMatch) {
        current.push(line);
        fence = { char: fenceMatch.char, length: fenceMatch.length };
      } else if (rawHTMLBlockEnd) {
        current.push(line);
      } else {
        const htmlOpenMatch = HTML_OPEN_TAG_REGEX.exec(line);

        if (htmlOpenMatch) {
          const tag = htmlOpenMatch[1].toLowerCase();

          current.push(line);

          if (!VOID_ELEMENTS.has(tag)) {
            const tagRegexes = getOrCreate(htmlTagRegexCache, tag, () => ({
              openRe: new RegExp(`<${tag}(?:[\\s>])`, 'gi'),
              closeRe: new RegExp(`<\\/${tag}>`, 'gi'),
            }));

            const { openRe, closeRe } = tagRegexes;
            const depth = [...line.matchAll(openRe)].length - [...line.matchAll(closeRe)].length;

            if (depth > 0) {
              // Store the regexes in the block so subsequent lines reuse them.
              htmlBlock = { tag, depth, openRe, closeRe };
            }
          }
        } else if (line === '') {
          if (inList && continuesList(index)) {
            current.push(line);
          } else if (current.length) {
            blocks.push(current.splice(0).join('\n'));
            inList = false;
          }
        } else {
          current.push(line);
          inList ||= LIST_ITEM_REGEX.test(line);
        }
      }
    }
  });

  if (current.length) blocks.push(current.join('\n'));

  return blocks;
};

/**
 * Get the link reference definitions in the given Markdown blocks, e.g. `[1]: https://example.com`,
 * so they can be added to each block parsed on its own: a reference link and its definition are
 * usually in different blocks. The blocks that can have a definition are lexed, as a definition
 * can’t span blocks, so one is only found where Marked takes it for one, not in code for instance.
 * @param {string[]} blocks Blocks. See {@link splitMarkdownBlocks}.
 * @returns {string} The definitions, one per line, or an empty string if there are none.
 * @see https://spec.commonmark.org/0.31.2/#link-reference-definitions
 */
export const getLinkDefinitions = (blocks) => {
  /** @type {string[]} */
  const definitions = [];

  /**
   * Collect the definitions in the given tokens, including those in a blockquote or list item.
   * @param {Token[]} tokens Tokens.
   */
  const collect = (tokens) => {
    tokens.forEach((token) => {
      if (token.type === 'def') {
        definitions.push(token.raw.trim());
      } else if (token.type === 'list') {
        token.items.forEach((/** @type {Tokens.ListItem} */ item) => {
          collect(item.tokens);
        });
      } else if (token.type === 'blockquote') {
        collect(/** @type {Tokens.Blockquote} */ (token).tokens);
      }
    });
  };

  // A definition has a colon after its label
  blocks.filter((block) => block.includes(']:')).forEach((block) => collect(lexer(block)));

  return definitions.join('\n');
};

/**
 * Add the link reference definitions in the given blocks to the start of each block, so a
 * reference link is resolved wherever its definition is. A definition renders nothing. It comes
 * first, as a block can end within an unclosed fenced code block.
 * @param {string[]} blocks Blocks. See {@link splitMarkdownBlocks}.
 * @returns {string[]} Blocks.
 */
export const addLinkDefinitions = (blocks) => {
  const definitions = getLinkDefinitions(blocks);

  return definitions ? blocks.map((block) => `${definitions}\n\n${block}`) : blocks;
};

/**
 * A block of a rich text preview with its key.
 * @typedef {{ key: string, block: string }} KeyedBlock
 */

/**
 * Key the given blocks by content rather than by position: editing near the top of a long document
 * then only re-renders the block that changed, instead of every block after it. Identical blocks
 * are told apart by their occurrence. An unchanged block keeps its item object from the previous
 * run, so the block isn’t parsed again: a keyed `{#each}` would otherwise update every item with a
 * new object and render every block again.
 * @param {string[]} blocks Blocks.
 * @param {Map<string, KeyedBlock>} previousItems Items of the previous run by key.
 * @returns {{ list: KeyedBlock[], items: Map<string, KeyedBlock> }} Keyed blocks, and the same
 * items by key, to be passed as `previousItems` next time.
 */
export const keyBlocks = (blocks, previousItems) => {
  /** @type {Map<string, number>} */
  const occurrences = new Map();
  /** @type {Map<string, KeyedBlock>} */
  const items = new Map();

  const list = blocks.map((block) => {
    const occurrence = occurrences.get(block) ?? 0;
    const key = `${occurrence}\n${block}`;
    const item = previousItems.get(key) ?? { key, block };

    occurrences.set(block, occurrence + 1);
    items.set(key, item);

    return item;
  });

  return { list, items };
};

/**
 * Get the languages of the fenced code blocks in the given Markdown, with backtick or tilde fences.
 * @param {string} markdown Markdown.
 * @returns {string[]} Unique language names, sorted.
 */
export const getFencedCodeLanguages = (markdown) =>
  markdown
    .split('\n')
    .map((line) => /^[ \t]*([^\s`]+)/.exec(matchBlockFenceOpen(line)?.info ?? '')?.[1])
    .filter((lang) => lang !== undefined)
    .filter((lang, index, list) => list.indexOf(lang) === index)
    .sort();
