import { sanitize } from 'isomorphic-dompurify';

import { GLOBAL_IMAGE_REGEX } from '$lib/services/contents/fields/rich-text/constants';
import { getOrCreate } from '$lib/services/utils/cache';

/**
 * @import { ReactElement } from 'react';
 * @import { EditorComponentDefinition } from '$lib/types/public';
 */

/**
 * @typedef {string | HTMLElement | ReactElement | undefined} ComponentPreview
 */

/**
 * Sanitization options for DOMPurify to allow `blob` URLs for images, which are commonly used for
 * local previews of uploaded images. Also allow `iframe` tags with strict sandboxing for embedded
 * media previews.
 * @see https://github.com/cure53/DOMPurify/issues/549
 * @see https://github.com/cure53/DOMPurify#control-permitted-attribute-values.
 * @see https://github.com/cure53/DOMPurify/wiki/Default-TAGs-ATTRIBUTEs-allow-list-&-blocklist
 */
export const SANITIZE_OPTIONS = {
  ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|blob):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  ADD_TAGS: ['iframe'],
  ADD_ATTR: ['allow', 'allowfullscreen', 'referrerpolicy', 'sandbox'],
};

/**
 * Validate and secure an iframe element.
 * @param {HTMLIFrameElement} iframe The iframe element to validate.
 * @returns {boolean} `true` if the iframe is safe and should be kept, `false` if it should be
 * removed.
 */
const validateIframe = (iframe) => {
  const src = iframe.getAttribute('src')?.trim() || '';

  // Require HTTPS (blocks dangerous schemes, relative paths, and HTTP)
  if (!src.startsWith('https://')) {
    return false;
  }

  try {
    const url = new URL(src);

    // Get current origin (handle cases where window might not be fully initialized)
    const currentOrigin =
      typeof window !== 'undefined' && window.location ? window.location.origin : '';

    // Block same-origin iframes to prevent parent window access
    if (currentOrigin && url.origin === currentOrigin) {
      return false;
    }
  } catch {
    // Invalid URL
    return false;
  }

  // Enforce restrictive sandbox for cross-origin iframes. Since we already block same-origin
  // iframes above, it’s safe to allow both `allow-scripts` and `allow-same-origin` here: the iframe
  // can only access its own origin’s APIs (like Cache Storage for YouTube embeds), not the parent
  // window.
  const currentSandbox = iframe.getAttribute('sandbox') || '';
  const sandboxTokens = new Set(currentSandbox.split(/\s+/).filter(Boolean));

  // Required for embed functionality
  sandboxTokens.add('allow-scripts');
  sandboxTokens.add('allow-same-origin');

  // Set the enforced sandbox attribute
  iframe.setAttribute('sandbox', Array.from(sandboxTokens).join(' '));

  return true;
};

/**
 * Sanitize HTML with DOMPurify and enforce iframe security policies. This wrapper function handles
 * post-processing of iframes to ensure they are secure.
 * @param {string} html The HTML string to sanitize.
 * @param {object} [options] Additional DOMPurify options.
 * @returns {string} The sanitized HTML string with secure iframes.
 */
export const sanitizeRichTextHTML = (html, options = {}) => {
  // First pass: sanitize with DOMPurify, returning a DOM element
  const body = /** @type {HTMLBodyElement} */ (
    sanitize(html, { ...SANITIZE_OPTIONS, ...options, RETURN_DOM: true })
  );

  // Second pass: validate and secure all iframes
  const iframes = Array.from(body.querySelectorAll('iframe'));

  iframes.forEach((iframe) => {
    if (!validateIframe(iframe)) {
      iframe.remove();
    }
  });

  // Return the body’s HTML
  return body.innerHTML;
};

/**
 * Selector for the container element of a RichText field preview. Used to determine which preview
 * owns a placeholder or image, as a preview can be nested within another preview’s element preview
 * using `CMS.renderRichText()`.
 */
export const CONTAINER_QUERY_SELECTOR = '[data-rich-text-preview]';

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
 * Maximum number of substitution passes in {@link buildMarkdownWithPreviews}. A string preview can
 * expose further component syntax (e.g. a nested component in a `richtext` field), which is picked
 * up by the next pass. The cap guards against a preview that keeps reproducing its own syntax.
 */
const MAX_SUBSTITUTION_PASSES = 10;

/**
 * Get the global-flag version of a component pattern, so `matchAll()` can be used.
 * @param {RegExp} pattern Component pattern.
 * @returns {RegExp} Global pattern.
 */
const getGlobalPattern = (pattern) => {
  const cacheKey = `${pattern.source}|${pattern.flags}`;

  return getOrCreate(globalPatternCache, cacheKey, () =>
    pattern.global ? pattern : new RegExp(pattern.source, `${pattern.flags}g`),
  );
};

/**
 * @typedef {object} ComponentMatch
 * @property {EditorComponentDefinition} def Matched component definition.
 * @property {RegExpExecArray} match Match result.
 * @property {number} index Start index of the match.
 * @property {number} end End index of the match (exclusive).
 * @property {number} order Index of the definition in the given list, used as a tie-breaker.
 */

