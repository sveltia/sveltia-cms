import { flattenKeys, unflattenKeys } from '$lib/services/utils/object';

/**
 * @import { EditorComponentDefinition } from '$lib/types/public';
 */

/**
 * Check if the given pattern is multiline.
 * @param {RegExp} pattern Pattern.
 * @returns {boolean} Result.
 */
export const isMultiLinePattern = ({ multiline, dotAll, source }) =>
  multiline || dotAll || source.includes('[\\s\\S]') || source.includes('[\\S\\s]');

/**
 * Get the subject of each complex selector in the given selector list, the compound selector after
 * the last combinator that the matched element itself is checked against, e.g. `img.wide` for
 * `figure > img.wide`. Commas, whitespace and combinators within parentheses, brackets or quotes,
 * as in `a:has(> img)` or `[title="a, b"]`, are part of a compound selector.
 * @param {string} selector Selector list.
 * @returns {string[]} Compound selectors.
 */
const getSelectorSubjects = (selector) => {
  /** @type {string[]} */
  const subjects = [];
  let depth = 0;
  let quote = '';
  let start = 0;
  let afterCombinator = false;

  // Add a comma to end the last selector
  [...selector, ','].forEach((char, index) => {
    if (quote) {
      if (char === quote) {
        quote = '';
      }

      return;
    }

    if (depth === 0 && char === ',') {
      subjects.push(selector.slice(start, index).trim());
      start = index + 1;
      afterCombinator = false;

      return;
    }

    if (depth === 0 && /[\s>+~]/.test(char)) {
      afterCombinator = true;

      return;
    }

    if (afterCombinator) {
      start = index;
      afterCombinator = false;
    }

    if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '(' || char === '[') {
      depth += 1;
    } else if (char === ')' || char === ']') {
      depth -= 1;
    }
  });

  return subjects;
};

/**
 * Get the names of the elements the given `htmlSelector` of an editor component matches, e.g. `a`
 * and `img` for `a:has(> img), figure > img`. The editor imports the component from these
 * elements, so each selector in the list has to name the element type it matches.
 * @param {string} selector Selector list.
 * @returns {string[] | undefined} Lowercase tag names, without duplicates, or `undefined` if any of
 * the selectors doesn’t start its last compound selector with a type selector, e.g. `.note` or
 * `:is(aside, div)`.
 */
export const getSelectorTagNames = (selector) => {
  const names = getSelectorSubjects(selector).map(
    (subject) => /^[a-z][a-z\d-]*(?![\w-])/i.exec(subject)?.[0].toLowerCase() ?? '',
  );

  return names.every(Boolean) ? [...new Set(names)] : undefined;
};

/**
 * Check if the given string is a valid CSS selector list.
 * @param {string} selector Selector list.
 * @returns {boolean} Result.
 */
export const isValidSelector = (selector) => {
  try {
    document.createDocumentFragment().querySelector(selector);

    return true;
  } catch {
    return false;
  }
};

/**
 * Check if the given component definition supports the HTML format of the RichText field, which
 * requires the `htmlSelector`, `fromBlockHTML` and `toBlockHTML` options.
 * @param {EditorComponentDefinition} componentDef Component definition.
 * @returns {boolean} Result.
 */
export const supportsHTML = ({ htmlSelector, fromBlockHTML, toBlockHTML }) =>
  typeof htmlSelector === 'string' &&
  typeof fromBlockHTML === 'function' &&
  typeof toBlockHTML === 'function';

/**
 * Normalize properties by removing internal properties.
 * @param {Record<string, any>} props Properties to normalize.
 * @returns {Record<string, any>} Properties excluding those starting with `__sc_`, which are used
 * for internal purposes.
 */
export const normalizeProps = (props) =>
  unflattenKeys(
    Object.fromEntries(
      Object.entries(flattenKeys(props)).filter(
        ([key]) => !key.split('.').pop()?.startsWith('__sc_'),
      ),
    ),
  );

/**
 * Get the names of the rich text editor components the given component is nested in. Lexical mounts
 * each component outside the Svelte component tree, so the names can’t come from the context; each
 * component instead lists its own name and those of its parents in the `data-component-path`
 * attribute of the element holding its fields, which this reads from the closest one.
 * @param {Element | undefined} element Element of a component.
 * @returns {string[]} Component names, the outermost first.
 */
export const getParentComponentNames = (element) => {
  /** @type {HTMLElement | null | undefined} */
  const container = element?.parentElement?.closest('[data-component-path]');

  return container ? JSON.parse(/** @type {string} */ (container.dataset.componentPath)) : [];
};

/**
 * Unescape the title of a Markdown image, like `T \"q\"` in `![a](/a.png "T \"q\"")`, so the
 * field shows `T "q"`. A backslash before an ASCII punctuation character escapes it, as anywhere
 * else in Markdown, while one before any other character is a literal backslash.
 * @param {string} title Title as it appears in Markdown, between the quotes.
 * @returns {string} Unescaped title.
 * @see https://spec.commonmark.org/0.31.2/#link-title
 */
export const unescapeTitle = (title) => title.replace(/\\([!-/:-@[-`{-~])/g, '$1');

/**
 * Escape the title of a Markdown image, the counterpart of `unescapeTitle()`, so it can be put
 * between double quotes: a double quote is escaped, as well as a backslash that would otherwise
 * escape the next character or the closing quote.
 * @param {string} title Title.
 * @returns {string} Escaped title.
 */
export const escapeTitle = (title) =>
  title.replace(/\\(?=[!-/:-@[-`{-~]|$)/g, '\\\\').replace(/"/g, '\\"');
