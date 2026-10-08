import { getImmutable, immutableLoaded } from '$lib/services/api/immutable';
import { supportsHTML } from '$lib/services/contents/fields/rich-text/components/utils';
import { GLOBAL_IMAGE_REGEX } from '$lib/services/contents/fields/rich-text/constants';
import { getOrCreate } from '$lib/services/utils/cache';
import { escapeHTML } from '$lib/services/utils/string';

/**
 * @import { List, MapOf } from 'immutable';
 * @import { ReactElement } from 'react';
 * @import {
 * ApiAsset,
 * EditorComponentDefinition,
 * Field,
 * GetAsset,
 * RichTextValueFormat,
 * } from '$lib/types/public';
 */

/**
 * @typedef {string | HTMLElement | ReactElement | undefined} ComponentPreview
 */

/**
 * Asset getter used when a preview is built outside an entry draft, e.g. to learn the tag a
 * component renders. It never finds an asset.
 * @type {GetAsset}
 */
export const getNoAsset = () => undefined;

/**
 * Cache of {@link getComponentFieldList} results, keyed by the `fields` array of a component.
 * @type {WeakMap<Field[], List<MapOf<Record<string, any>>>>}
 */
const fieldListCache = new WeakMap();

/**
 * Get the fields of an editor component as an Immutable List, which `toPreview()` receives as the
 * third argument for compatibility with Netlify/Decap CMS.
 * @param {EditorComponentDefinition} componentDef Component definition.
 * @returns {List<MapOf<Record<string, any>>> | undefined} Field list, or `undefined` if
 * Immutable.js isn’t loaded. It’s loaded when a component whose `toPreview()` takes three
 * parameters is registered.
 */
export const getComponentFieldList = ({ fields }) =>
  immutableLoaded.current
    ? getOrCreate(
        fieldListCache,
        fields,
        () => /** @type {List<MapOf<Record<string, any>>>} */ (getImmutable().fromJS(fields)),
      )
    : undefined;

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
 * Attributes of a media element that can refer to a file, which may have to be resolved to a blob
 * URL in the preview, keyed by the tag name. `srcset` holds a list of URLs with descriptors.
 * @type {Record<string, string[]>}
 */
const MEDIA_URL_ATTRIBUTES = {
  img: ['src', 'srcset'],
  source: ['src', 'srcset'],
  video: ['src', 'poster'],
  audio: ['src'],
};

/**
 * Selector for finding unprocessed media elements in the rendered HTML, used by the
 * `MutationObserver` to identify images, videos and audio that need to be processed (e.g. Converted
 * to `blob` URLs for local previews). The `data-processed` attribute is added to elements that have
 * already been processed to avoid reprocessing on subsequent mutations.
 */
export const MEDIA_QUERY_SELECTOR = `:is(${Object.entries(MEDIA_URL_ATTRIBUTES)
  .flatMap(([tagName, names]) => names.map((name) => `${tagName}[${name}]`))
  .join(', ')}):not([data-processed])`;

/**
 * Parse the value of a `srcset` attribute into image candidates. Like browsers, a URL is a run of
 * non-whitespace characters, so it can contain a comma, as in a `data:` URL, unless the comma ends
 * it; the descriptor, e.g. `2x` or `800w`, follows it up to the next comma.
 * @param {string} srcset Attribute value.
 * @returns {{ url: string, descriptor: string }[]} Candidates.
 * @see https://html.spec.whatwg.org/multipage/images.html#parsing-a-srcset-attribute
 */
export const parseSrcset = (srcset) => {
  /** @type {{ url: string, descriptor: string }[]} */
  const candidates = [];
  let position = 0;

  for (;;) {
    // Skip the whitespace and commas between candidates
    const urlStart = srcset.slice(position).search(/[^\s,]/);

    if (urlStart === -1) {
      break;
    }

    position += urlStart;

    const url = /** @type {string} */ (srcset.slice(position).match(/^\S+/)?.[0]);

    position += url.length;

    if (url.endsWith(',')) {
      // A URL ending with a comma has no descriptor
      candidates.push({ url: url.replace(/,+$/, ''), descriptor: '' });
    } else {
      const descriptorEnd = srcset.indexOf(',', position);
      const end = descriptorEnd === -1 ? srcset.length : descriptorEnd;

      candidates.push({ url, descriptor: srcset.slice(position, end).trim() });
      position = end;
    }
  }

  return candidates;
};

