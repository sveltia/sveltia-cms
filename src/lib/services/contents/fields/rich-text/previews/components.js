import { getImmutable, immutableLoaded } from '$lib/services/api/immutable';
import { supportsHTML } from '$lib/services/contents/fields/rich-text/components/utils';
import { IMAGE_OR_LINKED_IMAGE_REGEX } from '$lib/services/contents/fields/rich-text/constants';
import {
  getCodeRanges,
  isWithinHTMLBlock,
  isWithinRanges,
  startsHTMLBlock,
} from '$lib/services/contents/fields/rich-text/previews/syntax';
import { getOrCreate } from '$lib/services/utils/cache';

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
 * Encode image URLs in Markdown to ensure spaces are properly handled, including the link of a
 * linked image. E.g. `![alt](my image.png)` -> `![alt](my%20image.png)`.
 * @param {...any} args Arguments from a match of `IMAGE_OR_LINKED_IMAGE_REGEX` or `IMAGE_REGEX`.
 * @returns {string} The encoded image Markdown string.
 * @see https://github.com/markedjs/marked/issues/1639
 */
export const encodeImageSrc = (...args) => {
  const { alt, src, title, alt2, src2, title2, link } = args.at(-1);

  if (src2 !== undefined) {
    // A link with a quote may have a title, which has to be kept apart
    const eLink = /["']/.test(link) ? link : link.replaceAll(' ', '%20');

    return `[${encodeImageSrc({ alt: alt2, src: src2, title: title2 })}](${eLink})`;
  }

  const eSrc = src.replaceAll(' ', '%20');

  return title ? `![${alt}](${eSrc} "${title}")` : `![${alt}](${eSrc})`;
};

/**
 * Global version of `IMAGE_OR_LINKED_IMAGE_REGEX`.
 */
const GLOBAL_IMAGE_OR_LINKED_IMAGE_REGEX = new RegExp(IMAGE_OR_LINKED_IMAGE_REGEX, 'g');
/**
 * IDs of the built-in image components, whose Markdown is left to Marked in the preview. Their
 * previews are `<img>` HTML, which would show as text within code, and start an HTML block that
 * leaves the following lines unparsed when the image is alone on a line, e.g. above a caption.
 */
const MARKDOWN_IMAGE_COMPONENT_IDS = ['image', 'linked-image'];
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
 * @returns {ComponentMatch[]} Non-overlapping matches sorted by position. A match starting within a
 * code span or fenced code block is left out, as the syntax is literal text there; one starting
 * with the code, e.g. a component made of a fenced code block, is kept.
 */
const findOutermostMatches = (string, componentDefs, regions) => {
  /** @type {ComponentMatch[]} */
  const candidates = [];
  const codeRanges = getCodeRanges(string);

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
      if (
        match[0] &&
        !isWithinRanges(match.index, codeRanges) &&
        (!regions || isMatchWithinPreviewValues(candidate, regions))
      ) {
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
 * @typedef {object} PreviewContext
 * @property {Map<string, number>} seenHashes Number of occurrences of each block hash so far, used
 * to make the keys unique across passes.
 * @property {Map<string, ComponentPreview>} previewMap Preview map to be populated.
 * @property {Map<string, ComponentPreview>} [previousPreviewMap] Preview map from the previous run,
 * if any.
 * @property {GetAsset} getAsset Asset getter passed to `toPreview()`.
 * @property {Map<string, ApiAsset[]>} assetMap Map to be populated with the assets each newly
 * computed preview has got with the asset getter, keyed by the preview’s key.
 */

/**
 * Create the state shared by the previews computed in a single run.
 * @param {Map<string, ComponentPreview> | undefined} previousPreviewMap Preview map from the
 * previous run, if any.
 * @param {GetAsset} getAsset Asset getter passed to `toPreview()`.
 * @returns {PreviewContext} Context.
 */
const createPreviewContext = (previousPreviewMap, getAsset) => ({
  seenHashes: new Map(),
  previewMap: new Map(),
  previousPreviewMap,
  getAsset,
  assetMap: new Map(),
});

/**
 * Compute the preview of a component instance, or reuse the one computed in the previous run, and
 * add it to the preview map.
 * @param {PreviewContext} context Preview context.
 * @param {object} args Arguments.
 * @param {EditorComponentDefinition} args.def Component definition.
 * @param {Record<string, any>} args.fieldProps Field values of the instance.
 * @param {string} args.source Markdown or HTML of the instance, which its key is computed from.
 * @returns {{ key: string, preview: ComponentPreview }} Key and preview.
 */
const addComponentPreview = (context, { def, fieldProps, source }) => {
  const { seenHashes, previewMap, previousPreviewMap, getAsset, assetMap } = context;
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
 * Get the line break at the end of the line the given index is on, if the following line has any
 * text.
 * @param {string} string String.
 * @param {number} index Index.
 * @returns {number | undefined} Index of the line break, or `undefined` if there is no following
 * line with text.
 */
const getLineEndBeforeText = (string, index) => {
  const lineEnd = string.indexOf('\n', index);

  return lineEnd >= 0 &&
    string
      .slice(lineEnd + 1)
      .split('\n', 1)[0]
      .trim()
    ? lineEnd
    : undefined;
};

/**
 * Get the end of the line of an HTML block that a string preview substituted at the given range
 * starts, if the block would otherwise run on to the following lines, which would then be left
 * unparsed. That is when the preview starts a line with a block-level tag, or an opening or closing
 * tag alone on the line, the line is not within an HTML block already, and the following line has
 * any text. A blank line has to be added there to end the block.
 * @param {string} string String the preview is substituted in.
 * @param {object} args Arguments.
 * @param {string} args.preview String preview.
 * @param {number} args.index Start index of the match.
 * @param {number} args.end End index of the match (exclusive).
 * @returns {number | undefined} Index of the line break at the end of the line, or `undefined` if
 * no blank line is needed.
 */
const getHTMLBlockEnd = (string, { preview, index, end }) => {
  const lineStart = string.lastIndexOf('\n', index - 1) + 1;
  const indent = string.slice(lineStart, index);

  if (!/^ {0,3}$/.test(indent) || preview.includes('\n\n')) {
    return undefined;
  }

  const [firstLine] = preview.split('\n');
  const lineEnd = getLineEndBeforeText(string, end);

  const line =
    indent +
    firstLine +
    (firstLine === preview ? string.slice(end, lineEnd ?? string.indexOf('\n', end)) : '');

  const previousLine = lineStart
    ? string.slice(string.lastIndexOf('\n', lineStart - 2) + 1, lineStart - 1)
    : '';

  return lineEnd !== undefined &&
    startsHTMLBlock(line, { afterParagraph: !!previousLine.trim() }) &&
    !isWithinHTMLBlock(string, lineStart)
    ? lineEnd
    : undefined;
};

/**
 * Substitute the given component matches in the string with their previews.
 * @param {PreviewContext} context Preview context.
 * @param {object} args Arguments.
 * @param {string} args.string String to process.
 * @param {ComponentMatch[]} args.matches Outermost matches found in the string.
 * @returns {{ string: string, regions: PreviewRegion[] }} The processed string, and the regions of
 * the substituted string previews, which may expose further component syntax.
 */
const substituteMatches = (context, { string, matches }) => {
  /** @type {string[]} */
  const chunks = [];
  /** @type {PreviewRegion[]} */
  const regions = [];
  let cursor = 0;
  let length = 0;
  /**
   * Index of the line break to be doubled to end the HTML block a string preview has started. See
   * {@link getHTMLBlockEnd}.
   * @type {number | undefined}
   */
  let blockEnd;

  /**
   * Add the text from the cursor to the given index, with a blank line at {@link blockEnd}.
   * @param {number} index End index (exclusive).
   */
  const addText = (index) => {
    let text = string.slice(cursor, index);

    if (blockEnd !== undefined && blockEnd < index) {
      text = `${string.slice(cursor, blockEnd)}\n${string.slice(blockEnd, index)}`;
      blockEnd = undefined;
    }

    chunks.push(text);
    length += text.length;
  };

  matches.forEach(({ def, match, index, end }) => {
    const fieldProps = def.fromBlock?.(match) ?? match.groups ?? {};
    const { key, preview } = addComponentPreview(context, { def, fieldProps, source: match[0] });

    addText(index);

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
      blockEnd = getHTMLBlockEnd(string, { preview, index, end }) ?? blockEnd;
    } else {
      // Return a placeholder element with a unique key that can be used by the `MutationObserver`
      // to find the correct location to render the React element preview. A `<span>` with its
      // closing tag doesn’t start an HTML block.
      const placeholder = `<span data-component-key="${key}"></span>`;

      chunks.push(placeholder);
      length += placeholder.length;
    }

    // A block still open past this match ends at the end of the line the match ends on
    if (blockEnd !== undefined && blockEnd < end) {
      blockEnd = getLineEndBeforeText(string, end);
    }

    cursor = end;
  });

  addText(string.length);

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
  const context = createPreviewContext(previousPreviewMap, getAsset);
  const { previewMap, assetMap } = context;

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

      const { key, preview } = addComponentPreview(context, {
        def,
        fieldProps: /** @type {Record<string, any>} */ (fieldProps),
        source: element.outerHTML,
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
 * replacing each match with a placeholder `<span>` keyed to the preview map. The built-in image
 * components are left to Marked, and component syntax within code is left as is.
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

  const context = createPreviewContext(previousPreviewMap, getAsset);
  const { previewMap, assetMap } = context;
  const value = currentValue ?? '';
  const codeRanges = getCodeRanges(value);
  const defs = componentDefs.filter(({ id }) => !MARKDOWN_IMAGE_COMPONENT_IDS.includes(id));

  let string = value.replace(GLOBAL_IMAGE_OR_LINKED_IMAGE_REGEX, (...args) =>
    // The offset comes before the whole string and the named groups
    isWithinRanges(args.at(-3), codeRanges) ? args[0] : encodeImageSrc(...args),
  );

  /** @type {PreviewRegion[] | undefined} */
  let regions;

  for (let pass = 0; pass < MAX_SUBSTITUTION_PASSES && defs.length; pass += 1) {
    const matches = findOutermostMatches(string, defs, regions);

    if (!matches.length) {
      break;
    }

    const result = substituteMatches(context, { string, matches });

    string = result.string;
    regions = result.regions;

    // Only a string preview can expose further component syntax
    if (!regions.length) {
      break;
    }
  }

  return { markdown: string, previewMap, assetMap };
};
