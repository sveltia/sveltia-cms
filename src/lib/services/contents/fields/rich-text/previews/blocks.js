import { getOrCreate } from '$lib/services/utils/cache';
import { escapeHTML } from '$lib/services/utils/string';

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
 * Regex to detect the opening line of a fenced code block (backtick or tilde fence).
 */
const FENCE_OPEN_REGEX = /^[ ]{0,3}(`{3,}|~{3,})/;
/**
 * Regex to detect a line that opens an HTML block element, capturing the tag name.
 */
const HTML_OPEN_TAG_REGEX = /^<([a-zA-Z][a-zA-Z0-9]*)(?:[\s>])/;
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
 * Split a Markdown string into logical blocks at blank lines, keeping fenced code blocks (backtick
 * or tilde fences) and HTML block elements (e.g. `<div>`) intact even when they contain blank
 * lines.
 * @param {string} markdown The full Markdown string.
 * @returns {string[]} Array of non-empty block strings.
 */
export const splitMarkdownBlocks = (markdown) => {
  if (!markdown) return [];

  /** @type {string[]} */
  const blocks = [];
  /** @type {string[]} */
  const current = [];
  /** @type {{ char: string, length: number } | null} */
  let fence = null;
  /** @type {{ tag: string, depth: number, openRe: RegExp, closeRe: RegExp } | null} */
  let htmlBlock = null;

  markdown.split('\n').forEach((line) => {
    if (fence) {
      current.push(line);

      // Closing fence: same char, at most 3 leading spaces, no trailing content
      const stripped = line.trimStart();

      if (
        line.length - stripped.length <= 3 &&
        stripped.startsWith(fence.char.repeat(fence.length)) &&
        !/\S/.test(stripped.slice(fence.length))
      ) {
        fence = null;
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
      const fenceMatch = FENCE_OPEN_REGEX.exec(line);

      if (fenceMatch) {
        current.push(line);
        fence = { char: fenceMatch[1][0], length: fenceMatch[1].length };
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
          if (current.length) {
            blocks.push(current.splice(0).join('\n'));
          }
        } else {
          current.push(line);
        }
      }
    }
  });

  if (current.length) blocks.push(current.join('\n'));

  return blocks;
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
 * Get the languages of the fenced code blocks in the given Markdown.
 * @param {string} markdown Markdown.
 * @returns {string[]} Unique language names, sorted.
 */
export const getFencedCodeLanguages = (markdown) =>
  [...markdown.matchAll(/^ {0,3}```(\S+)/gm)]
    .map(([, lang]) => lang)
    .filter((lang, index, list) => list.indexOf(lang) === index)
    .sort();
