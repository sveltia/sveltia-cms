import { getOrCreate } from '$lib/services/utils/cache';

/**
 * @import { InlinePatternOptions, ResolvedEditorComponentDefinition } from '$lib/types/private';
 * @import {
 * CustomEditorComponentDefinition,
 * InlineEditorComponentDefinition,
 * } from '$lib/types/public';
 */

/**
 * Check if the given component definition is a pattern-based inline component, compatible with
 * Decap CMS, which has the `type` option set to `inline`.
 * @param {{ type?: string } | CustomEditorComponentDefinition | undefined} definition Definition
 * passed to the `CMS.registerEditorComponent()` API.
 * @returns {definition is InlineEditorComponentDefinition} Result.
 */
export const isInlinePatternComponent = (definition) =>
  !!definition && 'type' in definition && definition.type === 'inline';

/**
 * Get the pattern of an inline component as it’s matched within a paragraph: without a leading `^`,
 * which Decap CMS ignores as well, and without the `g` and `y` flags.
 * @param {RegExp} pattern Pattern given in the definition.
 * @returns {RegExp} Pattern.
 */
export const getInlinePattern = ({ source, flags }) =>
  new RegExp(source.startsWith('^') ? source.slice(1) : source, flags.replace(/[gy]/g, ''));

/**
 * Convert a pattern-based inline component definition to the shape of a field-based one, so the
 * editor and the preview can handle it like any other component: it has no fields, `fromInline`
 * and `toInline` take the place of `fromBlock` and `toBlock`, and the options the editor handles
 * on its own are kept in `inlinePattern`. Decap CMS falls back to `fromBlock` and `toBlock` if the
 * inline counterparts are missing, and so does this. The `trigger` option, which is the text the
 * instances start with, is moved there too, as it would otherwise be taken for the toolbar UI.
 * @param {InlineEditorComponentDefinition} definition Definition passed to the
 * `CMS.registerEditorComponent()` API.
 * @returns {ResolvedEditorComponentDefinition} Resolved definition, with the same `id` and `label`.
 */
export const resolveInlinePatternComponent = (definition) => {
  const { id, label, icon, pattern, trigger, toPreview, onInsert, onEdit } = definition;
  // Field-based options a definition may have anyway
  const { fromBlock, toBlock } = /** @type {Record<string, any>} */ (definition);
  const fromInline = definition.fromInline ?? fromBlock;
  const toInline = definition.toInline ?? toBlock;

  return {
    id,
    label,
    icon,
    fields: [],
    pattern: getInlinePattern(pattern),
    fromBlock: fromInline,
    toBlock: toInline,
    toPreview,
    inlinePattern: { trigger: trigger || undefined, onInsert, onEdit },
  };
};

/**
 * Cache of the patterns {@link findInlineMatches} searches with, so they’re not compiled again for
 * every text node Lexical imports.
 * @type {WeakMap<RegExp, { global?: RegExp, sticky?: RegExp }>}
 */
const searchPatternCache = new WeakMap();

/**
 * Get the global or sticky version of the given pattern, which is searched with `lastIndex`.
 * @param {RegExp} pattern Pattern returned by {@link getInlinePattern}.
 * @param {boolean} sticky Whether to get the sticky version, which only matches at `lastIndex`.
 * @returns {RegExp} Pattern.
 */
const getSearchPattern = (pattern, sticky) => {
  const key = sticky ? 'sticky' : 'global';

  const cache = getOrCreate(
    searchPatternCache,
    pattern,
    () => /** @type {{ global?: RegExp, sticky?: RegExp }} */ ({}),
  );

  cache[key] ??= new RegExp(pattern.source, `${pattern.flags}${sticky ? 'y' : 'g'}`);

  return cache[key];
};

/**
 * Find the instances of an inline component in the given string. With the `trigger` option, the
 * pattern is only matched where the trigger text is found, like Decap CMS does; otherwise, it’s
 * matched across the string. An empty match is never an instance.
 * @param {string} string String to search, e.g. the text of a paragraph.
 * @param {RegExp} pattern Pattern returned by {@link getInlinePattern}.
 * @param {InlinePatternOptions} [options] Options of the component.
 * @param {number} [limit] Maximum number of matches to find. Default: all of them.
 * @returns {RegExpExecArray[]} Non-overlapping matches in the order they appear.
 */
export const findInlineMatches = (string, pattern, { trigger } = {}, limit = Infinity) => {
  const searchPattern = getSearchPattern(pattern, !!trigger);
  /** @type {RegExpExecArray[]} */
  const matches = [];
  // Without a trigger, the pattern looks for the next instance from the index on its own
  let index = trigger ? string.indexOf(trigger) : 0;

  while (index !== -1 && matches.length < limit) {
    searchPattern.lastIndex = index;

    const match = searchPattern.exec(string);

    // A sticky pattern only matches at the trigger, so look for the next one; a global one has
    // found no instance after the index
    if (!match && !trigger) {
      break;
    }

    /** @type {number} */
    let nextIndex;

    if (match?.[0]) {
      matches.push(match);
      nextIndex = match.index + match[0].length;
    } else {
      // Move past the trigger, or an empty match so it’s not found again
      nextIndex = (match?.index ?? index) + 1;
    }

    if (trigger) {
      index = string.indexOf(trigger, nextIndex);
    } else {
      index = nextIndex <= string.length ? nextIndex : -1;
    }
  }

  return matches;
};

/**
 * Create the regular expression a text match transformer imports an inline component with. Lexical
 * matches the text with `String.prototype.match()`, which calls the `Symbol.match` method, so the
 * method is replaced to find the first instance with {@link findInlineMatches}, honouring the
 * `trigger` option.
 * @param {RegExp} pattern Pattern returned by {@link getInlinePattern}.
 * @param {InlinePatternOptions} options Options of the component.
 * @returns {RegExp} Regular expression.
 */
export const createInlineMatcher = (pattern, options) =>
  Object.assign(new RegExp(pattern), {
    /**
     * Find the first instance in the given text.
     * @param {string} text Text.
     * @returns {RegExpMatchArray | null} Match.
     */
    [Symbol.match]: (text) => findInlineMatches(text, pattern, options, 1)[0] ?? null,
  });
