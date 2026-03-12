import { GLOBAL_IMAGE_REGEX } from '$lib/services/contents/fields/rich-text/constants';

/**
 * @import { ReactElement } from 'react';
 * @import { EditorComponentDefinition } from '$lib/types/public';
 */

/**
 * @typedef {string | ReactElement | undefined} ComponentPreview
 */

/**
 * Sanitization options for DOMPurify to allow `blob` URLs for images, which are commonly used for
 * local previews of uploaded images. Also allow `iframe` tags with `allow` and `allowfullscreen`
 * attributes for embedded media previews.
 * @see https://github.com/cure53/DOMPurify/issues/549
 * @see https://github.com/cure53/DOMPurify#control-permitted-attribute-values.
 * @see https://github.com/cure53/DOMPurify/wiki/Default-TAGs-ATTRIBUTEs-allow-list-&-blocklist
 */
export const SANITIZE_OPTIONS = {
  ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|blob):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  ADD_TAGS: ['iframe'],
  ADD_ATTR: ['allow', 'allowfullscreen'],
};

/**
 * Selector for finding component placeholder elements in the rendered HTML, used by the
 * `MutationObserver` to identify where to render React element previews.
 */
export const COMPONENT_QUERY_SELECTOR = 'span[data-component-key]';

/**
 * Selector for finding unprocessed images in the rendered HTML, used by the `MutationObserver` to
 * identify images that need to be processed (e.g. Converted to `blob` URLs for local previews). The
 * `data-processed` attribute is added to images that have already been processed to avoid
 * reprocessing on subsequent mutations.
 */
export const IMAGE_QUERY_SELECTOR = 'img[src]:not([data-processed])';

/**
 * A simple FNV-1a 32-bit hash of a string, returned as a hex string. Used to produce stable, short,
 * attribute-safe keys from matched component text.
 * @param {string} str The string to hash.
 * @returns {string} Lowercase hex hash string.
 */
const hashString = (str) => {
  /* eslint-disable no-bitwise */
  const hash = Array.from(str).reduce(
    (h, ch) => (((h ^ ch.charCodeAt(0)) >>> 0) * 0x01000193) >>> 0,
    0x811c9dc5,
  );
  /* eslint-enable no-bitwise */

  return hash.toString(16);
};

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
            let tagRegexes = htmlTagRegexCache.get(tag);

            if (!tagRegexes) {
              tagRegexes = {
                openRe: new RegExp(`<${tag}(?:[\\s>])`, 'gi'),
                closeRe: new RegExp(`<\\/${tag}>`, 'gi'),
              };
              htmlTagRegexCache.set(tag, tagRegexes);
            }

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
 * Encode image URLs in Markdown to ensure spaces are properly handled.
 * E.g. `![alt](my image.png)` -> `![alt](my%20image.png)`.
 * @param {...any} args Arguments from the regex match.
 * @returns {string} The encoded image Markdown string.
 * @see https://github.com/markedjs/marked/issues/1639
 */
export const encodeImageSrc = (...args) => {
  const { alt, src, title } = args.at(-1);
  const eSrc = src.replaceAll(' ', '%20');

  return title ? `![${alt}](${eSrc} "${title}")` : `![${alt}](${eSrc})`;
};

/**
 * Cache for global-flag versions of component definition patterns. Keyed by
 * `${pattern.source}|${pattern.flags}` so the same logical pattern always resolves to the same
 * global `RegExp`, even if the pattern object is recreated across reactive evaluations.
 * @type {Map<string, RegExp>}
 */
const globalPatternCache = new Map();

/**
 * Process a Markdown string by extracting editor component instances, computing their previews and
 * replacing each match with a placeholder `<span>` keyed to the preview map.
 * @param {string | undefined} currentValue The raw Markdown field value.
 * @param {EditorComponentDefinition[]} componentDefs The resolved component definitions.
 * @returns {{ markdown: string, previewMap: Map<string, ComponentPreview> }} The processed Markdown
 * string and a map of component keys to their precomputed preview values.
 */
export const buildMarkdownWithPreviews = (currentValue, componentDefs) => {
  /** @type {Map<string, ComponentPreview>} */
  const previewMap = new Map();
  let string = (currentValue ?? '').replace(GLOBAL_IMAGE_REGEX, encodeImageSrc);

  componentDefs.forEach(({ pattern, fromBlock, toPreview }) => {
    const patternCacheKey = `${pattern.source}|${pattern.flags}`;
    let globalPattern = globalPatternCache.get(patternCacheKey);

    if (!globalPattern) {
      globalPattern = pattern.global ? pattern : new RegExp(pattern.source, `${pattern.flags}g`);
      globalPatternCache.set(patternCacheKey, globalPattern);
    }

    /** @type {string[]} */
    const keys = [];
    /** @type {Map<string, number>} */
    const seenHashes = new Map();

    // Extract the component data and cache the preview for each instance of the component
    string.matchAll(globalPattern).forEach((match) => {
      const baseHash = hashString(match[0]);
      const count = seenHashes.get(baseHash) ?? 0;
      const key = count === 0 ? baseHash : `${baseHash}-${count}`;
      const fieldProps = fromBlock?.(match) ?? match.groups ?? {};

      keys.push(key);
      seenHashes.set(baseHash, count + 1);
      previewMap.set(key, toPreview?.(fieldProps));
    });

    // Replace the component syntax with a direct preview string or placeholder, depending on the
    // type of the preview value. This allows simple text previews to be rendered directly without
    // needing the `MutationObserver` to find and replace a placeholder element, while still
    // supporting complex React element previews.
    string = string.replaceAll(globalPattern, () => {
      const key = keys.shift();
      const preview = key ? previewMap.get(key) : undefined;

      if (typeof preview === 'string') {
        return preview;
      }

      // Return a placeholder element with a unique key that can be used by the `MutationObserver`
      // to find the correct location to render the React element preview.
      return `<span data-component-key="${key}"></span>`;
    });
  });

  return { markdown: string, previewMap };
};
