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
 * Regex to match component placeholders in Markdown-parsed HTML, capturing the component key for
 * lookup in the preview map.
 */
export const COMPONENT_MATCHER = /<span data-component-key="([^"]+)"><\/span>/g;

/**
 * Selector for finding component placeholder elements in the rendered HTML, used by the
 * `MutationObserver` to identify where to render React element previews.
 */
export const COMPONENT_QUERY_SELECTOR = 'span[data-component-key]';

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
 * Split a Markdown string into logical blocks at blank lines, keeping fenced code blocks (backtick
 * or tilde fences) intact even when they contain blank lines.
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
    } else {
      const fenceMatch = /^[ ]{0,3}(`{3,}|~{3,})/.exec(line);

      if (fenceMatch) {
        current.push(line);
        fence = { char: fenceMatch[1][0], length: fenceMatch[1].length };
      } else if (line === '') {
        if (current.length) {
          blocks.push(current.splice(0).join('\n'));
        }
      } else {
        current.push(line);
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
    const globalPattern = pattern.global
      ? pattern
      : new RegExp(pattern.source, `${pattern.flags}g`);

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

    // Replace the component syntax with a placeholder
    string = string.replaceAll(
      globalPattern,
      () => `<span data-component-key="${keys.shift()}"></span>`,
    );
  });

  return { markdown: string, previewMap };
};

/**
 * Replace string component preview placeholders in parsed HTML with their preview content. React
 * element placeholders are left in place to be rendered by the `MutationObserver`.
 * @param {string} html The parsed HTML string containing component placeholders.
 * @param {Map<string, ComponentPreview>} previewMap Map of component keys to preview values.
 * @returns {string} The HTML string with string previews inlined.
 */
export const inlineStringPreviews = (html, previewMap) =>
  html.replace(COMPONENT_MATCHER, (match, key) => {
    const preview = previewMap.get(key);

    return typeof preview === 'string' ? preview : match;
  });