/**
 * Resolve the file paths in the URL attributes of the given media element, e.g. an image `src`, a
 * video `poster` or each URL in a `srcset`, so that a file that hasn’t been published or saved yet
 * is displayed in the preview. A path that can’t be resolved is left as is. Once a `<source>` of a
 * video or audio element is updated, the media is loaded again, as the element doesn’t pick up the
 * change by itself.
 * @param {Element} element Media element, matching {@link MEDIA_QUERY_SELECTOR}.
 * @param {(value: string) => Promise<string | undefined>} resolve Function resolving a path to a
 * URL, if any.
 * @returns {Promise<void>} Promise resolving once all the attributes have been updated.
 */
export const resolveMediaURLs = async (element, resolve) => {
  const names = MEDIA_URL_ATTRIBUTES[element.localName] ?? [];
  let updated = false;

  /**
   * Resolve a path, leaving it as is if it can’t be resolved, e.g. because the file can’t be
   * retrieved, so the other URLs are still resolved.
   * @param {string} value Path.
   * @returns {Promise<string>} URL.
   */
  const resolveURL = async (value) => {
    try {
      return (await resolve(value)) ?? value;
    } catch {
      return value;
    }
  };

  await Promise.all(
    names.map(async (name) => {
      const value = element.getAttribute(name);

      if (!value) {
        return;
      }

      if (name === 'srcset') {
        const candidates = parseSrcset(value);
        const urls = await Promise.all(candidates.map(({ url }) => resolveURL(url)));

        // Leave the attribute as written unless a URL has been resolved
        if (urls.some((url, index) => url !== candidates[index].url)) {
          element.setAttribute(
            name,
            candidates
              .map(({ descriptor }, index) => [urls[index], descriptor].filter(Boolean).join(' '))
              .join(', '),
          );
          updated = true;
        }

        return;
      }

      const url = await resolveURL(value);

      if (url !== value) {
        element.setAttribute(name, url);
        updated = true;
      }
    }),
  );

  const { localName, parentElement: parent } = element;

  if (updated && localName === 'source' && /^(?:audio|video)$/.test(parent?.localName ?? '')) {
    /** @type {HTMLMediaElement} */ (parent).load();
  }
};

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
 * up by the next pass. The cap guards against a field value that keeps reproducing its own syntax.
 */
const MAX_SUBSTITUTION_PASSES = 10;

/**
 * @typedef {object} PreviewRegion
 * @property {number} start Start index of the substituted string preview.
 * @property {number} end End index of the substituted string preview (exclusive).
 * @property {string[]} values String field values the preview was built from.
 */

/**
 * Collect the string values in the given field props, including those nested in objects and
 * arrays, e.g. the items of a list field.
 * @param {any} props Field props.
 * @returns {string[]} String values.
 */
const collectStringValues = (props) => {
  if (typeof props === 'string') {
    return [props];
  }

  if (props && typeof props === 'object') {
    return Object.values(props).flatMap(collectStringValues);
  }

  return [];
};

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
 * Check if the given match is legitimate within the string previews substituted on the previous
 * pass. Component syntax can only come out of a preview through a field value, typically the
 * verbatim content of a nested `richtext` field, so a match is only accepted when it lies within a
 * preview and its text occurs in one of the values the preview was built from. This rules out a
 * preview that reproduces its own syntax, e.g. one that mirrors `toBlock()` with HTML tags, which
 * would otherwise be substituted again on every pass until the cap is reached.
 * @param {ComponentMatch} candidate Candidate match.
 * @param {PreviewRegion[]} regions Regions of the string previews substituted on the previous pass.
 * @returns {boolean} Result.
 */