/**
 * Find all the outermost component matches in the given string. When matches overlap, only the
 * one starting first is kept; on a tie, the longest match wins, then the earliest definition. Any
 * match inside another match is dropped, so a component always receives the raw content of a
 * nested `richtext` field, including any nested component syntax, rather than a partially
 * substituted string. This makes the result independent of the component registration order.
 * @param {string} string String to search.
 * @param {EditorComponentDefinition[]} componentDefs Component definitions.
 * @returns {ComponentMatch[]} Non-overlapping matches sorted by position.
 */
const findOutermostMatches = (string, componentDefs) => {
  /** @type {ComponentMatch[]} */
  const candidates = [];

  componentDefs.forEach((def, order) => {
    string.matchAll(getGlobalPattern(def.pattern)).forEach((match) => {
      // A zero-length match cannot be a component and would be re-substituted on every pass
      if (match[0]) {
        candidates.push({
          def,
          match,
          index: match.index,
          end: match.index + match[0].length,
          order,
        });
      }
    });
  });

  candidates.sort((a, b) => a.index - b.index || b.end - a.end || a.order - b.order);

  let cursor = 0;

  return candidates.filter((candidate) => {
    if (candidate.index < cursor) {
      return false;
    }

    cursor = candidate.end;

    return true;
  });
};

/**
 * Substitute the given component matches in the string with their previews.
 * @param {object} args Arguments.
 * @param {string} args.string String to process.
 * @param {ComponentMatch[]} args.matches Outermost matches found in the string.
 * @param {Map<string, number>} args.seenHashes Number of occurrences of each block hash so far,
 * used to make the keys unique across passes.
 * @param {Map<string, ComponentPreview>} args.previewMap Preview map to be populated.
 * @param {Map<string, ComponentPreview>} [args.previousPreviewMap] Preview map from the previous
 * run, if any.
 * @returns {{ string: string, hasStringPreview: boolean }} The processed string, and whether any
 * string preview was substituted, which may expose further component syntax.
 */
const substituteMatches = ({ string, matches, seenHashes, previewMap, previousPreviewMap }) => {
  /** @type {string[]} */
  const chunks = [];
  let cursor = 0;
  let hasStringPreview = false;

  matches.forEach(({ def: { fromBlock, toPreview }, match, index, end }) => {
    const baseHash = hashString(match[0]);
    const count = seenHashes.get(baseHash) ?? 0;
    const key = count === 0 ? baseHash : `${baseHash}-${count}`;
    const fieldProps = fromBlock?.(match) ?? match.groups ?? {};
    const preview = previousPreviewMap?.get(key) ?? toPreview?.(fieldProps);

    seenHashes.set(baseHash, count + 1);
    previewMap.set(key, preview);
    chunks.push(string.slice(cursor, index));

    // Replace the component syntax with a direct preview string or placeholder, depending on the
    // type of the preview value. This allows simple text previews to be rendered directly without
    // needing the `MutationObserver` to find and replace a placeholder element, while still
    // supporting complex React element previews.
    if (typeof preview === 'string') {
      hasStringPreview = true;
      chunks.push(preview);
    } else {
      // Return a placeholder element with a unique key that can be used by the `MutationObserver`
      // to find the correct location to render the React element preview.
      chunks.push(`<span data-component-key="${key}"></span>`);
    }

    cursor = end;
  });

  chunks.push(string.slice(cursor));

  return { string: chunks.join(''), hasStringPreview };
};

/**
 * Process a Markdown string by extracting editor component instances, computing their previews and
 * replacing each match with a placeholder `<span>` keyed to the preview map.
 *
 * Components are matched outermost-first, so `toPreview()` always receives the raw block content.
 * Since a string preview may itself contain component syntax (typically the verbatim value of a
 * nested `richtext` field), the substituted string is scanned again until no component is left or
 * {@link MAX_SUBSTITUTION_PASSES} is reached. An element preview, on the other hand, can render its
 * nested content with `CMS.renderRichText()`, which runs this whole process recursively.
 * @param {string | undefined} currentValue The raw Markdown field value.
 * @param {EditorComponentDefinition[]} componentDefs The resolved component definitions.
 * @param {Map<string, ComponentPreview>} [previousPreviewMap] Preview map from the previous run, if
 * any. Keys are content hashes, so an entry can be reused as long as the matched block is
 * unchanged. This avoids calling `toPreview()` again for every unmodified component on each
 * keystroke, which would orphan the DOM element and any component mounted on it in the case of an
 * element preview.
 * @returns {{ markdown: string, previewMap: Map<string, ComponentPreview> }} The processed Markdown
 * string and a map of component keys to their precomputed preview values.
 */
export const buildMarkdownWithPreviews = (currentValue, componentDefs, previousPreviewMap) => {
  /** @type {Map<string, ComponentPreview>} */
  const previewMap = new Map();
  /** @type {Map<string, number>} */
  const seenHashes = new Map();
  let string = (currentValue ?? '').replace(GLOBAL_IMAGE_REGEX, encodeImageSrc);

  for (let pass = 0; pass < MAX_SUBSTITUTION_PASSES && componentDefs.length; pass += 1) {
    const matches = findOutermostMatches(string, componentDefs);

    if (!matches.length) {
      break;
    }

    const result = substituteMatches({
      string,
      matches,
      seenHashes,
      previewMap,
      previousPreviewMap,
    });

    string = result.string;

    // Only a string preview can expose further component syntax
    if (!result.hasStringPreview) {
      break;
    }
  }

  return { markdown: string, previewMap };
};