const isMatchWithinPreviewValues = ({ match, index, end }, regions) =>
  regions.some(
    (region) =>
      index >= region.start &&
      end <= region.end &&
      region.values.some((value) => value.includes(match[0])),
  );

/**
 * Find all the outermost component matches in the given string. When matches overlap, only the
 * one starting first is kept; on a tie, the longest match wins, then the earliest definition. Any
 * match inside another match is dropped, so a component always receives the raw content of a
 * nested `richtext` field, including any nested component syntax, rather than a partially
 * substituted string. This makes the result independent of the component registration order.
 * @param {string} string String to search.
 * @param {EditorComponentDefinition[]} componentDefs Component definitions.
 * @param {PreviewRegion[]} [regions] Regions of the string previews substituted on the previous
 * pass, if any. On a later pass, only a match within one of these regions that comes from a
 * field value is kept; the rest of the string has already been scanned.
 * @returns {ComponentMatch[]} Non-overlapping matches sorted by position.
 */
const findOutermostMatches = (string, componentDefs, regions) => {
  /** @type {ComponentMatch[]} */
  const candidates = [];

  componentDefs.forEach((def, order) => {
    string.matchAll(getGlobalPattern(def.pattern)).forEach((match) => {
      const candidate = {
        def,
        match,
        index: match.index,
        end: match.index + match[0].length,
        order,
      };

      // A zero-length match cannot be a component and would be re-substituted on every pass
      if (match[0] && (!regions || isMatchWithinPreviewValues(candidate, regions))) {
        candidates.push(candidate);
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
 * Compute the preview of a component instance, or reuse the one computed in the previous run, and
 * add it to the preview map.
 * @param {object} args Arguments.
 * @param {EditorComponentDefinition} args.def Component definition.
 * @param {Record<string, any>} args.fieldProps Field values of the instance.
 * @param {string} args.source Markdown or HTML of the instance, which its key is computed from.
 * @param {Map<string, number>} args.seenHashes Number of occurrences of each block hash so far,
 * used to make the keys unique.
 * @param {Map<string, ComponentPreview>} args.previewMap Preview map to be populated.
 * @param {Map<string, ComponentPreview>} [args.previousPreviewMap] Preview map from the previous
 * run, if any.
 * @param {GetAsset} args.getAsset Asset getter passed to `toPreview()`.
 * @param {Map<string, ApiAsset[]>} args.assetMap Map to be populated with the assets each newly
 * computed preview has got with the asset getter, keyed by the preview’s key.
 * @returns {{ key: string, preview: ComponentPreview }} Key and preview.
 */
const addComponentPreview = ({
  def,
  fieldProps,
  source,
  seenHashes,
  previewMap,
  previousPreviewMap,
  getAsset,
  assetMap,
}) => {
  const { toPreview } = def;
  const baseHash = hashString(source);
  const count = seenHashes.get(baseHash) ?? 0;
  const key = count === 0 ? baseHash : `${baseHash}-${count}`;
  let preview = previousPreviewMap?.get(key);

  if (preview == null && toPreview) {
    /** @type {ApiAsset[]} */
    const assets = [];

    preview = toPreview(
      fieldProps,
      (path, field) => {
        const asset = getAsset(path, field);

        if (asset) {
          assets.push(asset);
        }

        return asset;
      },
      getComponentFieldList(def),
    );

    if (assets.length) {
      assetMap.set(key, assets);
    }
  }

  seenHashes.set(baseHash, count + 1);
  previewMap.set(key, preview);

  return { key, preview };
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
 * @param {GetAsset} args.getAsset Asset getter passed to `toPreview()`.
 * @param {Map<string, ApiAsset[]>} args.assetMap Map to be populated with the assets each newly
 * computed preview has got with the asset getter, keyed by the preview’s key.
 * @returns {{ string: string, regions: PreviewRegion[] }} The processed string, and the regions of
 * the substituted string previews, which may expose further component syntax.
 */
const substituteMatches = ({
  string,
  matches,
  seenHashes,
  previewMap,
  previousPreviewMap,
  getAsset,
  assetMap,
}) => {
  /** @type {string[]} */
  const chunks = [];
  /** @type {PreviewRegion[]} */
  const regions = [];
  let cursor = 0;
  let length = 0;

  matches.forEach(({ def, match, index, end }) => {
    const fieldProps = def.fromBlock?.(match) ?? match.groups ?? {};

    const { key, preview } = addComponentPreview({
      def,
      fieldProps,
      source: match[0],
      seenHashes,
      previewMap,
      previousPreviewMap,
      getAsset,
      assetMap,
    });

    chunks.push(string.slice(cursor, index));
    length += index - cursor;

    // Replace the component syntax with a direct preview string or placeholder, depending on the
    // type of the preview value. This allows simple text previews to be rendered directly without
    // needing the `MutationObserver` to find and replace a placeholder element, while still
    // supporting complex React element previews.
    if (typeof preview === 'string') {
      regions.push({
        start: length,
        end: length + preview.length,
        values: collectStringValues(fieldProps),
      });
      chunks.push(preview);
      length += preview.length;
    } else {
      // Return a placeholder element with a unique key that can be used by the `MutationObserver`
      // to find the correct location to render the React element preview.
      const placeholder = `<span data-component-key="${key}"></span>`;

      chunks.push(placeholder);
      length += placeholder.length;
    }

    cursor = end;
  });

  chunks.push(string.slice(cursor));

  return { string: chunks.join(''), regions };
};

/**
 * Process an HTML string by finding editor component instances with their `htmlSelector` and
 * `fromBlockHTML` options, computing their previews and replacing each instance with its string
 * preview or a placeholder `<span>` keyed to the preview map, like
 * {@link buildMarkdownWithPreviews} does for Markdown. The HTML is parsed into an inert template,
 * so nothing in it runs or loads. The outermost instance wins, as its content is part of it.
 * Components without HTML support or `toPreview()` are left out, and their HTML is rendered as is.
 * A string preview isn’t searched for nested components; an element preview can render its nested
 * content with `CMS.renderRichText()`.
 * @param {string} html The raw HTML field value.
 * @param {EditorComponentDefinition[]} componentDefs The resolved component definitions.
 * @param {Map<string, ComponentPreview>} [previousPreviewMap] Preview map from the previous run.
 * @param {GetAsset} [getAsset] Asset getter passed to `toPreview()`.
 * @returns {{
 * markdown: string,
 * previewMap: Map<string, ComponentPreview>,
 * assetMap: Map<string, ApiAsset[]>,
 * }} The processed HTML string, a map of component keys to their preview values, and a map of
 * the keys of the previews computed in this run to the assets they’ve got with `getAsset`.
 */
const buildHTMLWithPreviews = (html, componentDefs, previousPreviewMap, getAsset = getNoAsset) => {
  const defs = componentDefs.filter((def) => supportsHTML(def) && !!def.toPreview);
  /** @type {Map<string, ComponentPreview>} */
  const previewMap = new Map();
  /** @type {Map<string, ApiAsset[]>} */
  const assetMap = new Map();
  /** @type {Map<string, number>} */
  const seenHashes = new Map();

  if (!defs.length) {
    return { markdown: html, previewMap, assetMap };
  }

  const template = document.createElement('template');

  template.innerHTML = html;

  /**
   * Replace the component instances among the descendants of the given node with their previews.
   * @param {ParentNode} parent Parent node.
   */
  const replaceInstances = (parent) => {
    [...parent.children].forEach((element) => {
      /** @type {Record<string, any> | undefined} */
      let fieldProps;

      const def = defs.find((d) => {
        fieldProps = element.matches(/** @type {string} */ (d.htmlSelector))
          ? /** @type {NonNullable<EditorComponentDefinition['fromBlockHTML']>} */ (
              d.fromBlockHTML
            )(/** @type {HTMLElement} */ (element))
          : undefined;

        return !!fieldProps;
      });

      if (!def) {
        replaceInstances(element);

        return;
      }

      const { key, preview } = addComponentPreview({
        def,
        fieldProps: /** @type {Record<string, any>} */ (fieldProps),
        source: element.outerHTML,
        seenHashes,
        previewMap,
        previousPreviewMap,
        getAsset,
        assetMap,
      });

      if (typeof preview === 'string') {
        // Parse the preview into an inert template as well
        const previewTemplate = document.createElement('template');

        previewTemplate.innerHTML = preview;
        element.replaceWith(previewTemplate.content);
      } else {
        // A placeholder for the `MutationObserver` to render an element or React element preview
        const placeholder = document.createElement('span');

        placeholder.dataset.componentKey = key;
        element.replaceWith(placeholder);
      }
    });
  };

  replaceInstances(template.content);

  return { markdown: template.innerHTML, previewMap, assetMap };
};

/**
 * Process a Markdown string by extracting editor component instances, computing their previews and
 * replacing each match with a placeholder `<span>` keyed to the preview map.
 *
 * Components are matched outermost-first, so `toPreview()` always receives the raw block content.
 * Since a string preview may itself contain component syntax (typically the verbatim value of a
 * nested `richtext` field), the substituted previews are scanned again until no component is left
 * or {@link MAX_SUBSTITUTION_PASSES} is reached; only syntax that comes from a field value counts,
 * not any the preview template reproduces by itself. An element preview, on the other hand, can
 * render its nested content with `CMS.renderRichText()`, which runs this whole process recursively.
 * @param {string | undefined} currentValue The raw Markdown field value.
 * @param {EditorComponentDefinition[]} componentDefs The resolved component definitions.
 * @param {Map<string, ComponentPreview>} [previousPreviewMap] Preview map from the previous run, if
 * any. Keys are content hashes, so an entry can be reused as long as the matched block is
 * unchanged. This avoids calling `toPreview()` again for every unmodified component on each
 * keystroke, which would orphan the DOM element and any component mounted on it in the case of an
 * element preview.
 * @param {GetAsset} [getAsset] Asset getter passed to `toPreview()`, which resolves a file path to
 * the asset in the context of the entry draft. Defaults to one that never finds an asset.
 * @param {RichTextValueFormat} [format] Format of the value. With `html`, the value is processed by
 * {@link buildHTMLWithPreviews} instead.
 * @returns {{
 * markdown: string,
 * previewMap: Map<string, ComponentPreview>,
 * assetMap: Map<string, ApiAsset[]>,
 * }} The processed Markdown string, a map of component keys to their precomputed preview values,
 * and a map of the keys of the previews computed in this run to the assets they’ve got with
 * `getAsset`, whose URL may still change.
 */
export const buildMarkdownWithPreviews = (
  currentValue,
  componentDefs,
  previousPreviewMap,
  getAsset = getNoAsset,
  format = 'markdown',
) => {
  if (format === 'html') {
    return buildHTMLWithPreviews(currentValue ?? '', componentDefs, previousPreviewMap, getAsset);
  }

  /** @type {Map<string, ComponentPreview>} */
  const previewMap = new Map();
  /** @type {Map<string, ApiAsset[]>} */
  const assetMap = new Map();
  /** @type {Map<string, number>} */
  const seenHashes = new Map();
  let string = (currentValue ?? '').replace(GLOBAL_IMAGE_REGEX, encodeImageSrc);
  /** @type {PreviewRegion[] | undefined} */
  let regions;

  for (let pass = 0; pass < MAX_SUBSTITUTION_PASSES && componentDefs.length; pass += 1) {
    const matches = findOutermostMatches(string, componentDefs, regions);

    if (!matches.length) {
      break;
    }

    const result = substituteMatches({
      string,
      matches,
      seenHashes,
      previewMap,
      previousPreviewMap,
      getAsset,
      assetMap,
    });

    string = result.string;
    regions = result.regions;

    // Only a string preview can expose further component syntax
    if (!regions.length) {
      break;
    }
  }

  return { markdown: string, previewMap, assetMap };
};
